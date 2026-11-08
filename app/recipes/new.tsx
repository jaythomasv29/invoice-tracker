import { useWorkspace } from '../../lib/workspaceContext';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { ensureAiConsent } from '../../lib/aiConsent';
import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import SafeAreaView from '../../components/ui/Screen';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../../constants/Colors';
import { useSupabase } from '../../lib/supabase';
import { createDraftDish, uploadRecipePhoto, draftRecipe, deleteRecipe } from '../../lib/recipeCosting';
import { useEntitlement } from '../../hooks/useEntitlement';
import Spinner from '../../components/ui/Spinner';
import BackButton from '../../components/ui/BackButton';

export default function NewRecipeScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization } = useWorkspace();
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState<false | 'ai' | 'manual'>(false);
  const [error, setError] = useState('');

  const { isPro } = useEntitlement();
  const isProRequired = /pro feature/i.test(error);
  // draft-recipe reports its monthly allowance as "…Smart Sift limit reached…".
  const isDraftLimit = /limit reached/i.test(error);

  const handlePickPhoto = async () => {
    Haptics.selectionAsync();
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleDraft = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    if (!organization?.id) {
      setError('No restaurant selected');
      return;
    }
    Haptics.selectionAsync();
    setBusy('ai');
    setError('');
    let id: string | null = null;
    try {
      if (!(await ensureAiConsent(supabase))) { setBusy(false); return; }
      id = await createDraftDish(supabase, organization.id, trimmed);
      if (photoUri) {
        await uploadRecipePhoto(supabase, organization.id, id, photoUri);
      }
      await draftRecipe(supabase, id);
      router.replace(`/recipes/${id}/review`);
    } catch (err: any) {
      // Don't leave an empty, ingredient-less dish behind on the Recipes list:
      // void the half-made draft (best effort) so "Try again" starts clean.
      if (id) void deleteRecipe(supabase, id).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message: string = err?.message ?? '';
      setError(/limit reached/i.test(message)
        ? 'You’ve used this month’s Smart Sift recipe drafts.'
        : /pro feature/i.test(message) ? message : 'Smart Sift could not draft this dish. Try again, or add the ingredients yourself.');
      setBusy(false);
    }
  };

  const handleManual = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    if (!organization?.id) {
      setError('No restaurant selected');
      return;
    }
    Haptics.selectionAsync();
    setBusy('manual');
    setError('');
    let id: string | null = null;
    try {
      id = await createDraftDish(supabase, organization.id, trimmed);
      if (photoUri) {
        await uploadRecipePhoto(supabase, organization.id, id, photoUri);
      }
      router.replace(`/recipes/${id}/review`);
    } catch (err: any) {
      if (id) void deleteRecipe(supabase, id).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err?.message ?? 'Could not create dish');
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.busyFill}>
          <Spinner size={28} />
          <Text style={styles.busyText}>Setting up your dish…</Text>
          {busy === 'ai' && (
            <Text style={styles.busySub}>This can take a few seconds while Smart Sift reads your dish.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>New dish</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dish name</Text>
            <View style={[styles.inputWrap, error && !isProRequired && !isDraftLimit ? styles.inputError : null]}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(val) => { setName(val); setError(''); }}
                placeholder="e.g. Grilled salmon plate"
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="done"
                onSubmitEditing={handleDraft}
                autoFocus
              />
            </View>
          </View>

          <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={photoUri ? 'Change dish photo' : 'Add a dish photo (optional)'}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoThumb} />
            ) : (
              <View style={styles.photoIcon} />
            )}
            <Text style={styles.photoBtnText}>
              {photoUri ? 'Photo added — tap to change' : 'Add a photo (optional)'}
            </Text>
          </TouchableOpacity>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {isDraftLimit && (
                <>
                  <Text style={styles.errorText}>
                    {isPro
                      ? 'Your allowance resets at the start of next month. You can still add the ingredients yourself below.'
                      : 'Pro includes 10 Smart Sift recipe drafts each month. You can still add the ingredients yourself below.'}
                  </Text>
                  {!isPro && (
                    <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/paywall', params: { reason: 'recipe-limit' } })} activeOpacity={0.7}>
                      <Text style={styles.errorLink}>See Pro plans</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {isProRequired && (
                <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/paywall')} activeOpacity={0.7}>
                  <Text style={styles.errorLink}>See Pro plans</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.cta, !name.trim() && styles.ctaDisabled]}
            onPress={handleDraft}
            disabled={!name.trim()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: !name.trim() }}
          >
            <Text style={styles.ctaText}>Draft with Smart Sift</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualBtn}
            onPress={handleManual}
            disabled={!name.trim()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: !name.trim() }}
          >
            <Text style={[styles.manualBtnText, !name.trim() && styles.manualBtnTextDisabled]}>
              Or add ingredients myself
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },

  scroll: { padding: 20, gap: 16 },

  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, height: 52,
  },
  inputError: { borderColor: Colors.danger },
  input: { flex: 1, fontSize: 17, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary, height: '100%' },

  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  photoIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryMuted,
  },
  photoThumb: { width: 36, height: 36, borderRadius: 10 },
  photoBtnText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, flexShrink: 1 },

  errorBox: { gap: 6 },
  errorText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.danger },
  errorLink: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.primary, textDecorationLine: 'underline' },

  cta: {
    backgroundColor: Colors.primary, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    marginTop: 4,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#fff' },

  manualBtn: { alignItems: 'center', paddingVertical: 6 },
  manualBtnText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.primary, textDecorationLine: 'underline' },
  manualBtnTextDisabled: { opacity: 0.5 },

  busyFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  busyText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  busySub: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});

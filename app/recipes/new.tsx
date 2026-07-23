import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useSupabase } from '../../lib/supabase';
import { createDraftDish, uploadRecipePhoto, draftRecipe } from '../../lib/recipeCosting';
import Spinner from '../../components/ui/Spinner';
import BackButton from '../../components/ui/BackButton';

export default function NewRecipeScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isProRequired = /pro feature/i.test(error);

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
    setBusy(true);
    setError('');
    try {
      const id = await createDraftDish(supabase, organization.id, trimmed);
      if (photoUri) {
        await uploadRecipePhoto(supabase, organization.id, id, photoUri);
      }
      await draftRecipe(supabase, id);
      router.replace(`/recipes/${id}/review`);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err?.message ?? 'Could not draft recipe');
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.busyFill}>
          <Spinner size={28} />
          <Text style={styles.busyText}>Drafting your recipe…</Text>
          <Text style={styles.busySub}>This can take a few seconds while the AI reads your dish.</Text>
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
            <View style={[styles.inputWrap, error && !isProRequired ? styles.inputError : null]}>
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

          <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto} activeOpacity={0.7}>
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
              {isProRequired && (
                <TouchableOpacity onPress={() => router.push('/paywall')} activeOpacity={0.7}>
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
          >
            <Text style={styles.ctaText}>Draft with AI</Text>
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

  busyFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  busyText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  busySub: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});

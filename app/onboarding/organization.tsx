import TouchableOpacity from '../../components/ui/MotionTouchable';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import SafeAreaView from '../../components/ui/Screen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useOrganizationList, useUser } from '@clerk/clerk-expo';
import { useWorkspace } from '../../lib/workspaceContext';
import { useSupabaseForWorkspace } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';
import Spinner from '../../components/ui/Spinner';
export default function CreateWorkspace() {
  const router = useRouter();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const { user, isLoaded: userLoaded } = useUser();
  const { createOrganization, isLoaded } = useOrganizationList();
  const {
    organization,
    select,
    personalId,
    ready,
    error: workspaceError,
    refresh,
  } = useWorkspace();
  const raw = useSupabaseForWorkspace();
  const [type, setType] = useState<'personal' | 'business'>('personal');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const memberships = user?.organizationMemberships ?? [];
  useEffect(() => {
    if (!add && ready && organization) router.replace('/(tabs)');
  }, [add, ready, organization, router]);
  const choose = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await select(id);
      router.replace('/(tabs)');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (busy || !isLoaded) return;
    setError('');
    setBusy(true);
    try {
      let id: string;
      if (type === 'personal') {
        const { data, error: e } = await raw.rpc('create_personal_workspace', {
          p_name: name.trim() || 'My household',
        });
        if (e || !data)
          throw new Error('Could not create your household. Please retry.');
        id = data;
      } else {
        if (name.trim().length < 2)
          throw new Error('Enter your business name.');
        id = (await createOrganization({ name: name.trim() })).id;
      }
      await select(id);
      router.replace('/(tabs)');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!userLoaded || !isLoaded || !ready)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Spinner size={28} color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {add && (
            <TouchableOpacity onPress={() => router.back()} style={s.back}>
              <Text style={s.link}>Back</Text>
            </TouchableOpacity>
          )}
          <Text style={s.eyebrow}>YOUR SIFT, YOUR WAY</Text>
          <Text style={s.title}>{'A little clarity.\nFor home or work.'}</Text>
          <Text style={s.subtitle}>
            Keep household shopping and business purchasing in separate spaces.
            One login, clear boundaries.
          </Text>
          {!!personalId && (
            <TouchableOpacity
              style={s.existing}
              disabled={busy}
              onPress={() => choose(personalId)}
            >
              <Text style={s.link}>Open my household →</Text>
            </TouchableOpacity>
          )}
          {memberships.map((m) => (
            <TouchableOpacity
              key={m.organization.id}
              style={s.existing}
              disabled={busy}
              onPress={() => choose(m.organization.id)}
            >
              <Text style={s.link}>Open {m.organization.name} →</Text>
            </TouchableOpacity>
          ))}
          <View style={s.options}>
            {(['personal', 'business'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ selected: type === t }}
                style={[s.option, type === t && s.selected]}
                disabled={busy}
                onPress={() => {
                  setType(t);
                  setError('');
                  setName('');
                }}
              >
                <Text style={s.optionTitle}>
                  {t === 'personal' ? 'Personal' : 'Business'}
                </Text>
                <Text style={s.optionText}>
                  {t === 'personal'
                    ? 'Groceries & household essentials'
                    : 'Invoices & food costs'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>
            {type === 'personal'
              ? 'Household name (optional)'
              : 'Business name'}
          </Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            editable={!busy}
            maxLength={80}
            placeholder={
              type === 'personal' ? 'My household' : 'Rosa’s Kitchen'
            }
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="done"
            onSubmitEditing={create}
          />
          {!!(error || workspaceError) && (
            <Text accessibilityRole="alert" style={s.error}>
              {error || workspaceError}
            </Text>
          )}
          {workspaceError && (
            <TouchableOpacity
              onPress={() => refresh().catch((e) => setError(e.message))}
              style={s.back}
            >
              <Text style={s.link}>Retry loading workspaces</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            disabled={busy}
            onPress={create}
            style={[s.button, busy && { opacity: 0.6 }]}
          >
            <Text style={s.buttonText}>
              {busy
                ? 'Setting up…'
                : `Create ${type === 'personal' ? 'household' : 'business'}`}
            </Text>
          </TouchableOpacity>
          <Text style={s.note}>
            Start free. Add the other workspace later from Profile.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  back: { minHeight: 44, justifyContent: 'center' },
  eyebrow: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 32,
    lineHeight: 40,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 20,
  },
  options: { flexDirection: 'row', gap: 10, marginVertical: 14 },
  option: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    minHeight: 112,
  },
  selected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  optionTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 17,
    color: Colors.textPrimary,
  },
  optionText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  existing: { minHeight: 48, justifyContent: 'center' },
  link: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: Colors.primary },
  label: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.textPrimary,
    marginTop: 10,
    marginBottom: 8,
  },
  input: {
    borderRadius: 14,
    padding: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  button: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  buttonText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 16,
    color: '#fff',
  },
  error: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    lineHeight: 20,
    color: Colors.danger,
    marginTop: 12,
  },
  note: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
});

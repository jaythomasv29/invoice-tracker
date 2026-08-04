import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganizationList, useUser } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import Spinner from '../../components/ui/Spinner';

// Functional placeholder for the Owner path of PRD section 6.1 ("Create or
// join an organization"). The polished, animated onboarding experience is a
// separate, later phase — this screen exists so a brand-new Clerk user has
// somewhere to create their org before RLS-scoped data can load. Staff
// joining via invitation is a different flow (Clerk org invitations), not
// this screen.
const copy = {
  title: 'Set up your restaurant',
  subtitle: "This becomes your workspace — you'll invite your team to it next.",
  label: 'Restaurant name',
  placeholder: "Rosa's Kitchen",
  errorLabel: 'Enter your restaurant name.',
};

export default function CreateOrganizationScreen() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { createOrganization, setActive, isLoaded, userMemberships } =
    useOrganizationList({ userMemberships: true });
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const activatingRef = useRef(false);

  // A returning member is routed here with no *active* organization: Clerk does
  // not auto-activate an existing membership on a fresh session, and the
  // 'choose-organization' task lands everyone on this screen. Rather than force
  // a duplicate org (this screen can't select an existing one), activate the
  // one they already belong to and send them into the app. This is the "sign in
  // bounces me back to onboarding, not my dashboard" bug.
  //
  // Detect membership from user.organizationMemberships FIRST: it's a plain,
  // non-paginated array embedded in the user resource, populated the moment the
  // user loads — even during the pending task. The paginated `userMemberships`
  // list (below) can still read empty here, which is why activation never fired.
  const existingOrgId =
    user?.organizationMemberships?.[0]?.organization?.id ??
    userMemberships?.data?.[0]?.organization?.id ??
    null;

  useEffect(() => {
    if (!existingOrgId || activatingRef.current || !setActive) return;
    activatingRef.current = true;
    (async () => {
      try {
        await setActive({ organization: existingOrgId });
        router.replace('/(tabs)');
      } catch (e) {
        // Don't strand the user on a spinner: log it and let a later render retry.
        console.warn('[org-activate] failed to activate existing org', e);
        activatingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingOrgId, isLoaded]);

  // Don't flash the create-org form while membership state is still resolving,
  // or while we're activating an existing org — a returning user should see
  // only a brief loader before their dashboard.
  if (!userLoaded || !isLoaded || existingOrgId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.content, { alignItems: 'center', justifyContent: 'center' }]}>
          <Spinner size={28} color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const handleCreate = async () => {
    Haptics.selectionAsync();
    if (!isLoaded) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(copy.errorLabel);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const org = await createOrganization({ name: trimmed });
      await setActive({ organization: org.id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err?.errors?.[0]?.message ?? 'Could not create your workspace. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>

          <Text style={styles.label}>{copy.label}</Text>
          <TextInput
            style={[styles.input, !!error && styles.inputError]}
            value={name}
            onChangeText={(v) => { setName(v); setError(''); }}
            placeholder={copy.placeholder}
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <View style={styles.buttonContent}>
                <Spinner size={18} color="#fff" />
                <Text style={styles.buttonText}>Creating…</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 8, lineHeight: 20 },
  label: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, marginTop: 32, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary,
  },
  inputError: { borderColor: Colors.danger },
  errorText: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.danger, marginTop: 8 },
  button: {
    backgroundColor: Colors.primary, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttonText: { fontSize: 15.5, fontFamily: 'Manrope_700Bold', color: '#fff' },
});

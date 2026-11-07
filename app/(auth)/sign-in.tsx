import { Design } from '../../constants/Design';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import SafeAreaView from '../../components/ui/Screen';
import * as Haptics from 'expo-haptics';
import { useAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import Spinner from '../../components/ui/Spinner';
import { PRIVACY_POLICY_URL, TERMS_URL, openLegalUrl } from '../../constants/legal';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Set when the email has no account. Creating one is an explicit choice —
  // a typo or the wrong address must never silently create a new account.
  const [noAccountFor, setNoAccountFor] = useState<string | null>(null);

  const handleChange = (val: string) => {
    setEmail(val);
    setError('');
    setNoAccountFor(null);
  };

  const fail = (err: any, fallback = 'Something went wrong. Try again.') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? fallback);
  };
  const sessionExists = (err: any) => err?.errors?.some((e: any) => e.code === 'session_exists');

  const handleCreateAccount = async () => {
    if (!signUpLoaded || submitting || !noAccountFor) return;
    setSubmitting(true);
    setError('');
    try {
      await signUp.create({ emailAddress: noAccountFor });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      router.push({ pathname: '/(auth)/verify', params: { email: noAccountFor, mode: 'signUp' } });
    } catch (err: any) {
      if (sessionExists(err)) { router.replace('/(tabs)'); return; }
      fail(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (!signUpLoaded || !signInLoaded || submitting) return;

    // Clerk only allows one active session at a time — if a session was just
    // established (e.g. the redirect-away effect in (auth)/_layout hasn't
    // run yet), calling create() would throw 'session_exists' instead of
    // just taking the user in. Route them in directly rather than erroring.
    if (isSignedIn) {
      router.replace('/(tabs)');
      return;
    }

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNoAccountFor(null);
    try {
      // Sign-in first. Only an explicit "Create account" tap signs up.
      const attempt = await signIn.create({ identifier: trimmed });
      const emailFactor = attempt.supportedFirstFactors?.find(
        (f: any) => f.strategy === 'email_code'
      ) as any;
      if (!emailFactor) {
        throw { errors: [{ message: 'This account can’t sign in with an email code. Use password sign-in instead.' }] };
      }
      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: emailFactor.emailAddressId,
      });
      router.push({ pathname: '/(auth)/verify', params: { email: trimmed, mode: 'signIn' } });
    } catch (err: any) {
      if (sessionExists(err)) { router.replace('/(tabs)'); return; }
      if (err?.errors?.some((e: any) => e.code === 'form_identifier_not_found')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setNoAccountFor(trimmed);
        return;
      }
      fail(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)'))}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <View style={styles.backChevron} />
          </TouchableOpacity>

          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>S</Text>
            </View>
          </View>

          <Text style={styles.headline}>Sift</Text>
          <Text style={styles.sub}>
            Sign in with your email — no password needed.
            For household shopping and business purchasing.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email address</Text>
            <View style={[styles.inputWrap, error ? styles.inputError : null]}>
              <TextInput
                accessibilityLabel="Email address"
                style={styles.input}
                value={email}
                onChangeText={handleChange}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                autoFocus
              />
            </View>
            {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}
          </View>

          {noAccountFor ? (
            <View style={styles.noAccount} accessibilityRole="alert">
              <Text style={styles.noAccountTitle}>No Sift account for {noAccountFor}</Text>
              <Text style={styles.noAccountBody}>Check the spelling, or try the email your team invited. New to Sift? Create an account with this email.</Text>
              <TouchableOpacity
                style={[styles.btnSecondary, submitting && styles.btnDisabled]}
                onPress={() => { Haptics.selectionAsync(); handleCreateAccount(); }}
                disabled={submitting}
                accessibilityRole="button"
              >
                <Text style={styles.btnSecondaryText}>Create account</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, (!EMAIL_RE.test(email.trim()) || submitting) && styles.btnDisabled]}
            onPress={() => {
              Haptics.selectionAsync();
              handleContinue();
            }}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <View style={styles.btnContent}>
                <Spinner size={18} color="#fff" />
                <Text style={styles.btnText}>Sending…</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>Send verification code</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(auth)/password')} style={{minHeight:48,alignItems:'center',justifyContent:'center',marginTop:12}}>
            <Text style={styles.legalLink}>Sign in with password</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.legalLink}
              onPress={() => openLegalUrl(TERMS_URL, () => {})}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.legalLink}
              onPress={() => openLegalUrl(PRIVACY_POLICY_URL, () => {})}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, paddingTop: 12 },
  backBtn: {
    width: 44, height: 44, borderRadius: Design.radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 32,
  },
  backChevron: {
    width: 9, height: 9, borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: Colors.textPrimary, transform: [{ rotate: '-45deg' }], marginLeft: 3,
  },
  logoRow: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0, elevation: 0,
  },
  logoIconText: { fontSize: 22, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: 1 },
  headline: {
    fontSize: 32, fontFamily: 'Manrope_800ExtraBold',
    color: Colors.textPrimary, textAlign: 'center',
    letterSpacing: -1, marginBottom: 12,
  },
  sub: {
    fontSize: 15, fontFamily: 'Manrope_500Medium',
    color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: 40,
  },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 13, fontFamily: 'Manrope_700Bold',
    color: Colors.textPrimary, marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, height: 52,
  },
  inputError: { borderColor: Colors.danger },
  input: {
    flex: 1, fontSize: 17, fontFamily: 'Manrope_600SemiBold',
    color: Colors.textPrimary, height: '100%',
  },
  errorText: {
    fontSize: 12, fontFamily: 'Manrope_600SemiBold',
    color: Colors.danger, marginTop: 6,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Design.radius.pill, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0, elevation: 0,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  noAccount: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 8, marginBottom: 16,
  },
  noAccountTitle: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  noAccountBody: { fontSize: 13, lineHeight: 19, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary },
  btnSecondary: {
    marginTop: 4, minHeight: 48, borderRadius: Design.radius.pill, borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.primary },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#fff' },
  legal: {
    fontSize: 12, fontFamily: 'Manrope_500Medium',
    color: Colors.textTertiary, textAlign: 'center',
    lineHeight: 18, marginTop: 20,
  },
  legalLink: {
    color: Colors.textSecondary, textDecorationLine: 'underline',
  },
});

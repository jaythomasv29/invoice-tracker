import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  const handleChange = (val: string) => {
    setEmail(val);
    setError('');
  };

  const handleContinue = async () => {
    if (!signUpLoaded || !signInLoaded || submitting) return;

    // Clerk only allows one active session at a time — if a session was just
    // established (e.g. the redirect-away effect in (auth)/_layout hasn't
    // run yet), calling create() would throw 'session_exists' instead of
    // just taking the user in. Route them in directly rather than erroring.
    if (isSignedIn) {
      router.replace('/');
      return;
    }

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      // New email: Clerk creates the account and sends the first code.
      await signUp.create({ emailAddress: trimmed });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      router.push({ pathname: '/(auth)/verify', params: { email: trimmed, mode: 'signUp' } });
    } catch (signUpErr: any) {
      if (signUpErr?.errors?.some((e: any) => e.code === 'session_exists')) {
        router.replace('/');
        return;
      }
      const alreadyExists = signUpErr?.errors?.some(
        (e: any) => e.code === 'form_identifier_exists'
      );
      if (!alreadyExists) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(signUpErr?.errors?.[0]?.message ?? 'Something went wrong. Try again.');
        setSubmitting(false);
        return;
      }
      // Existing email: fall back to the sign-in flow instead.
      try {
        const attempt = await signIn.create({ identifier: trimmed });
        const emailFactor = attempt.supportedFirstFactors?.find(
          (f: any) => f.strategy === 'email_code'
        ) as any;
        if (!emailFactor) {
          throw { errors: [{ message: 'This account can’t sign in with an email code. Contact support.' }] };
        }
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailFactor.emailAddressId,
        });
        router.push({ pathname: '/(auth)/verify', params: { email: trimmed, mode: 'signIn' } });
      } catch (signInErr: any) {
        if (signInErr?.errors?.some((e: any) => e.code === 'session_exists')) {
          router.replace('/');
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(signInErr?.errors?.[0]?.message ?? 'Something went wrong. Try again.');
      }
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
            Built for independent restaurant operators.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email address</Text>
            <View style={[styles.inputWrap, error ? styles.inputError : null]}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={handleChange}
                placeholder="you@restaurant.com"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                autoFocus
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

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
    width: 40, height: 40, borderRadius: 12,
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
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  logoIconText: { fontSize: 22, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: 1 },
  headline: {
    fontSize: 28, fontFamily: 'Manrope_800ExtraBold',
    color: Colors.textPrimary, textAlign: 'center',
    letterSpacing: -0.5, marginBottom: 12,
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
    borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
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

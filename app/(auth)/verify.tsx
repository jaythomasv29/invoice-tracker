import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth, useSignIn, useSignUp } from "@clerk/clerk-expo";
import { Colors } from "../../constants/Colors";
import Spinner from "../../components/ui/Spinner";

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const router = useRouter();
  const { email, mode } = useLocalSearchParams<{ email: string; mode: 'signUp' | 'signIn' }>();
  const { isSignedIn } = useAuth();
  const { signUp, isLoaded: signUpLoaded, setActive: setActiveSignUp } = useSignUp();
  const { signIn, isLoaded: signInLoaded, setActive: setActiveSignIn } = useSignIn();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  const handleChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    setError("");
    if (digits.length === CODE_LENGTH) handleVerify(digits);
  };

  const handleVerify = async (c = code) => {
    if (!signUpLoaded || !signInLoaded || !signUp || !signIn || submitting) return;
    // A session may have just gone active (e.g. the redirect-away effect in
    // (auth)/_layout hasn't run yet) — attempting the code again would throw
    // 'session_exists' instead of just taking the user in.
    if (isSignedIn) {
      router.replace("/");
      return;
    }
    if (c.length < CODE_LENGTH) {
      setError("Enter the 6-digit code.");
      return;
    }

    // Clerk Organizations being enabled means every fresh session gets a
    // 'choose-organization' pending task before it's fully active — our own
    // navigate callback (rather than Clerk's web-only taskUrls) sends it to
    // the org-creation screen we already built; otherwise go straight in.
    const navigateAfterActive = async ({ session }: { session: { currentTask?: { key: string } | null } }) => {
      if (session.currentTask) {
        router.replace("/onboarding/organization");
      } else {
        router.replace("/");
      }
    };

    setSubmitting(true);
    setError("");
    try {
      if (mode === "signIn") {
        const attempt = await signIn.attemptFirstFactor({ strategy: "email_code", code: c });
        if (attempt.status === "complete") {
          await setActiveSignIn({ session: attempt.createdSessionId, navigate: navigateAfterActive });
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError("Couldn't verify that code. Try again.");
        }
      } else {
        const attempt = await signUp.attemptEmailAddressVerification({ code: c });
        if (attempt.status === "complete") {
          await setActiveSignUp({ session: attempt.createdSessionId, navigate: navigateAfterActive });
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError("Couldn't verify that code. Try again.");
        }
      }
    } catch (err: any) {
      if (err?.errors?.some((e: any) => e.code === "session_exists")) {
        router.replace("/");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err?.errors?.[0]?.message ?? "Couldn't verify that code. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || !signUp || !signIn) return;
    setResendSeconds(30);
    setError("");
    try {
      if (mode === "signIn") {
        const emailFactor = signIn.supportedFirstFactors?.find(
          (f: any) => f.strategy === "email_code"
        ) as any;
        if (!emailFactor) {
          setError("Couldn't resend the code. Try again.");
          return;
        }
        await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId });
      } else {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Couldn't resend the code.");
    }
  };

  const digits = code.padEnd(CODE_LENGTH, " ").split("");

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.headline}>Check your email</Text>
          <Text style={styles.sub}>
            We sent a 6-digit code to{"\n"}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => inputRef.current?.focus()}
            style={styles.codeRow}
          >
            {digits.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.digitBox,
                  i === code.length && styles.digitBoxActive,
                  error && styles.digitBoxError,
                ]}
              >
                <Text style={styles.digitText}>{d.trim()}</Text>
              </View>
            ))}
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            style={styles.hiddenInput}
            autoFocus
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.btn,
              (code.length < CODE_LENGTH || submitting) && styles.btnDisabled,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              handleVerify();
            }}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <View style={styles.btnContent}>
                <Spinner size={18} color="#fff" />
                <Text style={styles.btnText}>Verifying…</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>Verify & sign in</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              handleResend();
            }}
            disabled={resendSeconds > 0}
            style={styles.resendRow}
          >
            <Text
              style={[
                styles.resendText,
                resendSeconds > 0 && styles.resendDisabled,
              ]}
            >
              {resendSeconds > 0
                ? `Resend code in ${resendSeconds}s`
                : "Resend code"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, paddingTop: 20 },
  back: { marginBottom: 32 },
  backText: {
    fontSize: 15,
    fontFamily: "Manrope_600SemiBold",
    color: Colors.primary,
  },
  headline: {
    fontSize: 28,
    fontFamily: "Manrope_800ExtraBold",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  sub: {
    fontSize: 15,
    fontFamily: "Manrope_500Medium",
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 36,
  },
  emailHighlight: { fontFamily: "Manrope_700Bold", color: Colors.textPrimary },
  codeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    justifyContent: "center",
  },
  digitBox: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  digitBoxActive: { borderColor: Colors.primary },
  digitBoxError: { borderColor: Colors.danger },
  digitText: {
    fontSize: 22,
    fontFamily: "Manrope_700Bold",
    color: Colors.textPrimary,
  },
  hiddenInput: { position: "absolute", opacity: 0, height: 0 },
  errorText: {
    fontSize: 12,
    fontFamily: "Manrope_600SemiBold",
    color: Colors.danger,
    textAlign: "center",
    marginBottom: 12,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 16,
  },
  btnDisabled: { opacity: 0.5 },
  btnContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnText: { fontSize: 16, fontFamily: "Manrope_700Bold", color: "#fff" },
  resendRow: { alignItems: "center", marginTop: 16 },
  resendText: {
    fontSize: 14,
    fontFamily: "Manrope_600SemiBold",
    color: Colors.primary,
  },
  resendDisabled: { color: Colors.textTertiary },
});

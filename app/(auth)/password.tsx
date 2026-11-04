import { useState } from 'react';
import { Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import SafeAreaView from '../../components/ui/Screen';
import { Colors } from '../../constants/Colors';
import BackButton from '../../components/ui/BackButton';
import MotionTouchable from '../../components/ui/MotionTouchable';
import { TERMS_URL, PRIVACY_POLICY_URL, openLegalUrl } from '../../constants/legal';

export default function PasswordSignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!isLoaded || busy || !email.trim() || !password) return;
    setBusy(true); setError('');
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status !== 'complete' || !result.createdSessionId) {
        setError('Additional verification is required. Use email-code sign-in to continue.');
        return;
      }
      await setActive({ session: result.createdSessionId });
      setPassword('');
    } catch {
      setError('Could not sign in. Check your email and password, or use email-code sign-in.');
    } finally { setBusy(false); }
  }
  return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <BackButton onPress={() => router.back()} />
      <Text style={s.title}>Welcome back</Text>
      <Text style={s.body}>Sign in to an account with a password. Email-code sign-in is also available.</Text>
      <Text style={s.label}>Email address</Text>
      <TextInput accessibilityLabel="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" style={s.input} editable={!busy} />
      <Text style={s.label}>Password</Text>
      <TextInput accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoCapitalize="none" autoCorrect={false} style={s.input} editable={!busy} onSubmitEditing={() => void submit()} />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <MotionTouchable accessibilityRole="button" disabled={busy || !email.trim() || !password} onPress={() => void submit()} style={[s.button,(busy || !email.trim() || !password) && {opacity:0.5}]}><Text style={s.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text></MotionTouchable>
      <MotionTouchable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-in')} style={s.alternative}><Text style={s.link}>Use an email code instead</Text></MotionTouchable>
      <Text style={s.legal}>By signing in, you agree to the <Text style={s.link} onPress={() => openLegalUrl(TERMS_URL,()=>{})}>Terms</Text> and <Text style={s.link} onPress={() => openLegalUrl(PRIVACY_POLICY_URL,()=>{})}>Privacy Policy</Text>.</Text>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:Colors.background},content:{padding:24,gap:12,flexGrow:1},title:{fontFamily:'Manrope_800ExtraBold',fontSize:32,color:Colors.textPrimary,marginTop:24},body:{fontFamily:'Manrope_400Regular',fontSize:16,lineHeight:24,color:Colors.textSecondary,marginBottom:16},
  label:{fontFamily:'Manrope_600SemiBold',fontSize:14,color:Colors.textPrimary},input:{minHeight:54,borderRadius:14,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.surface,padding:14,fontFamily:'Manrope_500Medium',fontSize:16,color:Colors.textPrimary},button:{minHeight:54,borderRadius:16,backgroundColor:Colors.primary,alignItems:'center',justifyContent:'center',marginTop:12},buttonText:{fontFamily:'Manrope_700Bold',fontSize:16,color:'#fff'},alternative:{minHeight:48,alignItems:'center',justifyContent:'center'},link:{fontFamily:'Manrope_600SemiBold',color:Colors.primary},legal:{fontSize:12,lineHeight:20,color:Colors.textSecondary,textAlign:'center'},error:{fontSize:14,lineHeight:22,color:Colors.danger},
});

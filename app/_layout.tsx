import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import * as Sentry from '@sentry/react-native';
import { clerkTokenCache } from '../lib/clerkTokenCache';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Sentry.init is a no-op if dsn is undefined/empty, which is expected until
// a real project DSN is set in .env as EXPO_PUBLIC_SENTRY_DSN (see
// .env.example / SETUP.md). Must run at module scope, before anything else,
// so it can capture errors during app startup too.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
});

SplashScreen.preventAutoHideAsync();

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — copy .env.example to .env and fill in your Clerk publishable key.'
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={clerkTokenCache}>
        <ClerkLoaded>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="onboarding/organization" />
                <Stack.Screen name="scan/index" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="scan/review" />
                <Stack.Screen name="briefing" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="disputes" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="vendor/[id]" options={{ animation: 'fade_from_bottom' }} />
                <Stack.Screen name="invoice/[id]" options={{ animation: 'fade_from_bottom' }} />
              </Stack>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </ClerkLoaded>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

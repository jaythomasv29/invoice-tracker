import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth, useSession } from '@clerk/clerk-expo';

export default function AuthLayout() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: sessionLoaded, session } = useSession();

  useEffect(() => {
    if (!isLoaded || !sessionLoaded) return;
    // See app/index.tsx — a pending session must route to onboarding, not
    // sit here (Clerk refuses to start a new sign-up while one exists).
    if (session?.currentTask) {
      router.replace('/onboarding/organization');
      return;
    }
    if (isSignedIn) {
      router.replace('/');
    }
  }, [isLoaded, sessionLoaded, session, isSignedIn]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

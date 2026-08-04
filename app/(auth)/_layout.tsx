import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

export default function AuthLayout() {
  const router = useRouter();
  // treatPendingAsSignedOut:false so a `pending` (choose-organization) session
  // counts as signed in here — otherwise the just-verified user's pending
  // session reads as signed-out and we'd sit on the auth stack (Clerk then
  // refuses to start a new sign-up while a session exists). See app/index.tsx.
  const { isLoaded, isSignedIn, orgId } = useAuth({ treatPendingAsSignedOut: false });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return; // no session → stay on the auth stack
    // Navigate to the EXPLICIT destination, never bare '/'. `/` is ambiguous:
    // both app/index.tsx (the routing hub) and app/(auth)/index.tsx (this
    // group's welcome carousel) resolve to it, because `(auth)` is a transparent
    // route group. From inside the (auth) navigator, router.replace('/') lands
    // on (auth)/index — the WELCOME screen — instead of the root hub, and the
    // root index.tsx never runs. THAT was the post-verify bounce: setActive made
    // the session active, this guard fired replace('/'), and '/' meant "welcome".
    router.replace(orgId ? '/(tabs)' : '/onboarding/organization');
  }, [isLoaded, isSignedIn, orgId]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

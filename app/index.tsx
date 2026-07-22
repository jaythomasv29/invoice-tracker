import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth, useOrganization, useSession } from '@clerk/clerk-expo';

export default function Index() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: sessionLoaded, session } = useSession();
  const { isLoaded: orgLoaded, organization } = useOrganization();

  useEffect(() => {
    if (!isLoaded || !sessionLoaded) return;
    // A session with a pending task (e.g. 'choose-organization', enabled the
    // moment Clerk Organizations was turned on) is neither fully signed in
    // nor absent — isSignedIn is false for it, but Clerk still considers it
    // an existing session, so routing it to /(auth) would just dead-end.
    if (session?.currentTask) {
      router.replace('/onboarding/organization');
      return;
    }
    if (!isSignedIn) {
      router.replace('/(auth)');
      return;
    }
    if (!orgLoaded) return;
    router.replace(organization ? '/(tabs)' : '/onboarding/organization');
  }, [isLoaded, sessionLoaded, session, isSignedIn, orgLoaded, organization]);

  return null;
}

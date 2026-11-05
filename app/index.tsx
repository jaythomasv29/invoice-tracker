import { useWorkspace } from '../lib/workspaceContext';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

export default function Index() {
  const router = useRouter();
  // Legacy pending sessions and new user-owned Personal workspaces share this entry.
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });

  const {organization,ready}=useWorkspace();
  useEffect(() => {
    if (!isLoaded || !ready) return;
    if (!isSignedIn) {
      router.replace('/(auth)'); // no session at all
      return;
    }
    if (!organization?.id) {
      // Signed in but no active org: pending choose-organization (returning
      // member) or a brand-new user. The onboarding screen activates an
      // existing membership or creates one.
      router.replace('/onboarding/organization');
      return;
    }
    router.replace('/(tabs)'); // signed in with an active org
  }, [isLoaded, isSignedIn, ready, organization?.id, router]);

  return null;
}

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

export default function Index() {
  const router = useRouter();
  // treatPendingAsSignedOut:false surfaces a `pending` (choose-organization)
  // session so it isn't misread as signed-out. Route on `orgId` (the active org
  // from the session claims): present the instant setActive runs, so it also
  // sidesteps useOrganization() hydration lag.
  const { isLoaded, isSignedIn, orgId } = useAuth({ treatPendingAsSignedOut: false });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace('/(auth)'); // no session at all
      return;
    }
    if (!orgId) {
      // Signed in but no active org: pending choose-organization (returning
      // member) or a brand-new user. The onboarding screen activates an
      // existing membership or creates one.
      router.replace('/onboarding/organization');
      return;
    }
    router.replace('/(tabs)'); // signed in with an active org
  }, [isLoaded, isSignedIn, orgId]);

  return null;
}

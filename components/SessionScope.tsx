import { useLayoutEffect, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useStore } from '../store/useStore';
import { signOutPurchases } from '../lib/purchases';
import LoadingScreen from './LoadingScreen';
// Hide old tenant state before mounting any screens for the next identity.
export function SessionScope({ children }: { children: ReactNode }) {
  const { userId, orgId, sessionId } = useAuth({ treatPendingAsSignedOut: false });
  const scope = `${sessionId ?? ''}:${userId ?? ''}:${orgId ?? ''}`;
  const activeScope = useStore(s => s.activeScope);
  useLayoutEffect(() => {
    if (useStore.getState().activeScope === scope) return;
    useStore.setState({ ...useStore.getInitialState(), activeScope: scope }, true);
    if (!userId) void signOutPurchases().catch(() => {});
  }, [scope, userId]);
  return activeScope === scope ? <>{children}</> : <LoadingScreen />;
}

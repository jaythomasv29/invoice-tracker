import Touch from './ui/MotionTouchable';
import { Colors } from '../constants/Colors';
import { View, Text } from 'react-native';
import { useState } from 'react';
import { useWorkspace } from '../lib/workspaceContext';
import { useLayoutEffect, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useStore } from '../store/useStore';
import { signOutPurchases } from '../lib/purchases';
import LoadingScreen from './LoadingScreen';
// Hide old tenant state before mounting any screens for the next identity.
export function SessionScope({ children }: { children: ReactNode }) {
  const { userId, orgId, sessionId, signOut } = useAuth({
    treatPendingAsSignedOut: false,
  });
  const { organization, ready, error, refresh } = useWorkspace();
  const [retryError, setRetryError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const scope = `${sessionId ?? ''}:${userId ?? ''}:${organization?.id ?? orgId ?? ''}`;
  const activeScope = useStore((s) => s.activeScope);
  useLayoutEffect(() => {
    if (useStore.getState().activeScope === scope) return;
    useStore.setState(
      { ...useStore.getInitialState(), activeScope: scope },
      true,
    );
    if (!userId) void signOutPurchases().catch(() => {});
  }, [scope, userId]);
  if (userId && !ready) return <LoadingScreen />;
  if (userId && error)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 28,
          backgroundColor: Colors.background,
          gap: 20,
        }}
      >
        <Text style={{ fontSize: 20, fontFamily: 'Manrope_700Bold' }}>
          Let’s reconnect your workspace
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 23 }}>
          {retryError || error}
        </Text>
        <Touch
          disabled={retrying}
          accessibilityRole="button"
          style={{ minHeight: 48, justifyContent: 'center' }}
          onPress={() => {
            setRetrying(true);
            void refresh()
              .catch((e) => setRetryError(e.message))
              .finally(() => setRetrying(false));
          }}
        >
          <Text style={{ fontSize: 16, color: Colors.primary }}>
            {retrying ? 'Reconnecting…' : 'Try again'}
          </Text>
        </Touch>
        <Touch
          accessibilityRole="button"
          style={{ minHeight: 48, justifyContent: 'center' }}
          onPress={() => void signOut()}
        >
          <Text style={{ fontSize: 15, color: Colors.textSecondary }}>
            Sign out
          </Text>
        </Touch>
      </View>
    );
  return activeScope === scope ? <>{children}</> : <LoadingScreen />;
}

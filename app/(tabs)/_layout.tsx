import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth, useOrganization, useSession } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore } from '../../store/useStore';

// ColorValue from expo-router can be OpaqueColorValue; cast to any for style compatibility
function HomeIcon({ color }: { color: any }) {
  return (
    <View style={{ width: 22, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[{ position: 'absolute' as const, top: 0, left: 2, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }]} />
      <View style={[{ position: 'absolute' as const, bottom: 0, left: 5, width: 12, height: 11, backgroundColor: color, borderRadius: 2 }]} />
    </View>
  );
}

function ScanIcon({ color }: { color: any }) {
  return (
    <View style={{ width: 22, height: 20, borderWidth: 2, borderColor: color, borderRadius: 5, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 8, height: 8, borderWidth: 1.8, borderColor: color, borderRadius: 4 }} />
    </View>
  );
}

function AlertIcon({ color, hasUnread }: { color: any; hasUnread: boolean }) {
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 16, height: 16, borderWidth: 2, borderColor: color, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 2, height: 6, backgroundColor: color, borderRadius: 1, marginBottom: 1 }} />
        <View style={{ width: 2, height: 2, backgroundColor: color, borderRadius: 1 }} />
      </View>
      {hasUnread && (
        <View style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger, borderWidth: 1.5, borderColor: '#fff' }} />
      )}
    </View>
  );
}

function VendorIcon({ color }: { color: any }) {
  return (
    <View style={{ width: 18, height: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 7, height: 7, backgroundColor: color, borderRadius: 2 }} />
      ))}
    </View>
  );
}

function MoreIcon({ color }: { color: any }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center', height: 20 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: sessionLoaded, session } = useSession();
  const { isLoaded: orgLoaded, organization } = useOrganization();
  const unreadAlerts = useStore((s) => s.priceAlerts.filter((a) => !a.read).length);

  useEffect(() => {
    if (!isLoaded || !sessionLoaded) return;
    if (session?.currentTask) {
      router.replace('/onboarding/organization');
      return;
    }
    if (!isSignedIn) {
      router.replace('/(auth)');
      return;
    }
    if (orgLoaded && !organization) {
      router.replace('/onboarding/organization');
    }
  }, [isLoaded, sessionLoaded, session, isSignedIn, orgLoaded, organization]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan-tab"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => <ScanIcon color={color} />,
          tabBarButton: (props) => (
            <TouchableOpacity
              style={props.style}
              onPress={() => router.push('/scan')}
              accessibilityRole="button"
            >
              {props.children}
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <AlertIcon color={color} hasUnread={unreadAlerts > 0} />,
          tabBarBadge: unreadAlerts > 0 ? unreadAlerts : undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
      <Tabs.Screen
        name="vendors"
        options={{
          title: 'Vendors',
          tabBarIcon: ({ color }) => <VendorIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <MoreIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
    paddingTop: 6,
    paddingBottom: 4,
    height: 80,
  },
  tabLabel: { fontSize: 10, fontFamily: 'Manrope_700Bold', marginTop: 2 },
  badge: { backgroundColor: Colors.danger, fontSize: 10, fontFamily: 'Manrope_700Bold' },
});

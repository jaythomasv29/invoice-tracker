import { useScanQueue } from '../../components/ScanQueueProvider';
import GlassSurface from '../../components/ui/GlassSurface';
import { type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Design } from '../../constants/Design';
import { useWorkspace } from '../../lib/workspaceContext';
import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  View,
  Text,
  useWindowDimensions,
  StyleSheet,
  Pressable,
  Platform,
  GestureResponderEvent,
} from "react-native";
import Animated, {
  useReducedMotion,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  ReduceMotion,
  FadeInUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/clerk-expo";
import { Colors } from "../../constants/Colors";
import { useRevenueCatSync } from "../../hooks/useRevenueCatSync";
import { TourProvider } from "../../components/tour/TourProvider";
import { TourTarget } from "../../components/tour/TourTarget";
import SpotlightOverlay from "../../components/tour/SpotlightOverlay";
import DemoBanner from "../../components/tour/DemoBanner";

const SCAN_SIZE = 40; // diameter of the inline green scan circle
const ICON_SIZE = 24; // standardized icon box for every tab
const STROKE = 2; // standardized stroke weight

// Shared frame for the line icons: fixed 24×24 viewBox with consistent stroke
// weight and round joins, so every tab icon reads as one set. Children inherit
// stroke/strokeWidth from the parent Svg.
function IconBase({
  color,
  size = ICON_SIZE,
  children,
}: {
  color: any;
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

function HomeIcon({ color }: { color: any }) {
  return (
    <IconBase color={color}>
      <Path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </IconBase>
  );
}

function RecipeIcon({ color }: { color: any }) {
  return (
    <IconBase color={color}>
      <Circle cx="12" cy="12" r="8.5" />
      <Circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

function InvoicesIcon({ color }: { color: any }) {
  return (
    <IconBase color={color}>
      <Path d="M6 2h9l4 4v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <Path d="M14 2v5h5" />
      <Path d="M8 12h7M8 16h7" />
    </IconBase>
  );
}

function ProfileIcon({ color }: { color: any }) {
  return (
    <IconBase color={color}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </IconBase>
  );
}

function CameraIcon() {
  return (
    <IconBase color="#fff" size={22}>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="3.6" />
    </IconBase>
  );
}

// Subtle bounce on the icon itself when its tab becomes focused (no pill —
// just the built-in tint color change, like the reference).
function AnimatedTabIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const iconScale = useSharedValue(focused ? 1 : 0.92);

  useEffect(() => {
    iconScale.value = withSpring(focused ? 1 : 0.92, {
      damping: 24,
      stiffness: 260,
      reduceMotion: ReduceMotion.System,
    });
  }, [focused, iconScale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <View style={styles.iconSlot}>
      <Animated.View style={iconStyle}>{children}</Animated.View>
    </View>
  );
}

type TabButtonProps = Pick<BottomTabBarButtonProps,
  'children' | 'style' | 'onPress' | 'accessibilityState' | 'accessibilityLabel' | 'onLongPress' | 'testID' | 'disabled' | 'accessibilityLargeContentTitle' | 'accessibilityShowsLargeContentViewer'>;

// Preserve navigation's labels, long-press handling and test identifiers.
function TabButton({ children, style, onPress, accessibilityState, ...props }: TabButtonProps) {
  const scale = useSharedValue(1);
  const selected = useSharedValue(accessibilityState?.selected ? 1 : 0);
  useEffect(() => {
    selected.value = withTiming(accessibilityState?.selected ? 1 : 0, { duration: 220, reduceMotion: ReduceMotion.System });
  }, [accessibilityState?.selected, selected]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const selectionStyle = useAnimatedStyle(() => ({ opacity: selected.value }));
  return <Pressable {...props} accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'} accessibilityState={accessibilityState}
    onPress={event => { void Haptics.selectionAsync(); onPress?.(event); }}
    onPressIn={() => { scale.value = withSpring(0.96, { damping: 24, stiffness: 380, reduceMotion: ReduceMotion.System }); }}
    onPressOut={() => { scale.value = withSpring(1, { damping: 24, stiffness: 320, reduceMotion: ReduceMotion.System }); }}
    style={[style, styles.tabHitArea]}>
    <Animated.View style={[styles.selection, selectionStyle]} pointerEvents="none" />
    <Animated.View style={[styles.tabButtonInner, pressStyle]}>{children}</Animated.View>
  </Pressable>;
}

function ScanButton({
  onPress,
}: {
  onPress?: (e: GestureResponderEvent) => void;
}) {
  const {isPersonal}=useWorkspace();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      style={styles.scanBtnWrap}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.(e);
      }}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 24, stiffness: 300, reduceMotion: ReduceMotion.System });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 24, stiffness: 260, reduceMotion: ReduceMotion.System });
      }}
      accessibilityRole="button"
      accessibilityLabel={isPersonal?'Scan receipt':'Scan invoice'}
    >
      <Animated.View style={[styles.scanCircle, pressStyle]}>
        <CameraIcon />
      </Animated.View>
      <Text style={styles.scanLabel}>Scan</Text>
    </Pressable>
  );
}

// The shadow sits outside the clipped material; the labels stay on top of it.
function TabBarBackground() {
  return <Animated.View entering={FadeInUp.duration(380).reduceMotion(ReduceMotion.System)} style={styles.barSurface}><GlassSurface /></Animated.View>;
}

function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return [styles.tabBar, {
    bottom: Math.max(12, insets.bottom),
    height: 76 + Math.max(0, Math.min(fontScale, 2) - 1) * 20,
  }];
}

export default function TabLayout() {
  const { tasks: scanTasks } = useScanQueue();
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  // treatPendingAsSignedOut:false so a pending (choose-organization) session
  // isn't misread as signed-out here. Route on orgId (active org from the
  // session claims) — see app/index.tsx for the full rationale.
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const {organization,ready,isPersonal}=useWorkspace();
  const tabBarStyle = useTabBarStyle();

  // Bind RevenueCat's identity to the active org for the whole authenticated session.
  useRevenueCatSync();

  useEffect(() => {
    if (!isLoaded || !ready) return;
    if (!isSignedIn) {
      router.replace("/(auth)"); // no session at all
      return;
    }
    if (!organization?.id) {
      router.replace("/onboarding/organization"); // pending choose-org / no active org
      return;
    }
    // else: signed in with an active org — stay in the tabs.
  }, [isLoaded, isSignedIn, ready, organization?.id, router]);

  return (
    <TourProvider>
    <Tabs
      screenOptions={{
        animation: reducedMotion ? 'none' : 'fade',
        headerShown: false,
        tabBarStyle,
        tabBarBackground: () => <TabBarBackground />,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarButton: (props) => <TabButton style={props.style} onPress={props.onPress}
          onLongPress={props.onLongPress}
          accessibilityState={{ ...props.accessibilityState, selected: props['aria-selected'] ?? props.accessibilityState?.selected }}
          accessibilityLabel={props['aria-label'] ?? props.accessibilityLabel}
          accessibilityLargeContentTitle={props.accessibilityLargeContentTitle}
          accessibilityShowsLargeContentViewer={props.accessibilityShowsLargeContentViewer}
          testID={props.testID} disabled={props.disabled}>
          {props.children}
        </TabButton>,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <HomeIcon color={color} />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: "Recipes",
          href: isPersonal ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <RecipeIcon color={color} />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="scan-tab"
        options={{
          title: "",
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <TourTarget id="tab-scan" style={styles.scanBtnWrap}>
              <ScanButton onPress={() => router.push("/scan")} />
            </TourTarget>
          ),
        }}
      />
      <Tabs.Screen
        name="vendors"
        options={{
          title: isPersonal ? "Receipts" : "Invoices",
          tabBarBadge: scanTasks.length || undefined,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <InvoicesIcon color={color} />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <ProfileIcon color={color} />
            </AnimatedTabIcon>
          ),
        }}
      />
      {/* Alerts is no longer a tab — it's the bell in the Home header. Kept
          routable (href: null hides the tab button, the route still works). */}
      <Tabs.Screen name="alerts" options={{ href: null }} />
    </Tabs>
      <SpotlightOverlay />
      <DemoBanner />
    </TourProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 76,
    borderRadius: Design.radius.pill,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    paddingTop: 6,
    paddingBottom: 6,
    elevation: 0,
    shadowColor: Colors.hero,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    shadowOpacity: 0.12,
  },
  barSurface: {
    ...StyleSheet.absoluteFill,
    borderRadius: Design.radius.pill,
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.75)",
  },
  tabItem: { paddingVertical: 2 },
  tabHitArea: { minHeight: 52, borderRadius: 9999, marginHorizontal: 2 },
  selection: { ...StyleSheet.absoluteFill, borderRadius: 9999, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.borderLight },
  tabLabel: { fontSize: 11, fontFamily: "Manrope_700Bold", marginTop: 3 },
  scanLabel: { fontSize: 11, fontFamily: "Manrope_700Bold", color: Colors.primaryDark, marginTop: 3 },

  tabButtonInner: { flex: 1, alignItems: "center", justifyContent: "center" },

  iconSlot: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },

  scanBtnWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Inline green circle sitting in the row with the other icons — just larger
  // and filled, so Scan reads as the primary action without any carved notch.
  scanCircle: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderRadius: SCAN_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 0,
  },
});

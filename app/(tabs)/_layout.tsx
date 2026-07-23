import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  View,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useAuth, useOrganization, useSession } from "@clerk/clerk-expo";
import { Colors } from "../../constants/Colors";

const SCAN_SIZE = 46; // diameter of the inline green scan circle
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
      damping: 12,
      stiffness: 260,
    });
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <View style={styles.iconSlot}>
      <Animated.View style={iconStyle}>{children}</Animated.View>
    </View>
  );
}

type TabButtonProps = {
  children: React.ReactNode;
  style?: any;
  onPress?: (e: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
  testID?: string;
};

// Shared press feedback (scale + haptic) for the regular tab buttons.
function TabButton({
  children,
  style,
  onPress,
  accessibilityState,
  testID,
}: TabButtonProps) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      testID={testID}
      onPress={(e: GestureResponderEvent) => {
        Haptics.selectionAsync();
        onPress?.(e);
      }}
      onPressIn={() => {
        scale.value = withSpring(0.88, { damping: 15, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
      }}
      style={style}
    >
      <Animated.View style={[styles.tabButtonInner, pressStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function ScanButton({
  onPress,
}: {
  onPress?: (e: GestureResponderEvent) => void;
}) {
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
        scale.value = withSpring(0.9, { damping: 14, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      }}
      accessibilityRole="button"
    >
      <Animated.View style={[styles.scanCircle, pressStyle]}>
        <CameraIcon />
      </Animated.View>
    </Pressable>
  );
}

// Frosted "liquid glass" material behind the pill: a real backdrop blur of
// whatever content scrolls underneath, warmed with a faint white tint and a
// bright hairline edge so it catches light like Apple's glass surfaces.
function GlassBackground() {
  return (
    <View style={styles.glassClip}>
      <BlurView
        intensity={15}
        tint="light"
        blurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassTint} />
      <View style={styles.glassEdge} />
    </View>
  );
}

// Builds the floating-pill tab bar style, lifted off the bottom by the safe-area
// inset so it clears the home indicator on notched devices. The bar is absolutely
// positioned so content scrolls *under* it — that's what gives the glass blur
// something real to frost.
function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  // Flush to the very bottom edge. Extend the bar down into the safe area and
  // pad its contents up by that inset so icons/labels clear the home indicator.
  return [
    styles.tabBar,
    { bottom: 0, height: 70 + insets.bottom, paddingBottom: insets.bottom },
  ];
}

export default function TabLayout() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: sessionLoaded, session } = useSession();
  const { isLoaded: orgLoaded, organization } = useOrganization();
  const tabBarStyle = useTabBarStyle();

  useEffect(() => {
    if (!isLoaded || !sessionLoaded) return;
    if (session?.currentTask) {
      router.replace("/onboarding/organization");
      return;
    }
    if (!isSignedIn) {
      router.replace("/(auth)");
      return;
    }
    if (orgLoaded && !organization) {
      router.replace("/onboarding/organization");
    }
  }, [isLoaded, sessionLoaded, session, isSignedIn, orgLoaded, organization]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarBackground: () => <GlassBackground />,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarButton: (props) => (
          <TabButton
            style={props.style}
            onPress={
              props.onPress as ((e: GestureResponderEvent) => void) | undefined
            }
            accessibilityState={props.accessibilityState}
            testID={props.testID}
          >
            {props.children}
          </TabButton>
        ),
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
            <ScanButton onPress={() => router.push("/scan")} />
          ),
        }}
      />
      <Tabs.Screen
        name="vendors"
        options={{
          title: "Invoices",
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
  );
}

const styles = StyleSheet.create({
  // A detached, rounded glass "pill" floating over the content. Transparent
  // itself — the frosted material is painted by GlassBackground behind it.
  tabBar: {
    position: "absolute",
    left: 28,
    right: 28,
    height: 70,
    borderRadius: 26,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    paddingTop: 0,
    paddingBottom: 0,
    // Soft drop shadow all around (it's floating, so the shadow isn't just on top).
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 12,
  },
  // Rounded clip for the glass layers; matches the bar's radius. overflow hidden
  // keeps the blur inside the pill; the shadow lives on the (unclipped) bar above.
  glassClip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  // Faint white wash over the blur so icons/labels keep contrast and it reads
  // as a light glass surface rather than a plain blur.
  glassTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  // Bright hairline edge — the "lit rim" that sells the glass look.
  glassEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.7)",
  },
  tabLabel: { fontSize: 11, fontFamily: "Manrope_700Bold", marginTop: 4 },
  badge: {
    backgroundColor: Colors.danger,
    fontSize: 10,
    fontFamily: "Manrope_700Bold",
  },

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
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});

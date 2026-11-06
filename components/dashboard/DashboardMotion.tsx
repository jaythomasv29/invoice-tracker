import { createContext, useContext, type ReactNode } from 'react';
import { type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, ReduceMotion, useAnimatedReaction, useAnimatedStyle, useDerivedValue,
  useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue,
} from 'react-native-reanimated';

export type DashboardMotionState = {
  scrollY: SharedValue<number>;
  viewport: SharedValue<number>;
  epoch: SharedValue<number>;
};
export const DashboardMotionContext = createContext<DashboardMotionState | null>(null);
const OriginContext = createContext<SharedValue<number> | null>(null);

/** Animate on actual viewport entry, once per open/data cycle, entirely on the UI thread.
 * Keep stable keys: replaying the entrance must never reset controls or period selections.
 * Direct scroll children supply their origin to nested summary panels.
 */
export function RevealPanel({ children, delay = 0, animate = true, style }: {
  children: ReactNode; delay?: number; animate?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const motion = useContext(DashboardMotionContext);
  const parentOrigin = useContext(OriginContext);
  const reduced = useReducedMotion();
  const top = useSharedValue(-1);
  const height = useSharedValue(0);
  const progress = useSharedValue(0);
  const revealed = useSharedValue(false);
  const lastEpoch = useSharedValue(-1);
  const origin = useDerivedValue(() => (parentOrigin?.value ?? 0) + Math.max(0, top.value));
  useAnimatedReaction(
    () => ({
      visible: top.value >= 0 && height.value > 0 && !!motion && motion.viewport.value > 0
        && origin.value < motion.scrollY.value + motion.viewport.value - 16
        && origin.value + height.value > motion.scrollY.value,
      epoch: motion?.epoch.value ?? 0,
    }),
    ({ visible, epoch }) => {
      if (epoch !== lastEpoch.value) {
        lastEpoch.value = epoch;
        revealed.value = false;
        // Subtle refresh, full entrance for content that has not yet been seen.
        progress.value = visible ? Math.min(progress.value, 0.25) : 0;
      }
      if (visible && !revealed.value) {
        revealed.value = true;
        progress.value = withDelay(Math.min(delay, 120), withTiming(1, {
          duration: 460, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
        }), ReduceMotion.System);
      }
    },
  );
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: !motion || reduced || !animate ? 1 : progress.value,
    transform: [{ translateY: !motion || reduced || !animate ? 0 : (1 - progress.value) * 14 }],
  }));
  const onLayout = (event: LayoutChangeEvent) => {
    top.value = event.nativeEvent.layout.y;
    height.value = event.nativeEvent.layout.height;
  };
  return <Animated.View collapsable={false} onLayout={onLayout} style={[style, animatedStyle]}>
    <OriginContext.Provider value={origin}>{children}</OriginContext.Provider>
  </Animated.View>;
}

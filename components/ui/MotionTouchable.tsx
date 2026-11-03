import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, ReduceMotion } from 'react-native-reanimated';
const NativeTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/** UI-thread press response; keeps native touch, disabled and accessibility behavior. */
export default function MotionTouchable({ style, onPressIn, onPressOut, ...props }: TouchableOpacityProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <NativeTouchable {...props} style={[style, animatedStyle]}
    onPressIn={event => { scale.value = withSpring(0.975, { damping: 24, stiffness: 420, reduceMotion: ReduceMotion.System }); onPressIn?.(event); }}
    onPressOut={event => { scale.value = withSpring(1, { damping: 22, stiffness: 340, reduceMotion: ReduceMotion.System }); onPressOut?.(event); }} />;
}

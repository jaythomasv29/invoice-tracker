import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';

type SpinnerProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

// Reusable rotating-ring spinner, generalized from the ProcessingSpinner
// built for app/scan/index.tsx. Unlike that stage-driven version, this one
// simply spins continuously for as long as it's mounted — no start/stop
// wiring required from the caller.
export default function Spinner({ size = 20, color = Colors.primary, style }: SpinnerProps) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1);
    return () => cancelAnimation(spin);
  }, [spin]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const borderWidth = Math.max(2, size * 0.09);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: 'rgba(0,0,0,0.12)',
          borderTopColor: color,
        },
        spinnerStyle,
        style,
      ]}
    />
  );
}

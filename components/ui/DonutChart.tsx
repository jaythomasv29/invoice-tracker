import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Colors } from '../../constants/Colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface DonutSegment {
  key: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

export default function DonutChart({ segments, size = 60, strokeWidth = 10 }: DonutChartProps) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);

  // Reveal progress for the "draw in" animation — replayed whenever the
  // underlying values change (e.g. a live Supabase fetch resolves), so the
  // ring animates to its new shape instead of snapping instantly. Classic
  // RN Animated (not reanimated) drives a single numeric strokeDashoffset
  // per segment — the same proven pattern already used by Toast.tsx —
  // rather than templating strokeDasharray strings on the UI thread, which
  // is a much more fragile combination with react-native-svg.
  const progress = useRef(new Animated.Value(0)).current;
  const segmentsKey = segments.map((s) => `${s.key}:${s.value}`).join('|');

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 650, useNativeDriver: false }).start();
  }, [segmentsKey, total, progress]);

  if (total === 0) {
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r} stroke={Colors.border} strokeWidth={strokeWidth} fill="none" />
        </Svg>
      </View>
    );
  }

  let cumulative = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          {segments.filter((s) => s.value > 0).map((s) => {
            const rawLen = (s.value / total) * circumference;
            const gap = Math.min(3, rawLen * 0.3);
            const drawLen = Math.max(rawLen - gap, 1);
            const offset = -cumulative;
            cumulative += rawLen;

            const dashOffset = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [offset + drawLen, offset],
            });

            return (
              <AnimatedCircle
                key={s.key}
                cx={cx}
                cy={cy}
                r={r}
                stroke={s.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${drawLen} ${circumference - drawLen}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

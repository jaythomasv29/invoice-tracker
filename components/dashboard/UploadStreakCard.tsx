import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence,
  withDelay, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/Colors';
import { useUploadStreak } from '../../hooks/useUploadStreak';

// Milliseconds until the next LOCAL midnight (device calendar, not UTC), so a
// 23:59 upload still counts for the correct local day and the countdown targets
// the moment the streak is actually at risk of breaking.
function msUntilLocalMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function formatHMS(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function FlameIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2c.4 3.2-1.6 4.6-3 6.2C7.4 10 6 11.7 6 14.2A6 6 0 0 0 18 14.2c0-2.1-.9-3.6-2-5-.4 1-1 1.7-1.9 2.1.7-2.2.2-4.6-1.6-6.4-.2-.2-.4-.5-.5-2.9Z" />
    </Svg>
  );
}

// Daily upload-streak habit widget. Self-contained: owns the streak hook and
// re-fetches on focus, so it recomputes after a save with no cross-screen
// wiring. A live countdown to local midnight (the app's only ticking clock)
// runs only while today is unlogged; once claimed it's replaced by a static
// "logged today" chip and the interval tears down.
export default function UploadStreakCard({ onScan }: { onScan: () => void }) {
  const { streak, loggedToday, longestStreak, refresh } = useUploadStreak();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Live countdown — gated on `loggedToday` so it never ticks (or re-renders)
  // once the day is claimed, and always cleans up.
  const [remaining, setRemaining] = useState(() => formatHMS(msUntilLocalMidnight()));
  useEffect(() => {
    if (loggedToday) return;
    const tick = () => setRemaining(formatHMS(msUntilLocalMidnight()));
    tick(); // paint immediately, no 1s blank
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [loggedToday]);

  // Subtle infinite flicker on the lit flame (small amplitude — premium, not
  // cartoonish). Only animates when logged today.
  const flicker = useSharedValue(1);
  useEffect(() => {
    if (loggedToday) {
      flicker.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      flicker.value = 1;
    }
  }, [loggedToday, flicker]);
  const flickerStyle = useAnimatedStyle(() => ({
    opacity: loggedToday ? 0.9 + flicker.value * 0.1 : 1,
    transform: [{ scale: loggedToday ? 0.98 + flicker.value * 0.04 : 1 }],
  }));

  // Celebration pop when the streak genuinely increases (fires on refocus after
  // a save, never on first mount).
  const pop = useSharedValue(1);
  const prevStreak = useRef<number | null>(null);
  useEffect(() => {
    if (prevStreak.current !== null && streak > prevStreak.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pop.value = 0;
      pop.value = withDelay(
        100,
        withSequence(
          withTiming(1.18, { duration: 180 }),
          withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
        ),
      );
    }
    prevStreak.current = streak;
  }, [streak, pop]);
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value === 0 ? 1 : pop.value }],
  }));

  const hasStreak = streak > 0;
  const flameColor = hasStreak
    ? loggedToday
      ? Colors.primary
      : Colors.warning
    : Colors.textTertiary;
  const flameWrapStyle = {
    backgroundColor: hasStreak
      ? loggedToday
        ? Colors.primaryLight
        : Colors.warningLight
      : Colors.background,
  };

  const title = hasStreak ? `${streak}-day streak` : 'Start your streak';
  const subtitle = hasStreak
    ? loggedToday
      ? 'Nice — you logged an invoice today. Keep it going tomorrow.'
      : 'Log an invoice before midnight to keep it going.'
    : 'Scan an invoice today to begin your streak.';
  const showBest = longestStreak > streak && longestStreak > 1;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Animated.View
          style={[styles.flameWrap, flameWrapStyle, { opacity: hasStreak && !loggedToday ? 0.55 : 1 }, flickerStyle]}
        >
          <FlameIcon color={flameColor} />
        </Animated.View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            {hasStreak && (
              <Animated.Text style={[styles.streakNum, popStyle]}>{streak}</Animated.Text>
            )}
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
          {showBest && <Text style={styles.best}>Best: {longestStreak} days</Text>}
        </View>
      </View>

      <View style={styles.bottomRow}>
        {loggedToday ? (
          <View style={styles.loggedChip}>
            <Text style={styles.loggedChipText}>Logged today ✓</Text>
          </View>
        ) : (
          <View style={styles.countdownPill}>
            <Text style={styles.countdownLabel}>Resets in</Text>
            <Text style={styles.countdownValue}>{remaining}</Text>
          </View>
        )}
        {!loggedToday && (
          <TouchableOpacity style={styles.cta} onPress={onScan} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Scan an invoice</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.border, padding: 18,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 18,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flameWrap: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakNum: {
    fontSize: 24, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5,
  },
  title: { flexShrink: 1, fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  subtitle: { fontSize: 12.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  best: { fontSize: 11, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary, marginTop: 4 },

  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  countdownPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.warning + '18', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  countdownLabel: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: Colors.warning + 'B0' },
  countdownValue: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: Colors.warning, letterSpacing: 0.5 },
  loggedChip: {
    backgroundColor: Colors.primaryLight, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  loggedChipText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },
  cta: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 11,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  ctaText: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: -0.1 },
});

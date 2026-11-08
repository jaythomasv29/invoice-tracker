import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../constants/Colors';
import { kitchenProgress } from '../../lib/kitchenProgress';
import type { SpendInvoice } from '../../lib/spendSummary';
import { useWorkspace } from '../../lib/workspaceContext';
import Touch from '../ui/MotionTouchable';

/** An all-time saved-history milestone, independent of the selected spend period. */
export default function HistoryMilestone({ invoices, loading, onPress }: {
  invoices: SpendInvoice[]; loading: boolean; onPress: () => void;
}) {
  const { isPersonal } = useWorkspace();
  const progress = kitchenProgress(invoices);
  const earned = progress.badges.filter(badge => badge.earned).at(-1);
  const noun = isPersonal ? 'receipts' : 'invoices';
  const fill = useSharedValue(0);
  useEffect(() => {
    if (!loading) fill.value = withTiming(progress.fraction, {
      duration: 600, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
    });
  }, [loading, progress.fraction, fill]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  return <Touch onPress={onPress} style={s.card} accessibilityRole="button"
    accessibilityLabel={loading ? 'Updating saved history. Open your library.' : `${progress.count} saved ${noun} all time. Next milestone: ${progress.target}. ${earned ? `${earned.value}-save badge earned. ` : ''}Open your library.`}>
    <View style={s.top}>
      <View style={s.titleGroup}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.accent} strokeWidth={1.8} strokeLinejoin="round" accessible={false}><Path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></Svg>
        <Text style={s.title}>{progress.count ? 'Your history is growing' : `Save your first ${isPersonal ? 'receipt' : 'invoice'}`}</Text>
      </View>
      {!loading && earned && <View style={s.badge}><Text style={s.badgeText}>✓ {earned.value} saved</Text></View>}
    </View>
    <View style={s.row}><Text style={s.caption}>SAVED · NEXT MILESTONE</Text><Text style={s.count}>{loading ? '—' : `${progress.count} / ${progress.target}`}</Text></View>
    <View style={s.track} accessible={false}><Animated.View style={[s.fill, fillStyle]} /></View>
    <Text style={s.note}>{loading ? 'Updating your progress…' : `Open your ${isPersonal ? 'receipt' : 'invoice'} library`} <Text>›</Text></Text>
  </Touch>;
}
const s = StyleSheet.create({
  card: { marginTop: 20, padding: 16, gap: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(196,215,205,0.2)' },
  top: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexGrow: 1, flexShrink: 1 },
  title: { flexShrink: 1, fontFamily: 'Manrope_700Bold', fontSize: 14, color: Colors.heroText },
  badge: { borderRadius: 9999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: Colors.accent },
  badgeText: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: Colors.hero },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  caption: { fontFamily: 'Manrope_600SemiBold', fontSize: 10, letterSpacing: 0.8, color: Colors.heroMuted },
  count: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: Colors.accent, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(196,215,205,0.2)', overflow: 'hidden' },
  fill: { width: '100%', height: 6, borderRadius: 3, backgroundColor: Colors.accent, transformOrigin: 'left center' },
  note: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18, color: Colors.heroMuted },
});

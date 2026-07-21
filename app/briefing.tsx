import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { useStore } from '../store/useStore';
import Toast from '../components/ui/Toast';

const BRIEFING_TEXT = `$3,180 spent across 4 vendors, up 6% vs last week. Chicken breast from Cascade is up $0.31/lb (11%) — your second increase this month. Extra firm tofu is 15% cheaper at Golden State Provisions for the same case size. 2 items were flagged short, $47 total — worth a call to your Cascade rep.`;

const METRICS = [
  { id: 'spend', label: 'Spend this week', value: '$3,180 · ↑6%', color: Colors.vendorCascade, bg: Colors.primaryLight },
  { id: 'mover', label: 'Top mover', value: 'Chicken Breast · +11% (Cascade)', color: Colors.warning, bg: Colors.warningLight },
  { id: 'xvendor', label: 'Cross-vendor tip', value: 'Tofu · 15% cheaper at Golden State', color: Colors.vendorGolden, bg: '#EEF2FF' },
  { id: 'verify', label: 'Verified', value: '2 items short · $47 to dispute', color: Colors.danger, bg: Colors.dangerLight },
];

export default function BriefingScreen() {
  const router = useRouter();
  const { showToast } = useStore();

  const handleShare = async () => {
    try {
      await Share.share({ message: `Invoice Intelligence — Weekly Briefing\n\n${BRIEFING_TEXT}` });
    } catch {
      showToast('Unable to share');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <View style={styles.backChevron} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>This week's briefing</Text>
          <Text style={styles.headerDate}>Jul 8 – Jul 14, 2026</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* AI Summary card — dark gradient */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryBadgeRow}>
            <View style={styles.summaryIcon}>
              <View style={styles.summaryIconDiamond} />
            </View>
            <Text style={styles.summaryBadge}>AI SUMMARY</Text>
          </View>
          <Text style={styles.summaryText}>
            <Text style={styles.summaryBold}>$3,180 spent across 4 vendors, up 6% vs last week.</Text>
            {' '}Chicken breast from Cascade is up $0.31/lb (11%) — your second increase this month. Extra firm tofu is 15% cheaper at Golden State Provisions for the same case size. 2 items were flagged short, $47 total — worth a call to your Cascade rep.
          </Text>
        </View>

        {/* Metric cards */}
        {METRICS.map((m) => (
          <View key={m.id} style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: m.bg }]}>
              <View style={[styles.metricDot, { backgroundColor: m.color }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricValue}>{m.value}</Text>
            </View>
          </View>
        ))}

        {/* Share button */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Text style={styles.shareBtnText}>Share with bookkeeper</Text>
        </TouchableOpacity>
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backChevron: {
    width: 9, height: 9, borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: Colors.textPrimary, transform: [{ rotate: '-45deg' }], marginLeft: 3,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  headerDate: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },

  scroll: { padding: 16, gap: 14, paddingBottom: 40 },

  summaryCard: {
    borderRadius: 20, padding: 20,
    backgroundColor: '#1E2235',
    shadowColor: '#1E2235', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 22,
  },
  summaryBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  summaryIcon: {
    width: 24, height: 24, borderRadius: 8, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryIconDiamond: {
    width: 8, height: 8, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderRadius: 2,
  },
  summaryBadge: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
  },
  summaryText: {
    fontSize: 15.5, fontFamily: 'Manrope_600SemiBold',
    color: 'rgba(245,245,255,0.93)', lineHeight: 26,
  },
  summaryBold: { fontFamily: 'Manrope_800ExtraBold', color: '#fff' },

  metricCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, paddingHorizontal: 15,
    flexDirection: 'row', alignItems: 'center', gap: 13,
  },
  metricIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  metricDot: { width: 9, height: 9, borderRadius: 4.5 },
  metricLabel: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  metricValue: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, marginTop: 1 },

  shareBtn: {
    backgroundColor: Colors.surface, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  shareBtnText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
});

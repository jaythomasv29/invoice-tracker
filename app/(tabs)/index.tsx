import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import Toast from '../../components/ui/Toast';
import DonutChart from '../../components/ui/DonutChart';
import Spinner from '../../components/ui/Spinner';
import { initialsFor } from '../../lib/initials';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_PAD = 16;
const CHART_H = 120;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const restaurantName = organization?.name ?? '';
  const userInitials = initialsFor(restaurantName);
  const {
    vendors,
    weekTotal, weekPctChange,
    dayData, selectedDay, selectDay, categorySpend,
    verificationBreakdown,
    flaggedShortAmount, flaggedShortCount, disputedItems,
    priceAlerts, toast,
    todayInvoiceCount, fetchTodayInvoiceCount, fetchDeliverySnapshot, fetchDashboardSummary, fetchPriceAlerts,
  } = useStore();

  const topAlert = priceAlerts.find((a) => !a.read);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (organization?.id) {
        setIsLoadingSummary(true);
        Promise.all([
          fetchTodayInvoiceCount(supabase, organization.id),
          fetchDeliverySnapshot(supabase, organization.id),
          fetchDashboardSummary(supabase, organization.id),
          fetchPriceAlerts(supabase, organization.id),
        ]).finally(() => setIsLoadingSummary(false));
      }
    }, [organization?.id, supabase, fetchTodayInvoiceCount, fetchDeliverySnapshot, fetchDashboardSummary, fetchPriceAlerts])
  );

  const { received, missing, pending } = verificationBreakdown;
  const verifiedCount = received + missing;
  const verifiedTotal = verifiedCount + pending;
  const verifiedPct = verifiedTotal > 0 ? Math.round((verifiedCount / verifiedTotal) * 100) : 0;
  const verifySegments = [
    { key: 'received', label: 'Received', value: received, color: Colors.primary },
    { key: 'missing', label: 'Missing', value: missing, color: Colors.danger },
    { key: 'pending', label: 'Pending', value: pending, color: Colors.textTertiary },
  ];

  const recentDisputes = disputedItems.slice(0, 2);

  const maxDay = Math.max(1, ...dayData.map((d) => d.total));

  const handleBarPress = useCallback((i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectDay(i);
  }, [selectDay]);

  const selData = selectedDay !== null ? dayData[selectedDay] : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.restaurantName} numberOfLines={1}>{restaurantName}</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/(tabs)/alerts')}
            activeOpacity={0.7}
          >
            <BellIcon />
            {priceAlerts.filter((a) => !a.read).length > 0 && (
              <View style={styles.alertDot} />
            )}
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Spend Card */}
        <View style={styles.card}>
          <View style={styles.spendTop}>
            <View>
              <View style={styles.spendLabelRow}>
                <Text style={styles.spendLabel}>This week's spend</Text>
                {isLoadingSummary && <Spinner size={12} color={Colors.textSecondary} />}
              </View>
              <Text style={styles.spendAmount}>${weekTotal.toLocaleString()}</Text>
              <View style={styles.spendChange}>
                <Text style={[styles.spendChangeArrow, weekPctChange > 0 && styles.spendChangeUp]}>
                  {weekPctChange >= 0 ? '↑' : '↓'}
                </Text>
                <Text style={[styles.spendChangePct, weekPctChange > 0 && styles.spendChangeUp]}>
                  {Math.abs(weekPctChange)}%
                </Text>
                <Text style={styles.spendChangeLabel}> vs last week</Text>
              </View>
            </View>
            <View style={styles.periodBadge}>
              <Text style={styles.periodText}>7d ▾</Text>
            </View>
          </View>

          {/* Breakdown popup */}
          {selData && (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownLabel}>{dayData[selectedDay!].label}</Text>
              {selData.breakdown.map((b, i) => (
                <View key={i} style={styles.breakdownRow}>
                  <Text style={styles.breakdownName} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.breakdownAmt}>${b.amount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Legend */}
          {vendors.length > 0 && (
            <View style={styles.legend}>
              {[...vendors]
                .sort((a, b) => b.weekSpend - a.weekSpend)
                .slice(0, 4)
                .map((v) => (
                  <View key={v.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: v.color }]} />
                    <Text style={styles.legendText}>{v.name.split(' ')[0]}</Text>
                  </View>
                ))}
            </View>
          )}

          {/* Bar chart */}
          <View style={styles.chart}>
            {dayData.map((d, i) => {
              const isDimmed = selectedDay !== null && selectedDay !== i;
              const isSelected = selectedDay === i;
              const barH = Math.max(Math.round((d.total / maxDay) * (CHART_H - 24)), 6);

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.barCol, isDimmed && { opacity: 0.3 }]}
                  onPress={() => handleBarPress(i)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.barStack, { height: CHART_H - 24 }]}>
                    <View style={{ flex: 1 }} />
                    <View style={{ width: '100%', overflow: 'hidden', borderRadius: 5 }}>
                      {d.breakdown.map((seg, si) => {
                        const segH = Math.max(Math.round((seg.amount / d.total) * barH), 3);
                        return (
                          <View key={si} style={{ width: '100%', height: segH, backgroundColor: seg.color }} />
                        );
                      })}
                    </View>
                  </View>
                  <Text style={[styles.barLabel, isSelected && styles.barLabelActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Briefing card */}
        <TouchableOpacity
          style={[styles.card, styles.briefingCard]}
          onPress={() => router.push('/briefing')}
          activeOpacity={0.85}
        >
          <View style={styles.briefingHeader}>
            <Text style={styles.briefingHeaderLabel}>This week's briefing</Text>
            <View style={styles.readyBadge}>
              <Text style={styles.readyText}>READY</Text>
            </View>
          </View>
          <Text style={styles.briefingQuote}>
            "Chicken breast from Cascade is up 11% — your second increase this month."
          </Text>
        </TouchableOpacity>

        {/* Stats row */}
        <View style={styles.row}>
          <View style={[styles.card, styles.halfCard]}>
            <View>
              <Text style={styles.tileLabel}>Delivery check</Text>
              <Text style={styles.tileCaption} numberOfLines={2}>Share of invoiced items verified against delivery</Text>
            </View>
            <View style={styles.verifyChartRow}>
              <View style={styles.donutWrap}>
                <DonutChart segments={verifySegments} size={62} strokeWidth={10} />
                <View style={styles.donutCenter} pointerEvents="none">
                  <Text style={styles.donutCenterText}>{verifiedPct}%</Text>
                </View>
              </View>
              <View style={styles.verifyLegend}>
                {verifySegments.map((s) => (
                  <View key={s.key} style={styles.verifyLegendItem}>
                    <View style={[styles.verifyLegendDot, { backgroundColor: s.color }]} />
                    <Text style={styles.verifyLegendText} numberOfLines={1}>{s.label} {s.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.card, styles.halfCard]}>
            <View>
              <Text style={styles.tileLabel}>Billed, not delivered</Text>
              <Text style={styles.tileCaption} numberOfLines={2}>Charged on the invoice but never received</Text>
            </View>
            <View style={styles.tileValueRow}>
              <Text style={styles.tileValue}>${flaggedShortAmount}</Text>
            </View>
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{flaggedShortCount} items flagged</Text>
              </View>
            </View>

            <View style={styles.disputeTimeline}>
              {recentDisputes.map((d) => (
                <View key={d.id} style={styles.disputeRow}>
                  <View style={styles.disputeDot} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.disputeItemName} numberOfLines={1}>{d.itemName}</Text>
                    <Text style={styles.disputeMeta} numberOfLines={1}>
                      {d.vendorName.split(' ')[0]} · {d.date.replace(', 2026', '')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={() => router.push('/disputes')} activeOpacity={0.7}>
              <Text style={styles.viewMoreText}>View all disputes ›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category spend */}
        {categorySpend.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.tileLabel}>Spend by category</Text>
            <Text style={styles.tileCaption}>This week, across all vendors</Text>
            <View style={styles.verifyChartRow}>
              <View style={styles.donutWrap}>
                <DonutChart
                  segments={categorySpend.map((c) => ({ key: c.category, value: c.amount, color: c.color }))}
                  size={62}
                  strokeWidth={10}
                />
              </View>
              <View style={styles.verifyLegend}>
                {categorySpend.map((c) => (
                  <View key={c.category} style={styles.verifyLegendItem}>
                    <View style={[styles.verifyLegendDot, { backgroundColor: c.color }]} />
                    <Text style={styles.verifyLegendText} numberOfLines={1}>{c.category} · ${c.amount.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Price alert card */}
        {topAlert && (
          <TouchableOpacity
            style={styles.alertCard}
            onPress={() => router.push('/(tabs)/alerts')}
            activeOpacity={0.85}
          >
            <View style={styles.alertIconWrap}>
              <Text style={styles.alertIconText}>!</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.alertEyebrow}>Price increase</Text>
              <Text style={styles.alertTitle} numberOfLines={1}>
                {topAlert.itemName} · {topAlert.vendorName.split(' ')[0]}
              </Text>
              <Text style={styles.alertSub}>
                up ${topAlert.absChange.toFixed(2)}/{topAlert.unit} ({topAlert.pctChange}%) since last order
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* Action tiles */}
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.card, styles.halfCard, styles.scanCard]}
            onPress={() => router.push('/scan')}
            activeOpacity={0.85}
          >
            <View style={styles.scanIconWrap}>
              <CameraIcon />
            </View>
            <View style={styles.scanTextBlock}>
              <Text style={styles.scanTitle}>Scan invoice</Text>
              <Text style={styles.scanSub}>
                {todayInvoiceCount} invoice{todayInvoiceCount === 1 ? '' : 's'} today
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.halfCard]}
            onPress={() => router.push('/(tabs)/vendors')}
            activeOpacity={0.85}
          >
            <View style={styles.vendorIconWrap}>
              <GridIcon />
            </View>
            <View style={styles.vendorTextBlock}>
              <Text style={styles.vendorTitle}>Vendors</Text>
              <Text style={styles.vendorSub}>{vendors.length} active this week</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Toast />
    </SafeAreaView>
  );
}

function BellIcon() {
  return (
    <View style={{ width: 17, height: 18, alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: 0, left: 3, width: 11, height: 10, borderWidth: 2, borderColor: Colors.textPrimary, borderRadius: 6, borderBottomWidth: 0 }} />
      <View style={{ position: 'absolute', bottom: 3, left: 0, width: 17, height: 2.5, backgroundColor: Colors.textPrimary, borderRadius: 2 }} />
      <View style={{ position: 'absolute', bottom: 0, left: 6.5, width: 4, height: 3, backgroundColor: Colors.textPrimary, borderRadius: 2 }} />
    </View>
  );
}

function CameraIcon() {
  return (
    <View style={{ width: 26, height: 22 }}>
      <View style={{ position: 'absolute', top: 4, left: 0, right: 0, bottom: 0, borderWidth: 2.5, borderColor: '#fff', borderRadius: 4 }} />
      <View style={{ position: 'absolute', top: 0, left: 8, width: 10, height: 5, backgroundColor: '#fff', borderRadius: 2 }} />
      <View style={{ position: 'absolute', top: 10, left: '50%', marginLeft: -4, width: 8, height: 8, borderWidth: 2, borderColor: '#fff', borderRadius: 4 }} />
    </View>
  );
}

function GridIcon() {
  return (
    <View style={{ width: 20, height: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 8, height: 8, backgroundColor: Colors.primary, borderRadius: 2 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, gap: 10,
  },
  greeting: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  restaurantName: {
    fontSize: 22, fontFamily: 'Manrope_800ExtraBold',
    color: Colors.textPrimary, letterSpacing: -0.3,
  },
  headerIcons: { flexDirection: 'row', gap: 9, alignItems: 'center', flexShrink: 0 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3,
  },
  alertDot: {
    position: 'absolute', top: 9, right: 10, width: 8, height: 8,
    borderRadius: 4, backgroundColor: Colors.danger, borderWidth: 1.5, borderColor: '#fff',
  },
  avatar: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 10,
  },
  avatarText: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: 0.5 },

  scroll: { padding: CARD_PAD, gap: 11, paddingBottom: 32 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 18,
  },
  row: { flexDirection: 'row', gap: 11 },
  halfCard: { flex: 1, borderRadius: 18, minHeight: 120, justifyContent: 'space-between' },

  spendTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  spendLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  spendLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  spendAmount: { fontSize: 34, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.8 },
  spendChange: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  spendChangeArrow: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.primary, marginRight: 3 },
  spendChangePct: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.primary },
  spendChangeUp: { color: Colors.danger },
  spendChangeLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  periodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7,
  },
  periodText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },

  breakdown: {
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryMuted,
    borderRadius: 12, padding: 12, marginTop: 14,
  },
  breakdownLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.primaryDark, marginBottom: 5,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 },
  breakdownName: { flex: 1, fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary },
  breakdownAmt: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, columnGap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 3 },
  legendText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, height: CHART_H, marginTop: 12 },
  barCol: { flex: 1, alignItems: 'center', gap: 7 },
  barStack: { width: '100%', justifyContent: 'flex-end' },
  barLabel: { fontSize: 10.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },
  barLabelActive: { color: Colors.textSecondary },

  tileLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginBottom: 0 },
  tileCaption: { fontSize: 10.5, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 1, marginBottom: 10, lineHeight: 13 },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 9 },
  tileValue: { fontSize: 26, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5 },
  verifyChartRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  donutWrap: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  donutCenterText: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
  verifyLegend: { flex: 1, minWidth: 0, gap: 3 },
  verifyLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifyLegendDot: { width: 6, height: 6, borderRadius: 3 },
  verifyLegendText: { fontSize: 10, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, flexShrink: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    backgroundColor: Colors.warningLight, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.warning + '30',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  pillText: { fontSize: 10.5, fontFamily: 'Manrope_700Bold', color: Colors.warning },

  disputeTimeline: { gap: 8, marginTop: 12 },
  disputeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  disputeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.danger, marginTop: 4 },
  disputeItemName: { fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  disputeMeta: { fontSize: 10, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 1 },
  viewMoreText: { fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.primary, marginTop: 12 },

  alertCard: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    padding: 15, flexDirection: 'row', gap: 13, alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 12,
  },
  alertIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center',
  },
  alertIconText: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: Colors.warning },
  alertEyebrow: {
    fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.warning, marginBottom: 2,
  },
  alertTitle: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  alertSub: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.warning, marginTop: 1 },
  chevron: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary },

  scanCard: { backgroundColor: Colors.primary, borderColor: Colors.primary, justifyContent: 'space-between' },
  scanIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center',
  },
  scanTextBlock: {},
  scanTitle: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: -0.2 },
  scanSub: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  vendorIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  vendorTextBlock: {},
  vendorTitle: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  vendorSub: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 2 },

  briefingCard: { padding: 16 },
  briefingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  briefingHeaderLabel: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.textSecondary },
  readyBadge: { backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  readyText: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.7, color: Colors.primaryDark },
  briefingQuote: { fontSize: 14.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary, lineHeight: 22 },
});

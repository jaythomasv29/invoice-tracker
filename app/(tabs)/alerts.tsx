import { useWorkspace } from '../../lib/workspaceContext';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import SafeAreaView from '../../components/ui/Screen';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../constants/Colors';
import { useStore, PriceAlert } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { useEntitlement } from '../../hooks/useEntitlement';
import { usePriceAlertCount } from '../../hooks/usePriceAlertCount';
import ProLockCard from '../../components/ui/ProLockCard';
import Toast from '../../components/ui/Toast';
import { formatAlertDate, groupPriceAlerts, type PriceAlertGroup } from '../../lib/priceAlertGroups';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AlertsScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization, isPersonal } = useWorkspace();
  const { isPaid } = useEntitlement();
  const { priceAlerts, markAlertRead, fetchPriceAlerts } = useStore();

  const openHistory = (a: PriceAlert) => {
    // Sample data has no database rows behind it; item history would error.
    if (useStore.getState().demoMode) { useStore.getState().showToast(`Price history opens with your own ${isPersonal ? 'receipts' : 'invoices'}`); return; }
    router.push({
      pathname: '/item-history',
      params: { itemName: a.itemName, ...(a.vendorId ? { vendorId: a.vendorId } : {}) },
    });
  };

  useFocusEffect(
    useCallback(() => {
      // Price-creep detection is Pro-only — don't fetch for free orgs.
      if (isPaid && organization?.id) fetchPriceAlerts(supabase, organization.id);
    }, [isPaid, organization?.id, supabase, fetchPriceAlerts])
  );

  // One row per product: repeat increases collapse into a single creep story.
  const groups = groupPriceAlerts(priceAlerts);
  const unread = groups.filter((g) => g.unread);
  const read = groups.filter((g) => !g.unread);
  const markGroupRead = (g: PriceAlertGroup<PriceAlert>) => {
    for (const a of g.alerts) if (!a.read) markAlertRead(supabase, a.id);
  };

  // Free orgs get the feature pitch instead of the alert list — but teased with
  // their real count of price increases (detection runs for everyone; only the
  // details are Pro-gated).
  if (!isPaid) {
    return <FreeAlertsUpsell />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Price Alerts</Text>
        {unread.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{unread.length} new</Text>
          </View>
        )}
      </View>

      <Text style={{paddingHorizontal:20,paddingBottom:10,fontFamily:'Manrope_400Regular',fontSize:13,color:Colors.textSecondary}}>{isPersonal ? 'Items a store charged more for than last time, compared by net unit price and dated by purchase.' : 'Items your suppliers charged more for than last time, dated by delivery.'}</Text>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {unread.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>New</Text>
            {unread.map((g) => (
              <AlertRow key={g.key} group={g} onPress={() => {
                Haptics.selectionAsync();
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                markGroupRead(g);
                openHistory(g.latest);
              }} />
            ))}
          </>
        )}

        {read.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Earlier</Text>
            {read.map((g) => (
              <AlertRow key={g.key} group={g} dimmed onPress={() => {
                Haptics.selectionAsync();
                openHistory(g.latest);
              }} />
            ))}
          </>
        )}

        {groups.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>No alerts right now</Text>
            <Text style={styles.emptySub}>Price changes will appear here after you save repeat purchases.</Text>
          </View>
        )}
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

function FreeAlertsUpsell() {
  const { count } = usePriceAlertCount();
  const { isPersonal } = useWorkspace();
  const has = count > 0;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Price Alerts</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ProLockCard
          stat={has ? String(count) : undefined}
          statLabel={has ? (count === 1 ? 'price increase this month' : 'price increases this month') : undefined}
          title={has ? 'Some prices are creeping up' : 'Never miss a quiet price hike'}
          body={isPersonal
            ? 'Personal Pro compares each saved receipt with your past purchases of the same product and flags any that cost more per unit — so a store’s quiet increases never slip past you.'
            : 'Pro checks every new invoice against your price history and flags any item that creeps up — so a vendor’s slow increases never slip past you.'}
        />
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

function AlertRow({ group: g, onPress, dimmed }: { group: PriceAlertGroup<PriceAlert>; onPress?: () => void; dimmed?: boolean }) {
  const a = g.latest;
  const { isPersonal } = useWorkspace();
  // Household comparisons are net unit prices ($/oz) — two decimals would
  // render a real +5% change as "$0.18 → $0.18".
  const money = (n: number) => n.toFixed(isPersonal && n < 1 ? 4 : 2);
  const unit = a.unit ? `/${a.unit}` : '';
  const date = formatAlertDate(a.priceDate, a.detectedAt);
  const since = formatAlertDate(g.firstDate);
  const label = `${a.itemName} from ${a.vendorName}, up ${Math.round(a.pctChange)} percent to $${money(a.newPrice)}${g.increases > 1 ? `, up ${Math.round(g.totalPct)} percent over ${g.increases} increases` : ''}`;
  return (
    <TouchableOpacity
      style={[styles.alertCard, dimmed && styles.alertCardDimmed]}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens this item's price history"
    >
      <View style={[styles.alertIcon, { backgroundColor: Colors.warningLight }]}>
        <Text style={[styles.alertIconGlyph, { color: Colors.warning }]}>↑</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.alertItemName} numberOfLines={1}>{a.itemName}</Text>
        <Text style={styles.alertVendor}>{a.vendorName}</Text>
        <View style={styles.alertMeta}>
          <View style={[styles.alertPctBadge, { backgroundColor: Colors.warningLight }]}>
            <Text style={[styles.alertPctText, { color: Colors.warning }]}>+{Math.round(a.pctChange)}%</Text>
          </View>
          <Text style={styles.alertDetail}>
            ${money(a.previousPrice)} → ${money(a.newPrice)}{unit}
          </Text>
        </View>
        {g.increases > 1 && (
          <Text style={styles.alertStreak}>
            Up {Math.round(g.totalPct)}% over {g.increases} increases{since ? ` since ${since}` : ''} · ${money(g.firstPrice)} → ${money(g.latestPrice)}{unit}
          </Text>
        )}
      </View>
      <View style={styles.alertRight}>
        <Text style={styles.alertDate}>{date}</Text>
        {g.unread && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16,
  },
  title: { fontSize: 28, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5, flex: 1 },
  countBadge: { backgroundColor: Colors.danger, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: '#fff' },
  scroll: { padding: 16, gap: 8, paddingBottom: 120 },
  sectionLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary,
    marginBottom: 4, marginTop: 8,
  },
  alertCard: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  alertCardDimmed: { backgroundColor: Colors.surface },
  alertIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  alertIconGlyph: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold' },
  alertItemName: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  alertVendor: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  alertMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  alertPctBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  alertPctText: { fontSize: 11, fontFamily: 'Manrope_700Bold' },
  alertDetail: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  alertStreak: { fontSize: 12, lineHeight: 17, fontFamily: 'Manrope_600SemiBold', color: Colors.warning, marginTop: 6 },
  alertRight: { alignItems: 'flex-end', gap: 6 },
  alertDate: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptySub: { fontSize: 14, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

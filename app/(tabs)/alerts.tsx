import { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore, PriceAlert } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { useEntitlement } from '../../hooks/useEntitlement';
import { usePriceAlertCount } from '../../hooks/usePriceAlertCount';
import ProLockCard from '../../components/ui/ProLockCard';
import Toast from '../../components/ui/Toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AlertsScreen() {
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const { isPro } = useEntitlement();
  const { priceAlerts, markAlertRead, fetchPriceAlerts } = useStore();

  useFocusEffect(
    useCallback(() => {
      // Price-creep detection is Pro-only — don't fetch for free orgs.
      if (isPro && organization?.id) fetchPriceAlerts(supabase, organization.id);
    }, [isPro, organization?.id, supabase, fetchPriceAlerts])
  );

  const unread = priceAlerts.filter((a) => !a.read);
  const read = priceAlerts.filter((a) => a.read);

  // Free orgs get the feature pitch instead of the alert list — but teased with
  // their real count of price increases (detection runs for everyone; only the
  // details are Pro-gated).
  if (!isPro) {
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {unread.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>New</Text>
            {unread.map((a) => (
              <AlertRow key={a.id} alert={a} onPress={() => {
                Haptics.selectionAsync();
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                markAlertRead(supabase, a.id);
              }} />
            ))}
          </>
        )}

        {read.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Earlier</Text>
            {read.map((a) => (
              <AlertRow key={a.id} alert={a} dimmed />
            ))}
          </>
        )}

        {priceAlerts.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>No alerts right now</Text>
            <Text style={styles.emptySub}>We'll notify you when vendor prices move significantly.</Text>
          </View>
        )}
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

function FreeAlertsUpsell() {
  const { count } = usePriceAlertCount();
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
          title={has ? 'Someone’s prices are creeping up' : 'Never miss a quiet price hike'}
          body="Pro checks every new invoice against your price history and flags any item that creeps up — so a vendor’s slow increases never slip past you."
        />
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

function AlertRow({ alert: a, onPress, dimmed }: { alert: PriceAlert; onPress?: () => void; dimmed?: boolean }) {
  const isUp = a.pctChange > 0;
  return (
    <TouchableOpacity
      style={[styles.alertCard, dimmed && styles.alertCardDimmed]}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
    >
      <View style={[styles.alertIcon, { backgroundColor: isUp ? Colors.warningLight : Colors.primaryLight }]}>
        <Text style={[styles.alertIconGlyph, { color: isUp ? Colors.warning : Colors.primary }]}>
          {isUp ? '↑' : '↓'}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.alertItemName} numberOfLines={1}>{a.itemName}</Text>
        <Text style={styles.alertVendor}>{a.vendorName}</Text>
        <View style={styles.alertMeta}>
          <View style={[styles.alertPctBadge, { backgroundColor: isUp ? Colors.warningLight : Colors.primaryLight }]}>
            <Text style={[styles.alertPctText, { color: isUp ? Colors.warning : Colors.primary }]}>
              {isUp ? '+' : ''}{a.pctChange}%
            </Text>
          </View>
          <Text style={styles.alertDetail}>
            ${a.previousPrice.toFixed(2)} → ${a.newPrice.toFixed(2)}/{a.unit}
          </Text>
        </View>
      </View>
      <View style={styles.alertRight}>
        <Text style={styles.alertDate}>{a.detectedAt}</Text>
        {!a.read && <View style={styles.unreadDot} />}
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
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  alertCardDimmed: { opacity: 0.6 },
  alertIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  alertIconGlyph: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold' },
  alertItemName: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  alertVendor: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  alertMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  alertPctBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  alertPctText: { fontSize: 11, fontFamily: 'Manrope_700Bold' },
  alertDetail: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  alertRight: { alignItems: 'flex-end', gap: 6 },
  alertDate: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptySub: { fontSize: 14, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

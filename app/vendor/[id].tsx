import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore, Invoice } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { fetchVendorInvoices } from '../../lib/invoicePipeline';
import { useEntitlement } from '../../hooks/useEntitlement';
import Spinner from '../../components/ui/Spinner';
import BackButton from '../../components/ui/BackButton';
import InvoiceRow from '../../components/ui/InvoiceRow';

// Median gap (in days) between distinct order days, turned into a
// human-readable cadence label. Returns '—' when there isn't enough date
// history to make a call.
function cadenceLabel(invoices: Invoice[]): string {
  const days = Array.from(
    new Set(
      invoices
        .map((inv) => inv.dateIso)
        .filter((iso): iso is string => iso !== null)
        .map((iso) => Math.floor(new Date(iso).getTime() / 86400000))
    )
  ).sort((a, b) => a - b);

  if (days.length < 2) return '—';

  const gaps: number[] = [];
  for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1]);
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const medianGap = gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];

  if (medianGap <= 2) return 'Most days';
  if (medianGap <= 4) return 'A few times a week';
  if (medianGap <= 10) return 'About weekly';
  if (medianGap <= 18) return 'Every couple weeks';
  return 'About monthly';
}

export default function VendorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { organization } = useOrganization();
  const supabase = useSupabase();
  const { vendors } = useStore();
  const { isPro } = useEntitlement();

  const vendor = vendors.find((v) => v.id === id);
  const [vendorInvoices, setVendorInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Focus (not mount) effect — so returning here after deleting an invoice
  // from the detail screen drops the now-gone row instead of leaving a
  // stale one behind until the app is fully reloaded.
  useFocusEffect(
    useCallback(() => {
      if (!organization?.id || !id) return;
      setLoading(true);
      fetchVendorInvoices(supabase, organization.id, id)
        .then(setVendorInvoices)
        .catch(() => setVendorInvoices([]))
        .finally(() => setLoading(false));
    }, [organization?.id, id, supabase])
  );

  if (!vendor) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Vendor not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <View style={[styles.vendorAvatar, { backgroundColor: vendor.color + '20' }]}>
          <Text style={[styles.vendorAvatarText, { color: vendor.color }]}>
            {vendor.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{vendor.name}</Text>
          <Text style={styles.headerSub}>
            {loading ? 'Loading…' : `${vendorInvoices.length} invoice${vendorInvoices.length === 1 ? '' : 's'} captured`}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {(vendor.contactName || vendor.accountNumber || vendor.contactPhone) && (
          <View style={styles.contactCard}>
            {vendor.contactName && <Text style={styles.contactItem}>Rep: {vendor.contactName}</Text>}
            {vendor.accountNumber && <Text style={styles.contactItem}>Acct: {vendor.accountNumber}</Text>}
            {vendor.contactPhone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${vendor.contactPhone}`)}>
                <Text style={styles.contactPhone}>{vendor.contactPhone}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isPro && !loading && vendorInvoices.length > 0 && (() => {
          const orderCount = vendorInvoices.length;
          const avgOrderSize = vendorInvoices.reduce((sum, inv) => sum + inv.total, 0) / orderCount;
          const cadence = cadenceLabel(vendorInvoices);
          return (
            <View style={styles.patternsCard}>
              <Text style={styles.patternsHeader}>Order patterns</Text>
              <View style={styles.patternsRow}>
                <View style={styles.patternsTile}>
                  <Text style={styles.patternsValue}>
                    ${Math.round(avgOrderSize).toLocaleString('en-US')}
                  </Text>
                  <Text style={styles.patternsLabel}>Avg order</Text>
                </View>
                <View style={styles.patternsTile}>
                  <Text style={styles.patternsValue}>{orderCount}</Text>
                  <Text style={styles.patternsLabel}>Orders</Text>
                </View>
                <View style={styles.patternsTile}>
                  <Text style={styles.patternsValue}>{cadence}</Text>
                  <Text style={styles.patternsLabel}>Cadence</Text>
                </View>
              </View>
            </View>
          );
        })()}

        <Text style={styles.sectionLabel}>Invoices</Text>
        {loading ? (
          <View style={styles.empty}>
            <Spinner />
          </View>
        ) : (
          <>
            {vendorInvoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} onPress={() => {
                Haptics.selectionAsync();
                router.push(`/invoice/${inv.id}`);
              }} />
            ))}
            {vendorInvoices.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No invoices yet</Text>
                <Text style={styles.emptySub}>Scanned invoices from {vendor.name} will show up here.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  vendorAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  vendorAvatarText: { fontSize: 13, fontFamily: 'Manrope_800ExtraBold' },
  headerTitle: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },

  scroll: { padding: 16, gap: 10, paddingBottom: 40 },

  contactCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 4,
  },
  contactItem: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  contactPhone: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.primary, textDecorationLine: 'underline' },

  patternsCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  patternsHeader: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2, marginBottom: 10 },
  patternsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  patternsTile: { flex: 1, alignItems: 'center', gap: 2 },
  patternsValue: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, textAlign: 'center' },
  patternsLabel: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, textAlign: 'center' },

  sectionLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary,
    marginTop: 6, marginBottom: 2,
  },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptySub: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});

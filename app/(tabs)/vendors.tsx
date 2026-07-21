import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore, Vendor, Invoice } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { fetchAllInvoices } from '../../lib/invoicePipeline';
import Toast from '../../components/ui/Toast';
import Spinner from '../../components/ui/Spinner';

type Tab = 'vendors' | 'invoices';

export default function VendorsScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const { vendors, weekTotal, fetchDashboardSummary } = useStore();

  const [tab, setTab] = useState<Tab>('vendors');
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (organization?.id) fetchDashboardSummary(supabase, organization.id);
    }, [organization?.id, supabase, fetchDashboardSummary])
  );

  useEffect(() => {
    if (tab !== 'invoices' || !organization?.id) return;
    setInvoicesLoading(true);
    fetchAllInvoices(supabase, organization.id)
      .then(setAllInvoices)
      .catch(() => setAllInvoices([]))
      .finally(() => setInvoicesLoading(false));
  }, [tab, organization?.id, supabase]);

  const sorted = [...vendors].sort((a, b) => b.weekSpend - a.weekSpend);
  const hasWeekSpend = weekTotal > 0;

  const query = search.trim().toLowerCase();
  const filteredInvoices = query
    ? allInvoices.filter((inv) =>
        inv.vendorName.toLowerCase().includes(query) || inv.invoiceNumber.toLowerCase().includes(query)
      )
    : allInvoices;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{tab === 'vendors' ? 'Vendors' : 'All Invoices'}</Text>
        <Text style={styles.subtitle}>
          {tab === 'vendors'
            ? `${sorted.filter((v) => v.invoiceCount > 0).length} active this week`
            : `${allInvoices.length} invoice${allInvoices.length === 1 ? '' : 's'} captured`}
        </Text>
      </View>

      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segment, tab === 'vendors' && styles.segmentActive]}
          onPress={() => { Haptics.selectionAsync(); setTab('vendors'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, tab === 'vendors' && styles.segmentTextActive]}>Vendors</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === 'invoices' && styles.segmentActive]}
          onPress={() => { Haptics.selectionAsync(); setTab('invoices'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, tab === 'invoices' && styles.segmentTextActive]}>All Invoices</Text>
        </TouchableOpacity>
      </View>

      {tab === 'vendors' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Spend concentration */}
          {hasWeekSpend && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Spend concentration</Text>
              <View style={styles.concentrationBar}>
                {sorted.filter((v) => v.weekSpend > 0).map((v) => (
                  <View
                    key={v.id}
                    style={[styles.concentrationSegment, {
                      flex: v.weekSpend / weekTotal,
                      backgroundColor: v.color,
                    }]}
                  />
                ))}
              </View>
              <View style={styles.concentrationLegend}>
                {sorted.filter((v) => v.weekSpend > 0).map((v) => (
                  <View key={v.id} style={styles.concentrationLegendItem}>
                    <View style={[styles.concentrationDot, { backgroundColor: v.color }]} />
                    <Text style={styles.concentrationName}>{v.name.split(' ')[0]}</Text>
                    <Text style={styles.concentrationPct}>{Math.round((v.weekSpend / weekTotal) * 100)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {sorted.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No vendors yet</Text>
              <Text style={styles.emptySub}>Scan an invoice and the vendor will show up here automatically.</Text>
            </View>
          )}

          {sorted.map((v) => (
            <VendorCard key={v.id} vendor={v} />
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by vendor or invoice #"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {invoicesLoading ? (
              <View style={styles.empty}><Spinner /></View>
            ) : (
              <>
                {filteredInvoices.map((inv) => (
                  <InvoiceListRow key={inv.id} invoice={inv} onPress={() => {
                    Haptics.selectionAsync();
                    router.push(`/invoice/${inv.id}`);
                  }} />
                ))}
                {filteredInvoices.length === 0 && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>{query ? 'No matches' : 'No invoices yet'}</Text>
                    <Text style={styles.emptySub}>
                      {query ? 'Try a different vendor name or invoice number.' : 'Scanned invoices will show up here.'}
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      )}

      <Toast />
    </SafeAreaView>
  );
}

function InvoiceListRow({ invoice: inv, onPress }: { invoice: Invoice; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.invoiceRow} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.invoiceVendor} numberOfLines={1}>{inv.vendorName}</Text>
        <Text style={styles.invoiceMeta} numberOfLines={1}>
          Invoice #{inv.invoiceNumber || '—'} · {inv.date} · {inv.lineItems.length} items
        </Text>
      </View>
      <Text style={styles.invoiceTotal}>${inv.total.toFixed(2)}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function VendorCard({ vendor: v }: { vendor: Vendor }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.vendorCard}
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/vendor/${v.id}`);
      }}
      activeOpacity={0.85}
    >
      <View style={styles.vendorTop}>
        <View style={[styles.vendorAvatar, { backgroundColor: v.color + '20' }]}>
          <Text style={[styles.vendorAvatarText, { color: v.color }]}>
            {v.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
          </Text>
          <View style={styles.vendorFreqRow}>
            {Array.from({ length: v.invoiceCount }).map((_, i) => (
              <View key={i} style={[styles.vendorFreqDot, { backgroundColor: v.color }]} />
            ))}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vendorName}>{v.name}</Text>
          <Text style={styles.vendorMeta}>{v.invoiceCount} invoices · last order {v.lastOrder}</Text>
        </View>
        <View style={styles.vendorSpend}>
          <Text style={styles.vendorSpendAmt}>${v.weekSpend.toLocaleString()}</Text>
          <Text style={styles.vendorSpendLabel}>this week</Text>
        </View>
      </View>

      {(v.contactPhone || v.contactName || v.accountNumber) && (
        <View style={styles.vendorContact}>
          {v.contactName && (
            <Text style={styles.vendorContactItem}>Rep: {v.contactName}</Text>
          )}
          {v.accountNumber && (
            <Text style={styles.vendorContactItem}>Acct: {v.accountNumber}</Text>
          )}
          {v.contactPhone && (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${v.contactPhone}`)}>
              <Text style={styles.vendorPhone}>{v.contactPhone}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  title: { fontSize: 28, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 2 },

  segmentRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  segmentTextActive: { color: '#fff' },

  searchWrap: { paddingHorizontal: 16, marginBottom: 10 },
  searchInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 44,
    fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary,
  },

  invoiceRow: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  invoiceVendor: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  invoiceMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  invoiceTotal: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },
  chevron: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary },

  scroll: { padding: 16, gap: 11, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 12,
  },
  cardLabel: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  concentrationBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 1 },
  concentrationSegment: { borderRadius: 5 },
  concentrationLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  concentrationLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  concentrationDot: { width: 8, height: 8, borderRadius: 4 },
  concentrationName: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  concentrationPct: { fontSize: 11, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },

  vendorCard: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 12,
  },
  vendorTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vendorAvatar: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 4 },
  vendorAvatarText: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold' },
  vendorFreqRow: { flexDirection: 'row', gap: 2 },
  vendorFreqDot: { width: 4, height: 4, borderRadius: 2 },
  vendorName: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  vendorMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  vendorSpend: { alignItems: 'flex-end' },
  vendorSpendAmt: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
  vendorSpendLabel: { fontSize: 10, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },

  vendorContact: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 12, gap: 4,
  },
  vendorContactItem: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  vendorPhone: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.primary, textDecorationLine: 'underline' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptySub: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});

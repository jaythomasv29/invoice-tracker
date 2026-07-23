import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore, Vendor, Invoice, vendorAmountFromBars } from '../../store/useStore';
import { useSpendPeriod, spendPeriodShortLabel } from '../../hooks/useSpendPeriod';
import { useSupabase } from '../../lib/supabase';
import { fetchAllInvoices } from '../../lib/invoicePipeline';
import Toast from '../../components/ui/Toast';
import Spinner from '../../components/ui/Spinner';
import InvoiceRow from '../../components/ui/InvoiceRow';
import SpendCard from '../../components/dashboard/SpendCard';
import InfoButton from '../../components/ui/InfoButton';
import {
  OnboardingExplainer, OnboardingExplainerSheet, type ExplainerConfig,
} from '../../components/ui/OnboardingExplainerSheet';
import { InvoiceParsePreview } from '../../components/onboarding/PreviewCards';

type Tab = 'vendors' | 'invoices';

const INVOICE_EXPLAINER: ExplainerConfig = {
  eyebrow: 'SCAN & CAPTURE',
  title: 'Every invoice,\nturned into data',
  subtitle: 'Scan an invoice and Sift pulls out the vendor, line items, and prices for you — so every delivery is searchable and your price history builds itself.',
  Illustration: InvoiceParsePreview,
  ctaLabel: 'Scan an invoice',
};

export default function VendorsScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const { vendors, selectedDay, selectDay, fetchDashboardSummary } = useStore();
  const {
    spendView, setSpendView, yearsBack, setYearsBack, maxYears,
    periodTotal, periodPctChange, periodBarData,
  } = useSpendPeriod();

  const [tab, setTab] = useState<Tab>('vendors');
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const goToScan = () => {
    Haptics.selectionAsync();
    router.push('/scan');
  };

  useFocusEffect(
    useCallback(() => {
      if (!organization?.id) return;
      setIsLoadingSummary(true);
      fetchDashboardSummary(supabase, organization.id).finally(() => setIsLoadingSummary(false));
    }, [organization?.id, supabase, fetchDashboardSummary])
  );

  // Focus (not mount) effect — so coming back to this tab after deleting an
  // invoice from its detail screen drops the now-gone row.
  useFocusEffect(
    useCallback(() => {
      if (tab !== 'invoices' || !organization?.id) return;
      setInvoicesLoading(true);
      fetchAllInvoices(supabase, organization.id)
        .then(setAllInvoices)
        .catch(() => setAllInvoices([]))
        .finally(() => setInvoicesLoading(false));
    }, [tab, organization?.id, supabase])
  );

  const shortLabel = spendPeriodShortLabel(spendView, yearsBack);
  const withPeriodAmount = useMemo(() => (
    vendors.map((v) => ({ vendor: v, periodAmount: vendorAmountFromBars(periodBarData, v.id) }))
  ), [vendors, periodBarData]);
  const sorted = useMemo(
    () => [...withPeriodAmount].sort((a, b) => b.periodAmount - a.periodAmount),
    [withPeriodAmount]
  );
  const activeCount = sorted.filter((v) => v.periodAmount > 0).length;

  const handleBarPress = useCallback((i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectDay(i);
  }, [selectDay]);

  const query = search.trim().toLowerCase();
  const filteredInvoices = query
    ? allInvoices.filter((inv) =>
        inv.vendorName.toLowerCase().includes(query) || inv.invoiceNumber.toLowerCase().includes(query)
      )
    : allInvoices;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{tab === 'vendors' ? 'Vendors' : 'All Invoices'}</Text>
          <Text style={styles.subtitle}>
            {tab === 'vendors'
              ? `${activeCount} active ${shortLabel}`
              : `${allInvoices.length} invoice${allInvoices.length === 1 ? '' : 's'} captured`}
          </Text>
        </View>
        {tab === 'invoices' && allInvoices.length > 0 && (
          <InfoButton onPress={() => setInfoOpen(true)} />
        )}
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
          {/* Mix of all vendors — moved here from the home screen so the
              timeline lives alongside the vendors it's breaking down. */}
          <SpendCard
            period={spendView}
            onChangePeriod={setSpendView}
            yearsBack={yearsBack}
            onChangeYears={setYearsBack}
            maxYears={maxYears}
            periodTotal={periodTotal}
            periodPctChange={periodPctChange}
            barData={periodBarData}
            selectedBar={selectedDay}
            onSelectBar={handleBarPress}
            isLoading={isLoadingSummary}
          />

          {sorted.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No vendors yet</Text>
              <Text style={styles.emptySub}>Scan an invoice and the vendor will show up here automatically.</Text>
            </View>
          )}

          {sorted.map(({ vendor: v, periodAmount }) => (
            <VendorCard key={v.id} vendor={v} periodAmount={periodAmount} periodLabel={shortLabel} />
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {!invoicesLoading && allInvoices.length === 0 ? (
            <OnboardingExplainer config={INVOICE_EXPLAINER} onCta={goToScan} />
          ) : (
            <>
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
                      <InvoiceRow key={inv.id} invoice={inv} showVendorName onPress={() => {
                        Haptics.selectionAsync();
                        router.push(`/invoice/${inv.id}`);
                      }} />
                    ))}
                    {filteredInvoices.length === 0 && (
                      <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>No matches</Text>
                        <Text style={styles.emptySub}>Try a different vendor name or invoice number.</Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            </>
          )}
        </View>
      )}

      <OnboardingExplainerSheet
        visible={infoOpen}
        config={INVOICE_EXPLAINER}
        onClose={() => setInfoOpen(false)}
        onCta={goToScan}
      />

      <Toast />
    </SafeAreaView>
  );
}

function VendorCard({ vendor: v, periodAmount, periodLabel }: { vendor: Vendor; periodAmount: number; periodLabel: string }) {
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
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vendorName}>{v.name}</Text>
          <Text style={styles.vendorMeta}>
            {v.invoiceCount} invoice{v.invoiceCount === 1 ? '' : 's'} total · last order {v.lastOrder}
          </Text>
        </View>
        <View style={styles.vendorSpendPill}>
          <Text style={styles.vendorSpendAmt}>${periodAmount.toLocaleString()}</Text>
          <Text style={styles.vendorSpendLabel}>{periodLabel}</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
  },
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

  scroll: { padding: 16, gap: 11, paddingBottom: 120 },

  vendorCard: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 12,
  },
  vendorTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vendorAvatar: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  vendorAvatarText: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold' },
  vendorName: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  vendorMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  vendorSpendPill: {
    alignItems: 'flex-end', backgroundColor: Colors.background,
    borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7,
  },
  vendorSpendAmt: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
  vendorSpendLabel: { fontSize: 9.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, marginTop: 1 },

  vendorContact: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 12, gap: 4,
  },
  vendorContactItem: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  vendorPhone: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.primary, textDecorationLine: 'underline' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptySub: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});

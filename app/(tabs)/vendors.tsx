import LoadFailure from '../../components/ui/LoadFailure';
import ScanInboxCard from '../../components/ScanInboxCard';
import { Design } from '../../constants/Design';
import { useWorkspace } from '../../lib/workspaceContext';
import { filterInvoiceLibrary } from '../../lib/invoiceLibrary';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TextInput } from 'react-native';
import SafeAreaView from '../../components/ui/Screen';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { buildDemoInvoices } from '../../lib/demoData';
import { Colors } from '../../constants/Colors';
import { useStore, Vendor, Invoice, vendorAmountFromBars } from '../../store/useStore';
import { useSpendPeriod, spendPeriodShortLabel } from '../../hooks/useSpendPeriod';
import { useSupabase } from '../../lib/supabase';
import { fetchAllInvoices } from '../../lib/invoicePipeline';
import { initialsFor } from '../../lib/initials';
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
  const params=useLocalSearchParams<{view?:string;from?:string;to?:string;entry?:string}>();
  const supabase = useSupabase();
  const { organization, isPersonal } = useWorkspace();
  const { vendors, selectedDay, selectDay, fetchDashboardSummary, demoMode, dashboardError } = useStore();
  const {
    spendView, setSpendView, yearsBack, setYearsBack, maxYears,
    periodTotal, periodPctChange, periodBarData,
  } = useSpendPeriod();

  const [tab, setTab] = useState<Tab>(params.view==='vendors'?'vendors':'invoices');
  useEffect(()=>{if(params.view==='vendors'||params.view==='invoices')setTab(params.view);},[params.view]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [invoicesError,setInvoicesError]=useState('');
  const [retrySummary,setRetrySummary]=useState(0);
  const [retryInvoices,setRetryInvoices]=useState(0);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(()=>{setSearch('');},[params.entry]);
  const rangeFrom=typeof params.from==='string'?params.from:undefined;
  const rangeTo=typeof params.to==='string'?params.to:undefined;
  const hasRange=!!rangeFrom&&!!rangeTo;
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const goToScan = () => {
    Haptics.selectionAsync();
    router.push('/scan');
  };

  useFocusEffect(
    useCallback(() => {
      if (!organization?.id) return;
      let live=true;const scope=useStore.getState().activeScope;
      setIsLoadingSummary(true);
      void fetchDashboardSummary(supabase, organization.id).catch(()=>{if(live&&scope===useStore.getState().activeScope)useStore.setState({dashboardError:'Could not refresh your spending overview.'});}).finally(()=>{if(live&&scope===useStore.getState().activeScope)setIsLoadingSummary(false);});
      return()=>{live=false;};
    // Retry version intentionally reruns this focused fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization?.id, supabase, fetchDashboardSummary, retrySummary])
  );

  // Focus (not mount) effect — so coming back to this tab after deleting an
  // invoice from its detail screen drops the now-gone row.
  useFocusEffect(
    useCallback(() => {
      if (tab !== 'invoices') return;
      // Keep sample exploration entirely local, using the tour ledger.
      if (demoMode) { setAllInvoices(buildDemoInvoices()); setInvoicesLoading(false); return; }
      if (!organization?.id) return;
      let live=true; const scope=useStore.getState().activeScope;
      setInvoicesLoading(true);setInvoicesError('');
      fetchAllInvoices(supabase, organization.id)
        .then(rows=>{if(live&&scope===useStore.getState().activeScope)setAllInvoices(rows);})
        .catch(()=>{if(live&&scope===useStore.getState().activeScope)setInvoicesError('Could not refresh your invoice library.');})
        .finally(()=>{if(live&&scope===useStore.getState().activeScope)setInvoicesLoading(false);});
      return()=>{live=false;};
    // Retry version intentionally reruns this focused fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, organization?.id, supabase, demoMode, retryInvoices])
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

  const filteredInvoices=filterInvoiceLibrary(allInvoices,search,rangeFrom,rangeTo);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{tab === 'vendors' ? (isPersonal?'Your stores':'Your suppliers') : (isPersonal?'Receipt library':'Invoice library')}</Text>
          <Text style={styles.subtitle}>
            {tab === 'vendors'
              ? `${activeCount} active ${shortLabel}`
              : hasRange?`${filteredInvoices.length} saved ${isPersonal?'receipts':'invoices'} in this period`:`${allInvoices.length} ${isPersonal?'receipt':'invoice'}${allInvoices.length === 1 ? '' : 's'} captured`}
          </Text>
        </View>
        {tab === 'invoices' && allInvoices.length > 0 && (
          <InfoButton onPress={() => setInfoOpen(true)} />
        )}
      </View>

      {tab==='vendors'&&dashboardError&&<LoadFailure message={dashboardError} hasData={vendors.length>0} onRetry={()=>setRetrySummary(n=>n+1)}/>}
      <ScanInboxCard />
      {tab==='invoices'&&hasRange&&<View style={{marginHorizontal:16,marginBottom:10,paddingHorizontal:12,borderRadius:12,backgroundColor:Colors.primaryLight,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}><Text style={{flex:1,fontFamily:'Manrope_600SemiBold',fontSize:12,color:Colors.primaryDark}}>{rangeFrom} — {rangeTo}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear invoice date filter" onPress={()=>router.setParams({from:'',to:''})} style={{minHeight:44,justifyContent:'center',paddingHorizontal:8}}><Text style={{fontFamily:'Manrope_700Bold',fontSize:12,color:Colors.primary}}>Clear</Text></TouchableOpacity></View>}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          accessibilityRole="button" accessibilityState={{selected: tab === 'vendors'}}
          style={[styles.segment, tab === 'vendors' && styles.segmentActive]}
          onPress={() => { Haptics.selectionAsync(); setTab('vendors'); router.setParams({view:'vendors'}); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, tab === 'vendors' && styles.segmentTextActive]}>{isPersonal?'Stores':'Vendors'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button" accessibilityState={{selected: tab === 'invoices'}}
          style={[styles.segment, tab === 'invoices' && styles.segmentActive]}
          onPress={() => { Haptics.selectionAsync(); setTab('invoices'); router.setParams({view:'invoices'}); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, tab === 'invoices' && styles.segmentTextActive]}>All {isPersonal?'Receipts':'Invoices'}</Text>
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

          {!dashboardError && sorted.length === 0 && (
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
          {invoicesError&&<LoadFailure message={invoicesError} hasData={allInvoices.length>0} onRetry={()=>setRetryInvoices(n=>n+1)}/>}
          {!invoicesError && !invoicesLoading && allInvoices.length === 0 ? (
            <OnboardingExplainer config={isPersonal?{...INVOICE_EXPLAINER,title:'Your shopping,\nall in one place',subtitle:'Scan and review a grocery or household receipt. Saved purchases build your spending history by store and purchase date.',ctaLabel:'Scan a receipt'}:INVOICE_EXPLAINER} onCta={goToScan} />
          ) : (
            <>
              <View style={styles.searchWrap}>
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  accessibilityLabel="Search invoices by vendor or invoice number"
                  placeholder="Search vendor or invoice number"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {invoicesLoading && !allInvoices.length ? (
                  <View style={styles.empty}><Spinner /></View>
                ) : (
                  <>
                    {filteredInvoices.map((inv) => (
                      <InvoiceRow key={inv.id} invoice={inv} showVendorName onPress={() => {
                        Haptics.selectionAsync();
                        router.push(`/invoice/${inv.id}`);
                      }} />
                    ))}
                    {!invoicesError && filteredInvoices.length === 0 && (
                      <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>No matches</Text>
                        <Text style={styles.emptySub}>Try another search or clear the date filter.</Text>
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
        config={isPersonal?{...INVOICE_EXPLAINER,title:'Your shopping,\nall in one place',subtitle:'Scan and review a grocery or household receipt. Saved purchases build your spending history by store and purchase date.',ctaLabel:'Scan a receipt'}:INVOICE_EXPLAINER}
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
          <Text style={[styles.vendorAvatarText, { color: Colors.textPrimary }]}>
            {initialsFor(v.name)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.vendorName} numberOfLines={1}>{v.name}</Text>
          <Text style={styles.vendorMeta}>
            {v.invoiceCount} invoice{v.invoiceCount === 1 ? '' : 's'} total · last order {v.lastOrder}
          </Text>
        </View>
        <View style={styles.vendorSpendPill}>
          <Text style={styles.vendorSpendAmt}>${Math.round(periodAmount).toLocaleString()}</Text>
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
  title: { fontSize: 32, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -1},
  subtitle: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 2 },

  segmentRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.surface, borderRadius: Design.radius.pill, borderWidth: 1, borderColor: Colors.border, padding: 3,
  },
  segment: { justifyContent: 'center', minHeight: 44, flex: 1, paddingVertical: 8, borderRadius: Design.radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.accent},
  segmentText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primaryDark },

  searchWrap: { paddingHorizontal: 16, marginBottom: 10 },
  searchInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Design.radius.pill,
    paddingHorizontal: 14, height: 44,
    fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary,
  },

  scroll: { padding: 20, gap: 11, paddingBottom: 120 },

  vendorCard: {
    backgroundColor: Colors.surface, borderRadius: Design.radius.card,
    borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 12, shadowOpacity: 0,
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

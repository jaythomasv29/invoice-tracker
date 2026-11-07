import LoadFailure from '../../components/ui/LoadFailure';
import { buildDemoInvoices } from '../../lib/demoData';
import { useWorkspace } from '../../lib/workspaceContext';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import SafeAreaView from '../../components/ui/Screen';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../constants/Colors';
import { useStore, Invoice } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { fetchVendorInvoices, fallbackVendorColor } from '../../lib/invoicePipeline';
import { initialsFor } from '../../lib/initials';
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
  const { organization, isPersonal } = useWorkspace();
  const supabase = useSupabase();
  const { vendors, demoMode } = useStore();
  const [remoteVendor,setRemoteVendor]=useState<{id:string;name:string;color:string;contactName?:string;contactPhone?:string;accountNumber?:string}|null>(null);
  const [loadError,setLoadError]=useState('');
  const [retry,setRetry]=useState(0);
  const { isPaid } = useEntitlement();

  const vendor = vendors.find((v) => v.id === id) ?? (remoteVendor?.id===id?remoteVendor:null);
  const [vendorInvoices, setVendorInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedVendorId,setLoadedVendorId]=useState(id);
  const displayedInvoices=loadedVendorId===id?vendorInvoices:[];

  // Focus (not mount) effect — so returning here after deleting an invoice
  // from the detail screen drops the now-gone row instead of leaving a
  // stale one behind until the app is fully reloaded.
  useFocusEffect(
    useCallback(() => {
      if (!organization?.id || !id) return;
      if(demoMode){setVendorInvoices(buildDemoInvoices(useStore.getState().demoKind).filter(inv=>inv.vendorId===id));setLoadedVendorId(id);setLoading(false);return;}
      let live=true;const scope=useStore.getState().activeScope;
      setLoading(true);setLoadError('');
      void Promise.all([fetchVendorInvoices(supabase,organization.id,id),supabase.from('vendors').select('name,color,contact_name,contact_phone,account_number').eq('id',id).eq('organization_id',organization.id).single()])
        .then(([invoices,result])=>{
          if(!live||useStore.getState().activeScope!==scope)return;
          if(result.error||!result.data)throw new Error(isPersonal?'Could not load store details.':'Could not load supplier details.');
          setVendorInvoices(invoices);setLoadedVendorId(id);const v=result.data;setRemoteVendor({id,name:v.name,color:v.color||fallbackVendorColor(id),contactName:v.contact_name||undefined,contactPhone:v.contact_phone||undefined,accountNumber:v.account_number||undefined});
        })
        .catch(()=>{if(live&&useStore.getState().activeScope===scope)setLoadError(isPersonal?'Could not refresh this store’s receipts.':'Could not refresh this supplier’s invoices.');})
        .finally(()=>{if(live&&useStore.getState().activeScope===scope)setLoading(false);});
      return()=>{live=false;};
    // Retry version intentionally reruns this focused fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization?.id, id, supabase,demoMode,retry])
  );

  if (!vendor) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>{loading ? (isPersonal ? 'Loading store…' : 'Loading supplier…') : (isPersonal ? 'Store details' : 'Supplier details')}</Text>
        </View>
        {loading?<Spinner/>:<LoadFailure message={loadError||(isPersonal?'Store could not be found.':'Supplier could not be found.')} onRetry={()=>setRetry(n=>n+1)}/>}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <View style={[styles.vendorAvatar, { backgroundColor: vendor.color + '20' }]}>
          <Text style={[styles.vendorAvatarText, { color: vendor.color }]}>
            {initialsFor(vendor.name)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{vendor.name}</Text>
          <Text style={styles.headerSub}>
            {loading ? 'Loading…' : `${displayedInvoices.length} ${isPersonal ? 'receipt' : 'invoice'}${displayedInvoices.length === 1 ? '' : 's'} captured`}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {(vendor.contactName || vendor.accountNumber || vendor.contactPhone) && (
          <View style={styles.contactCard}>
            {vendor.contactName && !isPersonal && <Text style={styles.contactItem}>Rep: {vendor.contactName}</Text>}
            {vendor.accountNumber && <Text style={styles.contactItem}>Acct: {vendor.accountNumber}</Text>}
            {vendor.contactPhone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${vendor.contactPhone}`)} accessibilityRole="link" accessibilityLabel={`Call ${vendor.name}, ${vendor.contactPhone}`}>
                <Text style={styles.contactPhone}>{vendor.contactPhone}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isPaid && !loading && displayedInvoices.length > 0 && (() => {
          const orderCount = displayedInvoices.length;
          const avgOrderSize = displayedInvoices.reduce((sum, inv) => sum + inv.total, 0) / orderCount;
          const cadence = cadenceLabel(displayedInvoices);
          return (
            <View style={styles.patternsCard}>
              <Text style={styles.patternsHeader}>{isPersonal ? 'Shopping patterns' : 'Order patterns'}</Text>
              <View style={styles.patternsRow}>
                <View style={styles.patternsTile}>
                  <Text style={styles.patternsValue}>
                    ${Math.round(avgOrderSize).toLocaleString('en-US')}
                  </Text>
                  <Text style={styles.patternsLabel}>{isPersonal ? 'Avg trip' : 'Avg order'}</Text>
                </View>
                <View style={styles.patternsTile}>
                  <Text style={styles.patternsValue}>{orderCount}</Text>
                  <Text style={styles.patternsLabel}>{isPersonal ? 'Trips' : 'Orders'}</Text>
                </View>
                <View style={styles.patternsTile}>
                  <Text style={styles.patternsValue}>{cadence}</Text>
                  <Text style={styles.patternsLabel}>Cadence</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {!!loadError&&<LoadFailure message={loadError} hasData={displayedInvoices.length>0} onRetry={()=>setRetry(n=>n+1)}/>}
        <Text style={styles.sectionLabel}>{isPersonal?'Receipts':'Invoices'}</Text>
        {loading ? (
          <View style={styles.empty}>
            <Spinner />
          </View>
        ) : (
          <>
            {displayedInvoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} onPress={() => {
                Haptics.selectionAsync();
                router.push(`/invoice/${inv.id}`);
              }} />
            ))}
            {!loadError && displayedInvoices.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{isPersonal ? 'No receipts yet' : 'No invoices yet'}</Text>
                <Text style={styles.emptySub}>Scanned {isPersonal ? 'receipts' : 'invoices'} from {vendor.name} will show up here.</Text>
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

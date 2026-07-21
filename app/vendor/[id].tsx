import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore, Invoice } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { fetchVendorInvoices } from '../../lib/invoicePipeline';
import Spinner from '../../components/ui/Spinner';

export default function VendorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { organization } = useOrganization();
  const supabase = useSupabase();
  const { vendors } = useStore();

  const vendor = vendors.find((v) => v.id === id);
  const [vendorInvoices, setVendorInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id || !id) return;
    setLoading(true);
    fetchVendorInvoices(supabase, organization.id, id)
      .then(setVendorInvoices)
      .catch(() => setVendorInvoices([]))
      .finally(() => setLoading(false));
  }, [organization?.id, id, supabase]);

  if (!vendor) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <View style={styles.backChevron} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vendor not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <View style={styles.backChevron} />
        </TouchableOpacity>
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

function InvoiceRow({ invoice: inv, onPress }: { invoice: Invoice; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.invoiceRow} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.invoiceNumber}>Invoice #{inv.invoiceNumber}</Text>
        <Text style={styles.invoiceMeta}>{inv.date} · {inv.lineItems.length} items</Text>
      </View>
      <Text style={styles.invoiceTotal}>${inv.total.toFixed(2)}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
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
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  backChevron: {
    width: 9, height: 9, borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: Colors.textPrimary, transform: [{ rotate: '-45deg' }], marginLeft: 3,
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

  sectionLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary,
    marginTop: 6, marginBottom: 2,
  },

  invoiceRow: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  invoiceNumber: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  invoiceMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  invoiceTotal: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },
  chevron: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptySub: { fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});

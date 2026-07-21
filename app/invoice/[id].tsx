import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { Invoice, LineItem } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { fetchInvoiceById, fetchInvoiceImageUrls } from '../../lib/invoicePipeline';
import Spinner from '../../components/ui/Spinner';
import ImageViewerModal from '../../components/ui/ImageViewerModal';

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { organization } = useOrganization();
  const supabase = useSupabase();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [imageUris, setImageUris] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  useEffect(() => {
    if (!organization?.id || !id) return;
    setLoading(true);
    setLoadError('');
    fetchInvoiceById(supabase, organization.id, id)
      .then(setInvoice)
      .catch((err: any) => setLoadError(err?.message ?? 'Could not load invoice'))
      .finally(() => setLoading(false));
  }, [organization?.id, id, supabase]);

  const handleViewOriginal = async () => {
    if (!organization?.id || !id) return;
    if (imageUris.length > 0) {
      setImageViewerOpen(true);
      return;
    }
    setImagesLoading(true);
    try {
      const uris = await fetchInvoiceImageUrls(supabase, organization.id, id);
      setImageUris(uris);
      setImageViewerOpen(true);
    } finally {
      setImagesLoading(false);
    }
  };

  if (loading || !invoice) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <View style={styles.backChevron} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {loading ? 'Loading…' : loadError ? 'Could not load invoice' : 'Invoice not found'}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {loading ? <Spinner /> : loadError ? <Text style={styles.headerSub}>{loadError}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  const { vendorName, invoiceNumber, date, lineItems, subtotal, tax, total } = invoice;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <View style={styles.backChevron} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{vendorName}</Text>
          <Text style={styles.headerSub}>Invoice #{invoiceNumber} · {date}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.imageTile} activeOpacity={0.7} onPress={handleViewOriginal} disabled={imagesLoading}>
          {imagesLoading ? (
            <Spinner size={16} />
          ) : (
            <Text style={styles.imageLink}>View original invoice · {invoice.pages} page{invoice.pages !== 1 ? 's' : ''}</Text>
          )}
        </TouchableOpacity>

        {lineItems.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </ScrollView>

      <ImageViewerModal
        visible={imageViewerOpen}
        uris={imageUris}
        onClose={() => setImageViewerOpen(false)}
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax</Text>
          <Text style={styles.totalValue}>${tax.toFixed(2)}</Text>
        </View>
        <View style={[styles.totalRow, styles.totalRowGrand]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>${total.toFixed(2)}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ItemCard({ item }: { item: LineItem }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[styles.catBadge, { backgroundColor: item.catColor + '20' }]}>
            <Text style={[styles.catBadgeText, { color: item.catColor }]}>{item.category}</Text>
          </View>
          <Text style={styles.itemDesc}>{item.desc}</Text>
          {item.rawDesc && (
            <Text style={styles.itemRawDesc} numberOfLines={1}>Printed as: {item.rawDesc}</Text>
          )}
          <Text style={styles.itemMeta}>{item.qty} {item.unit} @ ${item.unitPrice.toFixed(2)}</Text>
        </View>
        <Text style={styles.itemExt}>${item.ext.toFixed(2)}</Text>
      </View>
    </View>
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
  headerTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  headerSub: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },

  scroll: { padding: 16, gap: 11, paddingBottom: 8 },

  imageTile: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  imageLink: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.primary },

  itemCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 15,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  catBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  catBadgeText: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  itemDesc: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  itemRawDesc: { fontSize: 11, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 2 },
  itemMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 3 },
  itemExt: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },

  footer: {
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 18, paddingBottom: 28, gap: 7,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  totalValue: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  totalRowGrand: { paddingTop: 3, alignItems: 'center' },
  grandLabel: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  grandValue: { fontSize: 22, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5 },
});

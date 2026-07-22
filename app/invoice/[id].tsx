import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { Invoice, LineItem } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { fetchInvoiceById, fetchInvoiceImageUrls, updateLineItem, setLineItemVoided, deleteInvoice } from '../../lib/invoicePipeline';
import Spinner from '../../components/ui/Spinner';
import ImageViewerModal from '../../components/ui/ImageViewerModal';
import BackButton from '../../components/ui/BackButton';
import LineItemDisplay from '../../components/ui/LineItemDisplay';
import EditLineItemModal from '../../components/ui/EditLineItemModal';
import Toast from '../../components/ui/Toast';
import { useStore } from '../../store/useStore';

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

  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [voidingItemId, setVoidingItemId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const showToast = useStore((s) => s.showToast);

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

  const handleSaveEdit = async (updates: { desc: string; qty: number; unitPrice: number }) => {
    if (!invoice || !editingItem) return;
    setIsSavingEdit(true);
    try {
      const otherLineItemsTotal = invoice.lineItems
        .filter((it) => it.id !== editingItem.id)
        .reduce((sum, it) => sum + it.ext, 0);

      const { subtotal, total, extendedPrice } = await updateLineItem(
        supabase, invoice.id, editingItem.id, updates, otherLineItemsTotal, invoice.tax
      );

      setInvoice({
        ...invoice,
        subtotal,
        total,
        lineItems: invoice.lineItems.map((it) =>
          it.id === editingItem.id
            ? { ...it, desc: updates.desc, qty: updates.qty, unitPrice: updates.unitPrice, ext: extendedPrice }
            : it
        ),
      });
      setEditingItem(null);
      showToast('Item updated');
    } catch (err: any) {
      showToast(err?.message ?? 'Could not update item');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleItemVoid = async (item: LineItem) => {
    if (!invoice) return;
    const voided = !item.voided;
    setVoidingItemId(item.id);
    try {
      const activeLineItemsTotal = invoice.lineItems
        .filter((it) => (it.id === item.id ? !voided : !it.voided))
        .reduce((sum, it) => sum + it.ext, 0);

      const { subtotal, total } = await setLineItemVoided(
        supabase, invoice.id, item.id, voided, activeLineItemsTotal, invoice.tax
      );

      setInvoice({
        ...invoice,
        subtotal,
        total,
        lineItems: invoice.lineItems.map((it) => (it.id === item.id ? { ...it, voided } : it)),
      });
      showToast(voided ? 'Item removed' : 'Item restored');
    } catch (err: any) {
      showToast(err?.message ?? 'Could not update item');
    } finally {
      setVoidingItemId(null);
    }
  };

  const handleDeleteInvoice = () => {
    if (!invoice) return;
    Alert.alert(
      'Delete this invoice?',
      "This can't be undone — the invoice and its line items will be permanently removed.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteInvoice(supabase, invoice.id);
              router.back();
            } catch (err: any) {
              showToast(err?.message ?? 'Could not delete invoice');
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !invoice) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
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
        <BackButton onPress={() => router.back()} />
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
          <LineItemDisplay
            key={item.id}
            item={item}
            onEdit={() => setEditingItem(item)}
            onToggleVoid={voidingItemId === item.id ? undefined : () => handleToggleItemVoid(item)}
          />
        ))}

        <TouchableOpacity
          style={styles.removeInvoiceBtn}
          onPress={handleDeleteInvoice}
          disabled={isDeleting}
          activeOpacity={0.7}
        >
          {isDeleting ? (
            <Spinner size={14} color={Colors.danger} />
          ) : (
            <Text style={styles.removeInvoiceBtnText}>Delete this invoice</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ImageViewerModal
        visible={imageViewerOpen}
        uris={imageUris}
        onClose={() => setImageViewerOpen(false)}
      />

      <EditLineItemModal
        item={editingItem}
        isSaving={isSavingEdit}
        onCancel={() => setEditingItem(null)}
        onSave={handleSaveEdit}
      />

      <Toast />

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  headerSub: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },

  scroll: { padding: 16, gap: 11, paddingBottom: 8 },

  imageTile: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  imageLink: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.primary },

  removeInvoiceBtn: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 12 },
  removeInvoiceBtnText: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.danger },

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

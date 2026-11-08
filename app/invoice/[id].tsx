import EditInvoiceDetailsModal from '../../components/ui/EditInvoiceDetailsModal';
import EditDetailsButton from '../../components/ui/EditDetailsButton';
import { useWorkspace } from '../../lib/workspaceContext';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import SafeAreaView from '../../components/ui/Screen';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { Colors } from '../../constants/Colors';
import { useStore, type Invoice, type LineItem } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import { fetchInvoiceById, fetchInvoiceImageUrls, updateLineItem, setLineItemVoided, deleteInvoice, updateInvoiceDetails, formatDate } from '../../lib/invoicePipeline';
import { buildDemoInvoices } from '../../lib/demoData';
import Spinner from '../../components/ui/Spinner';
import ImageViewerModal from '../../components/ui/ImageViewerModal';
import BackButton from '../../components/ui/BackButton';
import LineItemDisplay from '../../components/ui/LineItemDisplay';
import EditLineItemModal from '../../components/ui/EditLineItemModal';
import Toast from '../../components/ui/Toast';
import { money2 } from '../../lib/money';
import CreditRequestCard from '../../components/invoice/CreditRequestCard';
import { setCreditStatus, setLineMissing, shareCreditRequest, creditTotal, type CreditStatus } from '../../lib/creditRequest';

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { organization, isPersonal } = useWorkspace();
  const noun = isPersonal ? 'receipt' : 'invoice';
  const supabase = useSupabase();

  const demoMode = useStore(s => s.demoMode);
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
  const [editingDetails, setEditingDetails] = useState(false);
  const showToast = useStore((s) => s.showToast);
  // Opened from a link or notification there's no screen underneath — fall back to Home.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const [creditBusy, setCreditBusy] = useState(false);
  // Sample-tour invoices are client-side fixtures with fake ids — any write
  // would hit the real database, so edits there just explain themselves.
  const sampleOnly = () => { showToast(`Sample ${noun} — scan your own to edit`); };

  useEffect(() => {
    if (demoMode) { setInvoice(buildDemoInvoices(useStore.getState().demoKind).find(x => x.id === id) ?? null); setLoading(false); return; }
    if (!organization?.id || !id) return;
    setLoading(true);
    setLoadError('');
    fetchInvoiceById(supabase, organization.id, id)
      .then(setInvoice)
      .catch(() => setLoadError(`Could not load this ${noun}. Check your connection and try again.`))
      .finally(() => setLoading(false));
  }, [organization?.id, id, supabase, demoMode, noun]);

  const handleViewOriginal = async () => {
    if (demoMode) { sampleOnly(); return; }
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
    } catch {
      showToast(`Could not load the original ${noun}. Please retry.`);
    } finally {
      setImagesLoading(false);
    }
  };

  const handleSaveEdit = async (updates: { desc: string; qty: number; unitPrice: number; extendedPrice?: number }) => {
    if (!invoice || !editingItem) return;
    if (demoMode) { setEditingItem(null); sampleOnly(); return; }
    setIsSavingEdit(true);
    try {
      const { subtotal, total, extendedPrice } = await updateLineItem(
        supabase, invoice.id, editingItem.id, updates
      );

      setInvoice({
        ...invoice,
        subtotal,
        total,
        lineItems: invoice.lineItems.map((it) =>
          it.id === editingItem.id
            ? { ...it, normalizedCost:null, desc: updates.desc, qty: updates.qty, unitPrice: updates.unitPrice, ext: extendedPrice }
            : it
        ),
      });
      setEditingItem(null);
      showToast('Item updated');
    } catch (err: any) {
      showToast(err?.message ?? 'Could not update the item. Please retry.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleItemVoid = async (item: LineItem) => {
    if (!invoice) return;
    if (demoMode) { sampleOnly(); return; }
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
    } catch {
      showToast('Could not update the item. Please retry.');
    } finally {
      setVoidingItemId(null);
    }
  };

  const handleDeleteInvoice = () => {
    if (!invoice) return;
    if (demoMode) { sampleOnly(); return; }
    Alert.alert(
      `Delete this ${noun}?`,
      `This can't be undone — the ${noun} and its line items will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteInvoice(supabase, invoice.id);
              goBack();
            } catch {
              showToast(`Could not delete this ${noun}. Please retry.`);
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const missingLines = invoice && !isPersonal
    ? invoice.lineItems.filter((it) => it.verification === 'missing' && !it.voided && it.type !== 'credit' && it.ext > 0)
    : [];
  // Lines still owed by the vendor. Once every missing line is credited the
  // card flips to "Credit received" for the whole set; otherwise it only
  // counts, requests and closes what's still outstanding.
  const outstandingLines = missingLines.filter((it) => it.creditStatus !== 'credited');
  const creditState: CreditStatus | null = missingLines.length === 0 ? null
    : outstandingLines.length === 0 ? 'credited'
    : outstandingLines.every((it) => it.creditStatus === 'requested') ? 'requested'
    : null;
  const cardLines = creditState === 'credited' ? missingLines : outstandingLines;
  // Newly marked lines not yet asked about. A request covers only these;
  // with none left, "Resend request" re-sends everything outstanding.
  const newLines = outstandingLines.filter((it) => !it.creditStatus);
  const alreadyRequested = outstandingLines.filter((it) => it.creditStatus === 'requested');
  const requestLines = newLines.length > 0 ? newLines : outstandingLines;

  const patchLines = (ids: string[], patch: Partial<LineItem>) => {
    setInvoice((prev) => {
      if (!prev) return prev;
      const lineItems = prev.lineItems.map((it) => (ids.includes(it.id) ? { ...it, ...patch } : it));
      return { ...prev, lineItems, hasMissingItems: lineItems.some((it) => !it.voided && it.verification === 'missing') };
    });
  };

  const updateCredit = async (status: CreditStatus | null, ids: string[]) => {
    if (demoMode) { patchLines(ids, { creditStatus: status ?? undefined }); return true; }
    try {
      await setCreditStatus(supabase, ids, status);
      patchLines(ids, { creditStatus: status ?? undefined });
      return true;
    } catch (err: any) {
      showToast(err?.message ?? 'Could not update the credit. Please retry.');
      return false;
    }
  };

  const handleRequestCredit = async () => {
    if (!invoice || requestLines.length === 0) return;
    let sent = false;
    try {
      sent = await shareCreditRequest({
        vendorName: invoice.vendorName,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        restaurantName: organization?.name,
        lines: requestLines.map(({ id, desc, qty, unit, ext }) => ({ id, desc, qty, unit, ext })),
      });
    } catch {
      showToast('Could not open the share sheet');
      return;
    }
    if (!sent) return;
    const pending = requestLines.map((it) => it.id);
    setCreditBusy(true);
    if (await updateCredit('requested', pending)) showToast('Credit request sent — tracking it here');
    setCreditBusy(false);
  };

  const handleMarkCredited = async (credited: boolean) => {
    setCreditBusy(true);
    // Marking credited closes what's outstanding; undo reopens the whole set.
    const ids = (credited ? outstandingLines : missingLines).map((it) => it.id);
    if (await updateCredit(credited ? 'credited' : null, ids)) {
      showToast(credited ? 'Marked as credited' : 'Credit reopened');
    }
    setCreditBusy(false);
  };

  const handleToggleMissingSaved = async (item: LineItem) => {
    const missing = item.verification !== 'missing';
    if (demoMode) {
      patchLines([item.id], { verification: missing ? 'missing' : 'received', creditStatus: undefined });
      return;
    }
    try {
      await setLineMissing(supabase, item.id, missing);
      patchLines([item.id], { verification: missing ? 'missing' : 'received', creditStatus: undefined });
      showToast(missing ? 'Marked missing' : 'Marked received');
    } catch (err: any) {
      showToast(err?.message ?? 'Could not update the item. Please retry.');
    }
  };

  if (loading || !invoice) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => goBack()} />
          <Text style={styles.headerTitle}>
            {loading ? 'Loading…' : loadError ? `Could not load ${noun}` : isPersonal ? 'Receipt not found' : 'Invoice not found'}
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
        <BackButton onPress={() => goBack()} />
        <EditDetailsButton name={vendorName} subtitle={`${isPersonal ? 'Receipt' : 'Invoice'} #${invoiceNumber || '—'} · ${date || 'Add date'}`} onPress={() => setEditingDetails(true)} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {invoice.pages > 0 && (
          <TouchableOpacity style={styles.imageTile} activeOpacity={0.7} onPress={handleViewOriginal} disabled={imagesLoading}
            accessibilityRole="button" accessibilityLabel={`View original ${noun}`}>
            {imagesLoading ? (
              <Spinner size={16} />
            ) : (
              <Text style={styles.imageLink}>View original {noun} · {invoice.pages} page{invoice.pages !== 1 ? 's' : ''}</Text>
            )}
          </TouchableOpacity>
        )}

        {missingLines.length > 0 && (
          <CreditRequestCard
            count={cardLines.length}
            total={creditTotal(cardLines)}
            status={creditState}
            newCount={newLines.length}
            newTotal={creditTotal(newLines)}
            requestedCount={alreadyRequested.length}
            busy={creditBusy}
            onRequest={handleRequestCredit}
            onMarkCredited={() => handleMarkCredited(true)}
            onUndoCredited={() => handleMarkCredited(false)}
          />
        )}

        {lineItems.map((item) => (
          <LineItemDisplay
            key={item.id}
            item={item}
            onToggleMissingSaved={isPersonal ? undefined : () => handleToggleMissingSaved(item)}
            onEdit={() => setEditingItem(item)}
            onToggleVoid={voidingItemId === item.id ? undefined : () => handleToggleItemVoid(item)}
          />
        ))}

        <TouchableOpacity
          style={styles.removeInvoiceBtn}
          onPress={handleDeleteInvoice}
          disabled={isDeleting}
          activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel={`Delete this ${noun}`}
        >
          {isDeleting ? (
            <Spinner size={14} color={Colors.danger} />
          ) : (
            <Text style={styles.removeInvoiceBtnText}>Delete this {noun}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <EditInvoiceDetailsModal invoice={editingDetails ? invoice : null} onClose={() => setEditingDetails(false)} onSave={async details => {
        const scope = useStore.getState().activeScope;
        const vendorId = demoMode ? invoice.vendorId : await updateInvoiceDetails(supabase, invoice.id, details);
        if (useStore.getState().activeScope !== scope) return;
        setInvoice(previous => previous?.id === invoice.id ? { ...previous, ...details, vendorId, date: formatDate(details.dateIso) } : previous);
        showToast(isPersonal ? 'Receipt details updated' : 'Invoice details updated');
      }} />
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
          <Text style={styles.totalValue}>${money2(subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax</Text>
          <Text style={styles.totalValue}>${money2(tax)}</Text>
        </View>
        <View style={[styles.totalRow, styles.totalRowGrand]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>${money2(total)}</Text>
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

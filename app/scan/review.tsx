import EditLineItemModal from '../../components/ui/EditLineItemModal';
import EditInvoiceDetailsModal from '../../components/ui/EditInvoiceDetailsModal';
import EditDetailsButton from '../../components/ui/EditDetailsButton';
import { updateInvoiceDetails, updateLineItem, formatDate } from '../../lib/invoicePipeline';
import { Design } from '../../constants/Design';
import { useWorkspace } from '../../lib/workspaceContext';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
} from 'react-native';
import SafeAreaView from '../../components/ui/Screen';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../constants/Colors';
import { useStore, type LineItem } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import Toast from '../../components/ui/Toast';
import Spinner from '../../components/ui/Spinner';
import ImageViewerModal from '../../components/ui/ImageViewerModal';
import BackButton from '../../components/ui/BackButton';
import LineItemDisplay from '../../components/ui/LineItemDisplay';

export default function ReviewScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization, isPersonal } = useWorkspace();
  const [isSaving, setIsSaving] = useState(false);
  // Set right after a successful save, while `currentInvoice` has already
  // gone null (saveCurrentInvoice clears it) but we're still holding on this
  // screen for the brief confirmation beat before navigating home. Without
  // this the screen fell through to its "no invoice" blank-render guard for
  // that whole window instead of showing anything.
  const [justSaved, setJustSaved] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const {
    currentInvoice,
    confirmItem, toggleItemExpand,
    setVerification, setItemNote,
    saveCurrentInvoice, showToast,
  } = useStore();

  useEffect(() => {
    if (!currentInvoice && !isSaving && !justSaved) {
      router.replace('/scan');
    }
  }, [currentInvoice, isSaving, justSaved, router]);

  if (!currentInvoice) {
    if (justSaved) {
      return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.savedWrap}>
            <View style={styles.savedCheckCircle}>
              <Text style={styles.savedCheckMark}>✓</Text>
            </View>
            <Text style={styles.savedText}>{isPersonal?'Receipt':'Invoice'} saved</Text>
          </View>
        </SafeAreaView>
      );
    }
    return null;
  }

  const { vendorName, invoiceNumber, date, lineItems, subtotal, tax, total, imageUris, warnings } = currentInvoice;
  const pageCount = imageUris?.length ?? 1;

  const missingTotal = lineItems
    .filter((it) => it.verification === 'missing')
    .reduce((a, b) => a + b.ext, 0);

  const handleSave = async () => {
    if (!organization) {
      showToast(isPersonal?'No workspace selected':'No restaurant selected');
      return;
    }
    setIsSaving(true);
    try {
      await saveCurrentInvoice(supabase);
      if(isPersonal){void supabase.functions.invoke('refresh-household-insights',{body:{invoiceId:currentInvoice.id}}).catch(()=>{});}
      setJustSaved(true);
      setTimeout(() => router.replace('/(tabs)'), 900);
    } catch (err: any) {
      setIsSaving(false);
      showToast(err?.message ?? `Could not save ${isPersonal?'receipt':'invoice'}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <EditDetailsButton name={vendorName} subtitle={`${isPersonal ? 'Receipt' : 'Invoice'} #${invoiceNumber || '—'} · ${date || 'Add date'}`} onPress={() => setEditingDetails(true)} />
        <View style={styles.scannedBadge}>
          <Text style={styles.scannedText}>SCANNED</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Original image */}
        <TouchableOpacity
          style={styles.imageTile}
          activeOpacity={imageUris?.length ? 0.7 : 1}
          disabled={!imageUris?.length}
          onPress={() => setImageViewerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Original ${isPersonal?'receipt':'invoice'}, ${pageCount} page${pageCount !== 1 ? 's' : ''}`}
          accessibilityHint={imageUris?.length ? 'Opens the full image' : undefined}
        >
          {imageUris?.[0] ? (
            <Image source={{ uri: imageUris[0] }} style={styles.imageThumbnail} />
          ) : (
            <View style={styles.imageThumbnail} />
          )}
          <View>
            <Text style={styles.imageTitle}>Original {isPersonal?'receipt':'invoice'} · {pageCount} page{pageCount !== 1 ? 's' : ''}</Text>
            {!!imageUris?.length && <Text style={styles.imageLink}>tap to view full image</Text>}
          </View>
        </TouchableOpacity>

        {!!warnings?.length && (
          <View style={styles.warningBanner} accessibilityRole="alert">
            {warnings.map((w) => (
              <Text key={w} style={styles.warningText}>{w}</Text>
            ))}
          </View>
        )}

        {/* Line items */}
        {lineItems.map((item) => (
          <LineItemDisplay
            key={item.id}
            item={item}
            onEdit={() => setEditingItem(item)}
            onToggleExpand={() => toggleItemExpand(item.id)}
            onConfirm={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); confirmItem(item.id); }}
            onToggleMissing={() => { Haptics.selectionAsync(); setVerification(item.id, 'missing'); }}
            onChangeNote={(note) => setItemNote(item.id, note)}
          />
        ))}
      </ScrollView>

      {/* Footer */}
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
        {missingTotal > 0 && (
          <View style={styles.missingRow}>
            <Text style={styles.missingLabel}>Marked missing</Text>
            <Text style={styles.missingValue}>${missingTotal.toFixed(2)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={isSaving ? 'Saving' : `Save ${isPersonal?'receipt':'invoice'}`}
          accessibilityState={{ disabled: isSaving, busy: isSaving }}
        >
          {isSaving ? (
            <View style={styles.saveBtnContent}>
              <Spinner size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Saving…</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>Save {isPersonal?'receipt':'invoice'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <EditLineItemModal item={editingItem} isSaving={savingItem} onCancel={() => setEditingItem(null)} onSave={async updates => {
        if (!editingItem || savingItem) return;
        setSavingItem(true); const scope = useStore.getState().activeScope;
        try { const totals = await updateLineItem(supabase, currentInvoice.id, editingItem.id, updates);
          if (useStore.getState().activeScope !== scope) return;
          const latest = useStore.getState().currentInvoice;
          if (latest?.id === currentInvoice.id) useStore.getState().setCurrentInvoice({...latest, subtotal:totals.subtotal, total:totals.total, lineItems:latest.lineItems.map(it=>it.id===editingItem.id ? {...it,desc:updates.desc,qty:updates.qty,unitPrice:updates.unitPrice,ext:totals.extendedPrice,normalizedCost:null,confirmed:true,needsConfirm:false} : it)});
          setEditingItem(null);
        } catch(e) { showToast((e as Error).message); } finally {setSavingItem(false);}
      }} />
      <EditInvoiceDetailsModal invoice={editingDetails ? currentInvoice : null} onClose={() => setEditingDetails(false)} onSave={async details => {
        const scope = useStore.getState().activeScope;
        const vendorId = await updateInvoiceDetails(supabase, currentInvoice.id, details);
        if (useStore.getState().activeScope !== scope) return;
        const latest = useStore.getState().currentInvoice;
        if (latest?.id === currentInvoice.id) useStore.getState().setCurrentInvoice({ ...latest, ...details, vendorId, date: formatDate(details.dateIso) });
        showToast(isPersonal?'Receipt details updated':'Invoice details updated');
      }} />
      <ImageViewerModal
        visible={imageViewerOpen}
        uris={imageUris ?? []}
        onClose={() => setImageViewerOpen(false)}
      />

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  warningBanner: { backgroundColor: Colors.warningLight, borderRadius: 12, padding: 12, gap: 4, marginBottom: 12 },
  warningText: { fontSize: 13, lineHeight: 19, fontFamily: 'Manrope_600SemiBold', color: Colors.warning },
  savedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  savedCheckCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  savedCheckMark: { fontSize: 30, fontFamily: 'Manrope_800ExtraBold', color: Colors.primaryDark },
  savedText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  vendorName: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  invoiceMetaRow: { flexDirection: 'row', marginTop: 1 },
  invoiceMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  dateEditable: { color: Colors.primaryDark, textDecorationLine: 'underline' },
  scannedBadge: { backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  scannedText: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.6, color: Colors.primaryDark },

  scroll: { padding: 16, gap: 11, paddingBottom: 8 },

  imageTile: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 11,
  },
  imageThumbnail: {
    width: 44, height: 56, borderRadius: 7,
    backgroundColor: Colors.border,
  },
  imageTitle: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, lineHeight: 20 },
  imageLink: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.primary, textDecorationLine: 'underline' },

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
  missingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.dangerLight, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, marginTop: 2,
  },
  missingLabel: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.danger },
  missingValue: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.danger },
  saveBtn: { paddingVertical: 14, minHeight: 52,
    backgroundColor: Colors.textPrimary, borderRadius: Design.radius.pill,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  saveBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },
});

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore, LineItem, VerificationStatus } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import Toast from '../../components/ui/Toast';
import Spinner from '../../components/ui/Spinner';
import ImageViewerModal from '../../components/ui/ImageViewerModal';
import DatePickerModal from '../../components/ui/DatePickerModal';

export default function ReviewScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const {
    currentInvoice,
    confirmItem, toggleItemExpand,
    setVerification,
    saveCurrentInvoice, setCurrentInvoiceDate, showToast,
  } = useStore();

  useEffect(() => {
    if (!currentInvoice && !isSaving) {
      router.replace('/scan');
    }
  }, [currentInvoice, isSaving, router]);

  if (!currentInvoice) {
    return null;
  }

  const { vendorName, invoiceNumber, date, dateIso, lineItems, subtotal, tax, total, imageUris } = currentInvoice;
  const pageCount = imageUris?.length ?? 1;

  const disputeTotal = lineItems
    .filter((it) => it.verification === 'missing')
    .reduce((a, b) => a + b.ext, 0);

  const handleSave = async () => {
    if (!organization) {
      showToast('No restaurant selected');
      return;
    }
    setIsSaving(true);
    try {
      await saveCurrentInvoice(supabase, organization.id);
      setTimeout(() => router.replace('/(tabs)'), 900);
    } catch (err: any) {
      setIsSaving(false);
      showToast(err?.message ?? 'Could not save invoice');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <View style={styles.backChevron} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.vendorName}>{vendorName}</Text>
          <View style={styles.invoiceMetaRow}>
            <Text style={styles.invoiceMeta}>Invoice #{invoiceNumber} · </Text>
            <TouchableOpacity onPress={() => setDatePickerOpen(true)} activeOpacity={0.7}>
              <Text style={[styles.invoiceMeta, styles.dateEditable]}>
                {date || 'Add date'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
        >
          {imageUris?.[0] ? (
            <Image source={{ uri: imageUris[0] }} style={styles.imageThumbnail} />
          ) : (
            <View style={styles.imageThumbnail} />
          )}
          <View>
            <Text style={styles.imageTitle}>Original invoice · {pageCount} page{pageCount !== 1 ? 's' : ''}</Text>
            {!!imageUris?.length && <Text style={styles.imageLink}>tap to view full image</Text>}
          </View>
        </TouchableOpacity>

        {/* Line items */}
        {lineItems.map((item) => (
          <LineItemCard
            key={item.id}
            item={item}
            onToggleExpand={() => toggleItemExpand(item.id)}
            onConfirm={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); confirmItem(item.id); }}
            onSetVerify={(s: VerificationStatus) => { Haptics.selectionAsync(); setVerification(item.id, s); }}
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
        {disputeTotal > 0 && (
          <View style={styles.disputeRow}>
            <Text style={styles.disputeLabel}>To dispute</Text>
            <Text style={styles.disputeValue}>${disputeTotal.toFixed(2)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={isSaving}
        >
          {isSaving ? (
            <View style={styles.saveBtnContent}>
              <Spinner size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Saving…</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>Save invoice</Text>
          )}
        </TouchableOpacity>
      </View>

      <ImageViewerModal
        visible={imageViewerOpen}
        uris={imageUris ?? []}
        onClose={() => setImageViewerOpen(false)}
      />

      <DatePickerModal
        visible={datePickerOpen}
        value={dateIso}
        onSelect={setCurrentInvoiceDate}
        onClose={() => setDatePickerOpen(false)}
      />

      <Toast />
    </SafeAreaView>
  );
}

function LineItemCard({
  item, onToggleExpand, onConfirm, onSetVerify,
}: {
  item: LineItem;
  onToggleExpand: () => void;
  onConfirm: () => void;
  onSetVerify: (s: VerificationStatus) => void;
}) {
  const verification = item.verification;

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

      {/* Needs confirm */}
      {item.needsConfirm && !item.confirmed && (
        <TouchableOpacity style={styles.confirmBanner} onPress={onToggleExpand} activeOpacity={0.85}>
          <View style={styles.confirmDot} />
          <Text style={styles.confirmTitle}>Quick check needed</Text>
          <Text style={styles.confirmChevron}>›</Text>
        </TouchableOpacity>
      )}
      {item.expanded && item.needsConfirm && !item.confirmed && (
        <View style={styles.confirmExpanded}>
          <Text style={styles.confirmNote}>{item.confirmNote}</Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={styles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.confirmed && item.needsConfirm && (
        <View style={styles.confirmedBadge}>
          <Text style={styles.confirmedText}>✓ Confirmed</Text>
        </View>
      )}

      {/* Verification buttons */}
      <View style={styles.verifyRow}>
        {(['received', 'missing'] as VerificationStatus[]).map((status) => {
          const isActive = verification === status;
          const btnActiveStyle = status === 'received' ? styles.verify_received : styles.verify_missing;
          const textActiveStyle = status === 'received' ? styles.verify_received_text : styles.verify_missing_text;
          return (
          <TouchableOpacity
            key={status}
            style={[styles.verifyBtn, isActive && btnActiveStyle]}
            onPress={() => onSetVerify(status)}
            activeOpacity={0.85}
          >
            <Text style={[styles.verifyBtnText, isActive && textActiveStyle]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
          );
        })}
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
    alignItems: 'center', justifyContent: 'center',
  },
  backChevron: {
    width: 9, height: 9, borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: Colors.textPrimary, transform: [{ rotate: '-45deg' }], marginLeft: 3,
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

  itemCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 15, gap: 11,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  catBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  catBadgeText: { fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  itemDesc: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  itemRawDesc: { fontSize: 11, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 2 },
  itemMeta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 3 },
  itemExt: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },

  confirmBanner: {
    backgroundColor: Colors.warningLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  confirmDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.warning },
  confirmTitle: { flex: 1, fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.warning },
  confirmChevron: { fontSize: 18, color: Colors.warningMuted },
  confirmExpanded: { gap: 9, marginTop: -4 },
  confirmNote: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, lineHeight: 19 },
  confirmBtn: {
    alignSelf: 'flex-start', backgroundColor: Colors.textPrimary, borderRadius: 9,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  confirmBtnText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: '#fff' },
  confirmedBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.primaryLight,
    borderRadius: 8, paddingHorizontal: 11, paddingVertical: 5,
  },
  confirmedText: { fontSize: 11, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },

  verifyRow: { flexDirection: 'row', gap: 7 },
  verifyBtn: {
    flex: 1, textAlign: 'center', paddingVertical: 9, borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  verifyBtnText: { fontSize: 11.5, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },

  verify_received: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary + '40' },
  verify_received_text: { color: Colors.primaryDark },
  verify_missing: { backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: Colors.danger + '40' },
  verify_missing_text: { color: Colors.danger },

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
  disputeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.dangerLight, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, marginTop: 2,
  },
  disputeLabel: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.danger },
  disputeValue: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.danger },
  saveBtn: {
    backgroundColor: Colors.textPrimary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  saveBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },
});

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore } from '../../store/useStore';
import { useSupabase } from '../../lib/supabase';
import Toast from '../../components/ui/Toast';
import Spinner from '../../components/ui/Spinner';
import ImageViewerModal from '../../components/ui/ImageViewerModal';
import DatePickerModal from '../../components/ui/DatePickerModal';
import BackButton from '../../components/ui/BackButton';
import LineItemDisplay from '../../components/ui/LineItemDisplay';

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
    setVerification, setItemNote,
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

  const missingTotal = lineItems
    .filter((it) => it.verification === 'missing')
    .reduce((a, b) => a + b.ext, 0);

  const handleSave = async () => {
    if (!organization) {
      showToast('No restaurant selected');
      return;
    }
    setIsSaving(true);
    try {
      await saveCurrentInvoice(supabase);
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
        <BackButton onPress={() => router.back()} />
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
          <LineItemDisplay
            key={item.id}
            item={item}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  saveBtn: {
    backgroundColor: Colors.textPrimary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  saveBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#fff' },
});

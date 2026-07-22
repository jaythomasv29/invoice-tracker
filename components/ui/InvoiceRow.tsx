import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Invoice } from '../../store/useStore';

interface InvoiceRowProps {
  invoice: Invoice;
  onPress: () => void;
  // Cross-vendor lists (e.g. "All Invoices") need the vendor name in the
  // title; a single vendor's own invoice list already shows it in the
  // screen header, so it's redundant there.
  showVendorName?: boolean;
}

export default function InvoiceRow({ invoice: inv, onPress, showVendorName }: InvoiceRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {showVendorName ? (
          <>
            <Text style={styles.title} numberOfLines={1}>{inv.vendorName}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              Invoice #{inv.invoiceNumber || '—'} · {inv.date} · {inv.lineItems.length} items
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Invoice #{inv.invoiceNumber}</Text>
            <Text style={styles.meta}>{inv.date} · {inv.lineItems.length} items</Text>
          </>
        )}
        {(inv.hasMissingItems || inv.hasNote) && (
          <View style={styles.pillRow}>
            {inv.hasMissingItems && (
              <View style={[styles.pill, styles.pillMissing]}>
                <Text style={[styles.pillText, styles.pillTextMissing]}>Item(s) missing</Text>
              </View>
            )}
            {inv.hasNote && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>Comment</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <Text style={styles.total}>${inv.total.toFixed(2)}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  title: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  meta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  total: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },
  chevron: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  pill: {
    backgroundColor: Colors.background, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  pillText: { fontSize: 10, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  pillMissing: { backgroundColor: Colors.dangerLight, borderColor: Colors.danger + '30' },
  pillTextMissing: { color: Colors.danger },
});

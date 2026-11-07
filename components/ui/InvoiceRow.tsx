import { Design } from '../../constants/Design';
import TouchableOpacity from './MotionTouchable';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Invoice } from '../../store/useStore';
import { money2 } from '../../lib/money';
import { useWorkspace } from '../../lib/workspaceContext';

interface InvoiceRowProps {
  invoice: Invoice;
  onPress: () => void;
  // Cross-vendor lists (e.g. "All Invoices") need the vendor name in the
  // title; a single vendor's own invoice list already shows it in the
  // screen header, so it's redundant there.
  showVendorName?: boolean;
}

export default function InvoiceRow({ invoice: inv, onPress, showVendorName }: InvoiceRowProps) {
  const { isPersonal } = useWorkspace();
  const noun = isPersonal ? 'Receipt' : 'Invoice';
  return (
    <TouchableOpacity style={styles.row} accessibilityLabel={`Open ${inv.vendorName} ${noun.toLowerCase()} ${inv.invoiceNumber}, ${inv.date}, $${money2(inv.total)}`} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {showVendorName ? (
          <>
            <Text style={styles.title} numberOfLines={1}>{inv.vendorName}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {noun} #{inv.invoiceNumber || '—'} · {inv.date} · {inv.lineItems.length} {inv.lineItems.length === 1 ? 'item' : 'items'}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>{noun} #{inv.invoiceNumber}</Text>
            <Text style={styles.meta}>{inv.date} · {inv.lineItems.length} {inv.lineItems.length === 1 ? 'item' : 'items'}</Text>
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
      <Text style={styles.total}>${money2(inv.total)}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: Colors.surface, borderRadius: 24,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowOpacity: 0,
  },
  title: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  meta: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },
  total: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary },
  chevron: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  pill: {
    backgroundColor: Colors.background, borderRadius: Design.radius.pill,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  pillText: { fontSize: 10, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  pillMissing: { backgroundColor: Colors.dangerLight, borderColor: Colors.danger + '30' },
  pillTextMissing: { color: Colors.danger },
});

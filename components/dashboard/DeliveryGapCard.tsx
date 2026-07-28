import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { DeliveryGapEntry } from '../../store/useStore';

interface DeliveryGapCardProps {
  total: number;
  items: DeliveryGapEntry[];
  onPressInvoice: (id: string) => void;
}

// Surfaces money already paid for product that never showed up — every item
// here was flagged "missing" (or the legacy "short") on its own review screen
// at save time, but until now that data went nowhere: no dollar total, no
// follow-up list, just a pill on the invoice detail page nobody revisits.
// This turns it into a short recovery worklist, each row linking straight to
// the invoice to dispute or credit-back with the vendor.
export default function DeliveryGapCard({ total, items, onPressInvoice }: DeliveryGapCardProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Shorted deliveries</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            Paid for, marked missing on arrival — worth a call to the vendor
          </Text>
        </View>
        <Text style={styles.total}>${total.toFixed(2)}</Text>
      </View>

      <View style={styles.list}>
        {items.slice(0, 5).map((it) => (
          <TouchableOpacity
            key={it.id}
            style={styles.row}
            onPress={() => onPressInvoice(it.invoiceId)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemName} numberOfLines={1}>{it.itemName}</Text>
              <Text style={styles.meta} numberOfLines={1}>{it.vendorName} · {it.dateLabel}</Text>
            </View>
            <Text style={styles.amount}>${it.amount.toFixed(2)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {items.length > 5 && (
        <Text style={styles.more}>+{items.length - 5} more</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 3, lineHeight: 16 },
  total: { fontSize: 19, fontFamily: 'Manrope_800ExtraBold', color: Colors.danger, letterSpacing: -0.4 },

  list: { marginTop: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemName: { fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  meta: { fontSize: 11, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 2 },
  amount: { fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.danger },

  more: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, marginTop: 10, textAlign: 'center' },
});

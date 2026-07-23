import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import type { MissingInvoiceFlag } from '../../hooks/useMissingInvoices';

// Pro dashboard card: vendors who invoice on a regular cadence but have gone
// quiet longer than usual — "you probably forgot to log an invoice."
export default function MissingInvoiceCard({
  flags,
  onPressVendor,
}: {
  flags: MissingInvoiceFlag[];
  onPressVendor?: (vendorId: string) => void;
}) {
  if (flags.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.dot} />
        <Text style={styles.header}>Possibly missing invoices</Text>
      </View>
      <Text style={styles.sub}>
        These vendors usually invoice regularly but have gone quiet — you may have one to log.
      </Text>

      {flags.slice(0, 4).map((f, i) => (
        <TouchableOpacity
          key={f.vendorId}
          style={[styles.row, i > 0 && styles.rowBorder]}
          activeOpacity={onPressVendor ? 0.7 : 1}
          onPress={onPressVendor ? () => onPressVendor(f.vendorId) : undefined}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.vendor} numberOfLines={1}>{f.vendorName}</Text>
            <Text style={styles.cadence}>Usually invoices {f.cadenceLabel}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{f.daysSince}d quiet</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning },
  header: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  sub: { fontSize: 12.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, lineHeight: 17, marginTop: 4, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  vendor: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  cadence: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 1 },
  badge: { backgroundColor: Colors.warningLight, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  badgeText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.warning },
});

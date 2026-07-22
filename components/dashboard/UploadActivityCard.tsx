import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { UploadActivityEntry } from '../../store/useStore';

interface UploadActivityCardProps {
  entries: UploadActivityEntry[];
  onPressInvoice: (id: string) => void;
}

export default function UploadActivityCard({ entries, onPressInvoice }: UploadActivityCardProps) {
  const backdatedCount = entries.filter((e) => e.isBackdated).length;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Upload activity</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {backdatedCount > 0
              ? `${backdatedCount} recent upload${backdatedCount === 1 ? '' : 's'} dated in a past week — see where they landed`
              : 'Invoices added to your account, most recent first'}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {entries.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={styles.row}
            onPress={() => onPressInvoice(e.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.dot, { backgroundColor: e.vendorColor }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.rowTop}>
                <Text style={styles.vendorName} numberOfLines={1}>{e.vendorName}</Text>
                <Text style={styles.amount}>${e.amount.toLocaleString()}</Text>
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                Dated {e.invoiceDateLabel} · Uploaded {e.uploadedLabel}
              </Text>
              <View style={styles.pillRow}>
                <View style={[styles.pill, e.isBackdated && styles.pillBackdated]}>
                  <Text style={[styles.pillText, e.isBackdated && styles.pillTextBackdated]}>
                    {e.periodLabel}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 3, lineHeight: 16 },

  list: { marginTop: 14, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  vendorName: { flex: 1, fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  amount: { fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  meta: { fontSize: 11, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 2 },

  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, flexWrap: 'wrap' },
  pill: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3,
  },
  pillBackdated: {
    backgroundColor: Colors.warningLight, borderColor: Colors.warning + '30',
  },
  pillText: { fontSize: 10, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  pillTextBackdated: { color: Colors.warning },
});

import { Design } from '../../constants/Design';
import TouchableOpacity from '../ui/MotionTouchable';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { PriceAlert } from '../../store/useStore';

interface AIInsightCardProps {
  priceAlerts: PriceAlert[];
  onPress: () => void;
}

// Surfaces price-creep detection (already computed into priceAlerts
// elsewhere) as a standalone "AI insight" card, separate from the
// single-alert PriceAlertBanner further down — this one summarizes the
// trend rather than nudging on one unread alert. Empty state entices
// scanning more invoices, since the detector needs repeat purchases of the
// same item to have anything to compare.
export default function AIInsightCard({ priceAlerts, onPress }: AIInsightCardProps) {
  const allIncreases = priceAlerts
    .filter((a) => a.pctChange > 0)
    .sort((a, b) => b.pctChange - a.pctChange);
  const increases=allIncreases.slice(0,3);

  const hasData = increases.length > 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Open price alerts">
      <View style={styles.headerRow}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
        <Text style={styles.title}>Price insight</Text>
      </View>

      {hasData ? (
        <>
          <Text style={styles.caption}>
            {allIncreases.length === 1 ? '1 item has' : `${allIncreases.length} items have`} crept up in price recently
          </Text>
          <View style={styles.list}>
            {increases.map((a) => (
              <View key={a.id} style={styles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{a.itemName}</Text>
                  <Text style={styles.vendorName} numberOfLines={1}>{a.vendorName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.pctChange}>+{Math.round(a.pctChange)}%</Text>
                  <Text style={styles.priceChange}>
                    ${a.previousPrice.toFixed(2)} → ${a.newPrice.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.viewAll}>View all in Alerts ›</Text>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your price watch is ready</Text>
          <Text style={styles.emptyBody}>
            As you log repeat purchases, Sift compares unit prices and surfaces increases here. Open Alerts to see your price watch.
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: Design.radius.card,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18, shadowOpacity: 0,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiBadge: {
    backgroundColor: Colors.primaryLight, borderRadius: 7,
    paddingHorizontal: 7, paddingVertical: 2.5,
  },
  aiBadgeText: {
    fontSize: 10, fontFamily: 'Manrope_800ExtraBold', letterSpacing: 0.5,
    color: Colors.primaryDark,
  },
  title: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  caption: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 8 },

  list: { marginTop: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemName: { fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  vendorName: { fontSize: 11, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 1 },
  pctChange: { fontSize: 13.5, fontFamily: 'Manrope_800ExtraBold', color: Colors.danger },
  priceChange: { fontSize: 10.5, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 1 },

  viewAll: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.primary, marginTop: 12 },

  empty: { marginTop: 12 },
  emptyTitle: { fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  emptyBody: {
    fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary,
    marginTop: 4, lineHeight: 17,
  },
});

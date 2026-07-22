import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { CategorySpend } from '../../store/useStore';
import DonutChart from '../ui/DonutChart';

export default function CategorySpendCard({ categorySpend }: { categorySpend: CategorySpend[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.tileLabel}>Spend by category</Text>
      <Text style={styles.tileCaption}>This week, across all vendors</Text>
      <View style={styles.verifyChartRow}>
        <View style={styles.donutWrap}>
          <DonutChart
            segments={categorySpend.map((c) => ({ key: c.category, value: c.amount, color: c.color }))}
            size={62}
            strokeWidth={10}
          />
        </View>
        <View style={styles.verifyLegend}>
          {categorySpend.map((c) => (
            <View key={c.category} style={styles.verifyLegendItem}>
              <View style={[styles.verifyLegendDot, { backgroundColor: c.color }]} />
              <Text style={styles.verifyLegendText} numberOfLines={1}>{c.category} · ${c.amount.toLocaleString()}</Text>
            </View>
          ))}
        </View>
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
  tileLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  tileCaption: { fontSize: 10.5, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 1, marginBottom: 10, lineHeight: 13 },
  verifyChartRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  donutWrap: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center' },
  verifyLegend: { flex: 1, minWidth: 0, gap: 3 },
  verifyLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifyLegendDot: { width: 6, height: 6, borderRadius: 3 },
  verifyLegendText: { fontSize: 10, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, flexShrink: 1 },
});

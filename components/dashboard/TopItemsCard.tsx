import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import type { TopItem } from '../../store/useStore';

const MAX_ROWS = 8;

function formatAmount(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

interface TopItemsCardProps {
  topItems: TopItem[];
}

export default function TopItemsCard({ topItems }: TopItemsCardProps) {
  if (topItems.length === 0) return null;

  // The "vital few": leading items whose cumulative share reaches ~80%.
  // Include items while the PREVIOUS item's cumulativePct is still under
  // 80 — that means the item that crosses the 80% line is included too.
  let vitalFewCount = 1;
  for (let i = 1; i < topItems.length; i++) {
    if (topItems[i - 1].cumulativePct < 80) {
      vitalFewCount++;
    } else {
      break;
    }
  }

  const vitalFewPct = Math.round(topItems[vitalFewCount - 1].cumulativePct);
  const rows = topItems.slice(0, MAX_ROWS);
  const topPct = topItems[0].pct || 1;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Top-spend items</Text>
      <Text style={styles.insight}>
        {vitalFewCount} item{vitalFewCount === 1 ? '' : 's'} {vitalFewCount === 1 ? 'is' : 'are'} {vitalFewPct}% of your spend
      </Text>

      <View style={styles.list}>
        {rows.map((item, i) => {
          const isVitalFew = i < vitalFewCount;
          const barWidth = Math.min(100, Math.max(2, (item.pct / topPct) * 100));

          return (
            <View key={item.name} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${barWidth}%`,
                        backgroundColor: isVitalFew ? Colors.primary : Colors.border,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.pct}>{item.pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 18,
  },
  title: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  insight: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 2, marginBottom: 14 },

  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: {
    width: 16, fontSize: 11, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary,
    textAlign: 'center',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  itemName: { flex: 1, minWidth: 0, fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  amount: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  barTrack: {
    height: 5, borderRadius: 3, backgroundColor: Colors.borderLight, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  pct: {
    width: 34, fontSize: 10.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary,
    textAlign: 'right',
  },
});

import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { DayData, SpendPeriod } from '../../store/useStore';
import { spendPeriodLabel, spendPeriodCompareLabel } from '../../hooks/useSpendPeriod';
import Spinner from '../ui/Spinner';

const CHART_H = 84;

interface SpendTrendCardProps {
  period: SpendPeriod;
  yearsBack: number;
  periodTotal: number;
  periodPctChange: number;
  barData: DayData[];
  isLoading?: boolean;
}

// Headline "is spend trending up or down" glance — sits above the
// per-vendor Total Invoices tile rather than duplicating its picker;
// it reads whatever period/years that card's picker has selected via the
// shared useSpendPeriod hook, so the two stay in sync with one control.
// Bars carry axis labels (day/week/year, whatever `barData` is bucketed by)
// and the single highest bar is direct-labeled with its $ value — without
// either, a row of bars with no reference points just reads as noise.
export default function SpendTrendCard({
  period, yearsBack, periodTotal, periodPctChange, barData, isLoading,
}: SpendTrendCardProps) {
  const compare = spendPeriodCompareLabel(period, yearsBack);
  const hasData = barData.some((d) => d.total > 0);
  const maxBar = Math.max(1, ...barData.map((d) => d.total));
  const peakIndex = hasData
    ? barData.reduce((best, d, i) => (d.total > barData[best].total ? i : best), 0)
    : -1;
  const currentIndex = barData.length - 1;

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{spendPeriodLabel(period, yearsBack)}</Text>
        {isLoading && <Spinner size={12} color={Colors.textSecondary} />}
      </View>
      <Text style={styles.amount}>${periodTotal.toLocaleString()}</Text>
      {compare && (
        <View style={styles.changeRow}>
          <Text style={[styles.changeArrow, periodPctChange > 0 && styles.changeUp]}>
            {periodPctChange >= 0 ? '↑' : '↓'}
          </Text>
          <Text style={[styles.changePct, periodPctChange > 0 && styles.changeUp]}>
            {Math.abs(periodPctChange)}%
          </Text>
          <Text style={styles.changeLabel}> {compare}</Text>
        </View>
      )}

      {hasData ? (
        <View style={styles.chart}>
          {barData.map((d, i) => {
            const isPeak = i === peakIndex;
            const isCurrent = i === currentIndex;
            const barH = Math.max(Math.round((d.total / maxBar) * (CHART_H - 18)), 3);
            return (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barValue}>
                  {isPeak ? `$${Math.round(d.total).toLocaleString()}` : ' '}
                </Text>
                <View style={[styles.barTrack, { height: CHART_H - 18 }]}>
                  <View
                    style={[
                      styles.bar,
                      { height: barH },
                      isCurrent ? styles.barCurrent : styles.barPast,
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, isCurrent && styles.barLabelCurrent]} numberOfLines={1}>
                  {d.label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.empty}>Scan a few invoices to see your spend trend here.</Text>
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  label: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  amount: { fontSize: 30, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.7 },
  changeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  changeArrow: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.primary, marginRight: 3 },
  changePct: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.primary },
  changeUp: { color: Colors.danger },
  changeLabel: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },

  empty: {
    fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary,
    marginTop: 16, lineHeight: 19,
  },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 18 },
  barCol: { flex: 1, alignItems: 'center' },
  barValue: {
    fontSize: 10, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary, marginBottom: 3,
  },
  barTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '62%', minWidth: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barPast: { backgroundColor: Colors.primaryMuted },
  barCurrent: { backgroundColor: Colors.primary },
  barLabel: {
    fontSize: 10, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, marginTop: 6,
  },
  barLabelCurrent: { color: Colors.textSecondary },
});

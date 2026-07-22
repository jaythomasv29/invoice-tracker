import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { DayData, SpendPeriod } from '../../store/useStore';
import { spendPeriodLabel, spendPeriodCompareLabel } from '../../hooks/useSpendPeriod';
import Spinner from '../ui/Spinner';
import SpendPeriodPicker from './SpendPeriodPicker';

const CHART_H = 120;

interface SpendCardProps {
  period: SpendPeriod;
  onChangePeriod: (period: SpendPeriod) => void;
  yearsBack: number;
  onChangeYears: (n: number) => void;
  maxYears: number;
  periodTotal: number;
  periodPctChange: number;
  barData: DayData[];
  selectedBar: number | null;
  onSelectBar: (i: number) => void;
  isLoading: boolean;
}

export default function SpendCard({
  period, onChangePeriod, yearsBack, onChangeYears, maxYears,
  periodTotal, periodPctChange, barData, selectedBar, onSelectBar, isLoading,
}: SpendCardProps) {
  const maxBar = Math.max(1, ...barData.map((d) => d.total));
  const selData = selectedBar !== null ? barData[selectedBar] : null;
  const compare = spendPeriodCompareLabel(period, yearsBack);

  const topVendors = useMemo(() => {
    const totals = new Map<string, { amount: number; color: string }>();
    for (const bar of barData) {
      for (const seg of bar.breakdown) {
        const existing = totals.get(seg.name);
        if (existing) existing.amount += seg.amount;
        else totals.set(seg.name, { amount: seg.amount, color: seg.color });
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 4);
  }, [barData]);

  return (
    <View style={styles.card}>
      <View style={styles.spendTop}>
        <View>
          <View style={styles.spendLabelRow}>
            <Text style={styles.spendLabel}>{spendPeriodLabel(period, yearsBack)}</Text>
            {isLoading && <Spinner size={12} color={Colors.textSecondary} />}
          </View>
          <Text style={styles.spendAmount}>${periodTotal.toLocaleString()}</Text>
          {compare && (
            <View style={styles.spendChange}>
              <Text style={[styles.spendChangeArrow, periodPctChange > 0 && styles.spendChangeUp]}>
                {periodPctChange >= 0 ? '↑' : '↓'}
              </Text>
              <Text style={[styles.spendChangePct, periodPctChange > 0 && styles.spendChangeUp]}>
                {Math.abs(periodPctChange)}%
              </Text>
              <Text style={styles.spendChangeLabel}> {compare}</Text>
            </View>
          )}
        </View>

        <SpendPeriodPicker
          period={period}
          onChangePeriod={onChangePeriod}
          yearsBack={yearsBack}
          onChangeYears={onChangeYears}
          maxYears={maxYears}
        />
      </View>

      {/* Breakdown popup */}
      {selData && (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownLabel}>{selData.label}</Text>
          {selData.breakdown.map((b, i) => (
            <View key={i} style={styles.breakdownRow}>
              <Text style={styles.breakdownName} numberOfLines={1}>{b.name}</Text>
              <Text style={styles.breakdownAmt}>${b.amount.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Legend */}
      {topVendors.length > 0 && (
        <View style={styles.legend}>
          {topVendors.map(([name, v]) => (
            <View key={name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: v.color }]} />
              <Text style={styles.legendText}>{name.split(' ')[0]}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Bar chart */}
      <View style={styles.chart}>
        {barData.map((d, i) => {
          const isDimmed = selectedBar !== null && selectedBar !== i;
          const isSelected = selectedBar === i;
          const barH = Math.max(Math.round((d.total / maxBar) * (CHART_H - 24)), 6);

          return (
            <TouchableOpacity
              key={i}
              style={[styles.barCol, isDimmed && { opacity: 0.3 }]}
              onPress={() => onSelectBar(i)}
              activeOpacity={0.8}
            >
              <View style={[styles.barStack, { height: CHART_H - 24 }]}>
                <View style={{ flex: 1 }} />
                <View style={{ width: '100%', overflow: 'hidden', borderRadius: 5 }}>
                  {d.breakdown.map((seg, si) => {
                    const segH = Math.max(Math.round((seg.amount / d.total) * barH), 3);
                    return (
                      <View key={si} style={{ width: '100%', height: segH, backgroundColor: seg.color }} />
                    );
                  })}
                </View>
              </View>
              <Text style={[styles.barLabel, isSelected && styles.barLabelActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
  spendTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  spendLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  spendLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  spendAmount: { fontSize: 34, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.8 },
  spendChange: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  spendChangeArrow: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.primary, marginRight: 3 },
  spendChangePct: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.primary },
  spendChangeUp: { color: Colors.danger },
  spendChangeLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },

  breakdown: {
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryMuted,
    borderRadius: 12, padding: 12, marginTop: 14,
  },
  breakdownLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.primaryDark, marginBottom: 5,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 },
  breakdownName: { flex: 1, fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary },
  breakdownAmt: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, columnGap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 3 },
  legendText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, height: CHART_H, marginTop: 12 },
  barCol: { flex: 1, alignItems: 'center', gap: 7 },
  barStack: { width: '100%', justifyContent: 'flex-end' },
  barLabel: { fontSize: 10.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },
  barLabelActive: { color: Colors.textSecondary },
});

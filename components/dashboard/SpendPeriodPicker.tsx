import { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { SpendPeriod } from '../../store/useStore';
import { spendPeriodBadge } from '../../hooks/useSpendPeriod';

interface SpendPeriodPickerProps {
  period: SpendPeriod;
  onChangePeriod: (period: SpendPeriod) => void;
  yearsBack: number;
  onChangeYears: (n: number) => void;
  maxYears: number;
}

// The "30d ▾" badge + dropdown (This week / This month / N-year stepper /
// All time) — shared by the vendors-page aggregate chart and any other
// spot that needs the same timeframe control (home vendor list, per-vendor
// pills) without duplicating the menu.
export default function SpendPeriodPicker({
  period, onChangePeriod, yearsBack, onChangeYears, maxYears,
}: SpendPeriodPickerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const clampedMax = Math.max(1, maxYears);

  const decYears = () => {
    if (period === 'all') {
      onChangePeriod('year');
      onChangeYears(Math.max(1, clampedMax - 1));
      return;
    }
    if (yearsBack > 1) onChangeYears(yearsBack - 1);
  };

  const incYears = () => {
    if (period === 'all') return;
    if (yearsBack >= clampedMax) {
      onChangePeriod('all');
      return;
    }
    onChangeYears(yearsBack + 1);
    if (period !== 'year') onChangePeriod('year');
  };

  return (
    <View style={styles.periodWrap}>
      <TouchableOpacity
        style={styles.periodBadge}
        onPress={() => setMenuOpen((o) => !o)}
        activeOpacity={0.7}
      >
        <Text style={styles.periodText}>{spendPeriodBadge(period, yearsBack)} ▾</Text>
      </TouchableOpacity>

      {menuOpen && (
        <>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.periodMenu}>
            <TouchableOpacity
              style={styles.periodOption}
              onPress={() => { onChangePeriod('week'); setMenuOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodOptionText, period === 'week' && styles.periodOptionTextActive]}>
                This week
              </Text>
              {period === 'week' && <Text style={styles.periodOptionCheck}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.periodOption}
              onPress={() => { onChangePeriod('month'); setMenuOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodOptionText, period === 'month' && styles.periodOptionTextActive]}>
                This month
              </Text>
              {period === 'month' && <Text style={styles.periodOptionCheck}>✓</Text>}
            </TouchableOpacity>

            <View style={styles.periodDivider} />

            <View style={styles.yearStepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, period !== 'all' && yearsBack <= 1 && styles.stepperBtnDisabled]}
                onPress={decYears}
                disabled={period !== 'all' && yearsBack <= 1}
                activeOpacity={0.6}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.yearLabelWrap}
                onPress={() => { onChangePeriod('year'); setMenuOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodOptionText, period === 'year' && styles.periodOptionTextActive]}>
                  {yearsBack}yr
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepperBtn, period === 'all' && styles.stepperBtnDisabled]}
                onPress={incYears}
                disabled={period === 'all'}
                activeOpacity={0.6}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.periodOption}
              onPress={() => { onChangePeriod('all'); setMenuOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodOptionText, period === 'all' && styles.periodOptionTextActive]}>
                All time
              </Text>
              {period === 'all' && <Text style={styles.periodOptionCheck}>✓</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  periodWrap: { position: 'relative', zIndex: 10 },
  backdrop: {
    position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000, zIndex: 15,
  },
  periodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7,
  },
  periodText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  periodMenu: {
    position: 'absolute', top: 40, right: 0, minWidth: 168,
    backgroundColor: Colors.surface, borderRadius: 13, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 4, zIndex: 20,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16,
  },
  periodOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 13, paddingVertical: 10,
  },
  periodOptionText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary },
  periodOptionTextActive: { color: Colors.primary, fontFamily: 'Manrope_700Bold' },
  periodOptionCheck: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.primary },
  periodDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 4, marginHorizontal: 8 },

  yearStepperRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, gap: 6 },
  yearLabelWrap: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  stepperBtn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperBtnText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, marginTop: -1 },
});

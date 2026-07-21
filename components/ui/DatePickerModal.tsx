import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Colors } from '../../constants/Colors';

interface DatePickerModalProps {
  visible: boolean;
  value: string | null;
  onSelect: (isoDate: string) => void;
  onClose: () => void;
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toIsoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Invoice dates should never be in the future — a delivery can't be dated
// ahead of today, so anything past today is almost certainly a bad OCR read.
function isFutureDate(y: number, m: number, d: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(y, m, d).getTime() > today.getTime();
}

// Lightweight custom calendar so editing a date doesn't require pulling in
// a native date-picker dependency (would need a dev-client rebuild).
export default function DatePickerModal({ visible, value, onSelect, onClose }: DatePickerModalProps) {
  const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
  const initial = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const selectedIso = value ?? null;

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const goToMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const handleSelectDay = (day: number) => {
    if (isFutureDate(viewYear, viewMonth, day)) return;
    onSelect(toIsoDate(viewYear, viewMonth, day));
    onClose();
  };

  const handleToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    onSelect(toIsoDate(t.getFullYear(), t.getMonth(), t.getDate()));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.navBtn} onPress={() => goToMonth(-1)} activeOpacity={0.7}>
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_LABELS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={styles.navBtn} onPress={() => goToMonth(1)} activeOpacity={0.7}>
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((w, i) => (
              <Text key={i} style={styles.weekdayLabel}>{w}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (day == null) return <View key={di} style={styles.dayCell} />;
                const iso = toIsoDate(viewYear, viewMonth, day);
                const isSelected = iso === selectedIso;
                const disabled = isFutureDate(viewYear, viewMonth, day);
                return (
                  <TouchableOpacity
                    key={di}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                    onPress={() => handleSelectDay(day)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      disabled && styles.dayTextDisabled,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={styles.todayBtn} onPress={handleToday} activeOpacity={0.85}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(10,10,16,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: Colors.surface,
    borderRadius: 18, padding: 18,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnText: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary, marginTop: -2 },
  monthLabel: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: {
    flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary,
  },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, margin: 1,
  },
  dayCellSelected: { backgroundColor: Colors.primary },
  dayText: { fontSize: 13.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary },
  dayTextSelected: { color: '#fff', fontFamily: 'Manrope_700Bold' },
  dayTextDisabled: { color: Colors.textTertiary, opacity: 0.4 },
  todayBtn: {
    marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 10, backgroundColor: Colors.background,
  },
  todayBtnText: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },
});

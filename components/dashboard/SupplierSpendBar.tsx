import { View, Text, StyleSheet } from 'react-native';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
const palette = ['#8ED8B5', '#F3BF77', '#9ABCF5', '#D6AEED', '#F49F97', '#80D7DD', '#D6D884', '#B8C1CF'];
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const transition = LinearTransition.duration(360).reduceMotion(ReduceMotion.System);

export default function SupplierSpendBar({ totals, vendors }: {
  totals: [string, number][]; vendors: { id: string; name: string }[];
}) {
  // The full supplier registry keeps colors stable when switching periods.
  const ids = [...new Set([...vendors.map(v => v.id), ...totals.map(([id]) => id)])].sort();
  const color = (id: string) => { const i = ids.indexOf(id); return palette[i] ?? `hsl(${(i * 137.508) % 360}, 60%, 73%)`; };
  const positive = totals.filter(([, value]) => value > 0 && Number.isFinite(value));
  const total = positive.reduce((sum, [, value]) => sum + value, 0);
  const credits = totals.some(([, value]) => value < 0);
  if (!totals.length) return null;
  return <View style={s.container}>
    <Text style={s.title}>Spending by supplier</Text>
    {total > 0 && <View style={s.track} accessible accessibilityLabel={positive.map(([id, value]) => `${vendors.find(v => v.id === id)?.name ?? 'Unknown supplier'}: ${(value / total * 100).toFixed(1)} percent`).join('. ')}>
      {positive.map(([id, value]) => <Animated.View key={id} layout={transition} style={{ flexBasis: 0, flexGrow: value / total, backgroundColor: color(id), height: '100%' }} />)}
    </View>}
    {totals.map(([id, value]) => <View key={id} style={s.row}>
      <View style={[s.dot, { backgroundColor: color(id) }]} />
      <Text style={s.name}>{vendors.find(v => v.id === id)?.name ?? 'Unknown supplier'}</Text>
      <Text style={s.amount}>{money(value)}</Text>
    </View>)}
    {credits && <Text style={s.note}>Bar shows suppliers with positive net spending. Credits remain included in your total and supplier amounts.</Text>}
  </View>;
}
const s = StyleSheet.create({
  container: { marginTop: 22, gap: 12 }, title: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: Colors.heroMuted },
  track: { height: 16, flexDirection: 'row', gap: 3, overflow: 'hidden', borderRadius: 8, backgroundColor: '#285342' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 }, dot: { width: 9, height: 9, borderRadius: 3 },
  name: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18, color: Colors.heroText },
  amount: { fontFamily: 'Manrope_700Bold', fontSize: 12, color: Colors.heroText, fontVariant: ['tabular-nums'] },
  note: { fontFamily: 'Manrope_400Regular', fontSize: 11, lineHeight: 17, color: Colors.heroMuted },
});

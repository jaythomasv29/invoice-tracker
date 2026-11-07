import { Design } from '../../constants/Design';
import { useWorkspace } from '../../lib/workspaceContext';
import Touch from '../ui/MotionTouchable';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { CategorySpend } from '../../store/useStore';
import DonutChart from '../ui/DonutChart';

export default function CategorySpendCard({ categorySpend, onOpenInvoices }: { categorySpend: CategorySpend[]; onOpenInvoices?:()=>void }) {
  const {isPersonal}=useWorkspace();
  return (
    <View style={styles.card}>
      <Touch onPress={onOpenInvoices} disabled={!onOpenInvoices} accessibilityRole="button" accessibilityLabel={isPersonal?'View receipts behind category spending':'View invoices behind category spending'} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={styles.tileLabel}>Spend by category</Text>{onOpenInvoices&&<Text style={{fontSize:12,fontFamily:'Manrope_700Bold',color:Colors.primary}}>{isPersonal?'Receipts':'Invoices'} ›</Text>}</Touch>
      <Text style={styles.tileCaption}>This week, across all {isPersonal?'stores':'suppliers'}</Text>
      <View style={styles.verifyChartRow}>
        <View style={styles.donutWrap}>
          <DonutChart
            segments={categorySpend.filter(c=>c.amount>0).map((c) => ({ key: c.category, value: c.amount, color: c.color }))}
            size={62}
            strokeWidth={10}
          />
        </View>
        <View style={styles.verifyLegend}>
          {categorySpend.map((c) => (
            <View key={c.category} style={styles.verifyLegendItem}>
              <View style={[styles.verifyLegendDot, { backgroundColor: c.color }]} />
              <Text style={styles.verifyLegendText} numberOfLines={1}>{c.category} · ${c.amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.tileCaption}>Line items before tax. Credits remain in the list; the ring shows positive category amounts.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: Design.radius.card,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18, shadowOpacity: 0,
  },
  tileLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  tileCaption: { fontSize: 10.5, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 1, marginBottom: 10, lineHeight: 13 },
  verifyChartRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  donutWrap: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center' },
  verifyLegend: { flex: 1, minWidth: 0, gap: 3 },
  verifyLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifyLegendDot: { width: 6, height: 6, borderRadius: 3 },
  verifyLegendText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, flexShrink: 1 },
});

import TouchableOpacity from '../ui/MotionTouchable';
import SupplierSpendBar from './SupplierSpendBar';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { summarizeSpend, type SpendInvoice, localDay, type SummaryPeriod } from '../../lib/spendSummary';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function SpendOverviewCard({ invoices, vendors, loading, onOpenInvoices, onOpenSuppliers, onOpenVendor }: {
  invoices: SpendInvoice[]; vendors: { id: string; name: string }[]; loading: boolean; onOpenInvoices:(range?:{from:string;to:string})=>void; onOpenSuppliers:()=>void; onOpenVendor:(id:string)=>void;
}) {
  const [period, setPeriod] = useState<SummaryPeriod>('month');
  const [offset, setOffset] = useState(0);
  const data = summarizeSpend(invoices, period, offset);
  const label = period === 'month'
    ? data.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : period === 'day' ? data.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : `${data.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${data.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const openPeriod=()=>onOpenInvoices({from:localDay(data.start),to:localDay(data.end)});
  const topVendors = data.vendors.slice(0, 3);
  const max = Math.max(1, ...topVendors.map(([, total]) => Math.abs(total)));
  return <View style={s.wrapper}>
    <View style={s.tabs}>
      {(['day', 'week', 'month'] as const).map(p => <TouchableOpacity key={p} accessibilityRole="button" accessibilityState={{ selected: p === period }} onPress={() => { setPeriod(p); setOffset(0); }} style={[s.tab, p === period && s.selected]}>
        <Text style={[s.tabText, p === period && s.selectedText]}>{p === 'day' ? 'Day' : p === 'week' ? 'Week' : 'Month'}</Text>
      </TouchableOpacity>)}
    </View>
    <View style={s.hero}>
      <View style={s.heroTop}><Text style={s.eyebrow}>TOTAL SPENDING</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`View invoices for ${label}`} onPress={openPeriod} style={s.savedPill}><Text style={s.savedText}>View invoices ›</Text></TouchableOpacity></View>
      <View style={s.navigation}>
        <Text style={s.date}>{label}</Text>
        <View style={s.arrows}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Previous ${period}`} onPress={() => setOffset(x => x - 1)} style={s.arrow}><Text style={s.arrowText}>‹</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Next ${period}`} accessibilityState={{ disabled: offset === 0 }} disabled={offset === 0} onPress={() => setOffset(x => Math.min(0, x + 1))} style={[s.arrow, offset === 0 && s.disabled]}><Text style={s.arrowText}>›</Text></TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity onPress={openPeriod} accessibilityRole="button" accessibilityLabel={`View invoices behind ${money(data.total)} spending for ${label}`}><Animated.Text key={`${period}:${offset}:${data.total}:${loading}`} entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)} style={s.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} accessibilityLiveRegion="polite">{loading ? 'Loading…' : money(data.total)}</Animated.Text></TouchableOpacity>
      <Text style={s.heroCaption}>Grouped by the date on each invoice</Text>
      {!loading && <SupplierSpendBar totals={data.vendors} vendors={vendors} onPressVendor={onOpenVendor} />}
      <View style={s.stats}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="View invoices for this period" onPress={openPeriod} style={s.stat}><Text style={s.statNumber}>{loading ? '—' : data.count}</Text><Text style={s.statLabel}>Invoices ›</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Browse suppliers" onPress={onOpenSuppliers} style={s.stat}><Text style={s.statNumber}>{loading ? '—' : data.vendors.length}</Text><Text style={s.statLabel}>Suppliers ›</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="View invoices behind this average" onPress={openPeriod} style={s.stat}><Text style={s.statNumber} numberOfLines={1} adjustsFontSizeToFit>{loading || !data.count ? '—' : money(data.total / data.count)}</Text><Text style={s.statLabel}>Avg. invoice ›</Text></TouchableOpacity>
      </View>
    </View>
    <View style={s.breakdown}>
      <View style={s.sectionRow}><Text style={s.heading}>Where it went</Text><Text style={s.note}>Top vendors</Text></View>
      {topVendors.map(([id, total], index) => <TouchableOpacity key={id} onPress={()=>onOpenVendor(id)} accessibilityRole="button" accessibilityLabel={`Open supplier ${vendors.find(v=>v.id===id)?.name??'Unknown vendor'}`} style={s.vendorRow}>
        <View style={[s.rank, index === 0 && s.firstRank]}><Text style={s.rankText}>{String(index + 1).padStart(2, '0')}</Text></View>
        <View style={s.vendorBody}><View style={s.sectionRow}><Text style={s.vendor} numberOfLines={1}>{vendors.find(v => v.id === id)?.name ?? 'Unknown vendor'}</Text><Text style={s.vendorAmount}>{money(total)}</Text></View>
          <View style={s.track} accessible={false}><View style={[s.fill, { width: `${Math.abs(total) / max * 100}%`, opacity: 1 - index * 0.2 }]} /></View>
        </View><Text style={s.note}>›</Text>
      </TouchableOpacity>)}
      {!loading && data.count === 0 && <Text style={s.empty}>No saved invoices in this period. Scan your first invoice or use the arrows to explore past spending.</Text>}
      {data.fallbackCount > 0 && <Text style={s.note}>{data.fallbackCount} {data.fallbackCount === 1 ? 'invoice uses' : 'invoices use'} upload date because the invoice date is missing.</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="View all saved invoices" onPress={()=>onOpenInvoices()} style={s.footer}><Text style={s.note}>All time · {data.allCount} saved</Text><Text style={s.allTotal}>{money(data.allTotal)} ›</Text></TouchableOpacity>
    </View>
  </View>;
}
const s = StyleSheet.create({
  wrapper: { gap: 14 }, tabs: { flexDirection: 'row', backgroundColor: '#E8EDE5', borderRadius: 16, padding: 4 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, selected: { backgroundColor: Colors.surface },
  tabText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: Colors.textSecondary }, selectedText: { color: Colors.primaryDark },
  hero: { backgroundColor: Colors.hero, borderRadius: 26, padding: 22 }, heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 1.5, color: Colors.heroMuted }, savedPill: { minHeight:44,justifyContent:'center',paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#285342' }, savedText: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, color: Colors.accent },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 4 }, date: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15, color: Colors.heroMuted }, arrows: { flexDirection: 'row' }, arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, arrowText: { color: Colors.heroText, fontSize: 28 }, disabled: { opacity: 0.3 },
  amount: { fontFamily: 'Manrope_800ExtraBold', fontSize: 46, letterSpacing: -1.8, color: Colors.heroText, marginTop: -1, fontVariant: ['tabular-nums'] }, heroCaption: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: Colors.heroMuted, marginTop: 6 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#3B5C4D', marginTop: 22, paddingTop: 18, gap: 12 }, stat: { flex: 1, gap: 4, minHeight:48 }, statNumber: { fontFamily: 'Manrope_700Bold', fontSize: 19, color: Colors.heroText, fontVariant: ['tabular-nums'] }, statLabel: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: Colors.heroMuted },
  breakdown: { padding: 20, borderRadius: 24, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 18 }, sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, heading: { fontFamily: 'Manrope_700Bold', fontSize: 17, color: Colors.textPrimary }, note: { fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
  vendorRow: { minHeight:48,flexDirection: 'row', alignItems: 'center', gap: 12 }, rank: { width: 34, height: 34, borderRadius: 11, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }, firstRank: { backgroundColor: Colors.primaryLight }, rankText: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: Colors.primaryDark }, vendorBody: { flex: 1, gap: 8 }, vendor: { flex: 1, fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: Colors.textPrimary }, vendorAmount: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: Colors.textPrimary, fontVariant: ['tabular-nums'] }, track: { height: 4, borderRadius: 2, backgroundColor: Colors.background, overflow: 'hidden' }, fill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 }, empty: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 22, color: Colors.textSecondary }, footer: { minHeight:44,flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 14, gap: 8 }, allTotal: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: Colors.textPrimary },
});

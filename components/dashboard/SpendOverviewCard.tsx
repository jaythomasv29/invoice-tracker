import AnimatedNumber from '../ui/AnimatedNumber';
import ProductCarousel from './ProductCarousel';
import HistoryMilestone from './HistoryMilestone';
import { RevealPanel } from './DashboardMotion';
import { Design } from '../../constants/Design';
import { useWorkspace } from '../../lib/workspaceContext';
import TouchableOpacity from '../ui/MotionTouchable';
import SupplierSpendBar from './SupplierSpendBar';
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { summarizeSpend, type SpendInvoice, localDay, type SummaryPeriod } from '../../lib/spendSummary';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function SpendOverviewCard({ invoices, vendors, loading, error, onOpenInvoices, onOpenSuppliers, onOpenVendor }: {
  invoices: SpendInvoice[]; vendors: { id: string; name: string }[]; loading: boolean; error?: string | null; onOpenInvoices:(range?:{from:string;to:string})=>void; onOpenSuppliers:()=>void; onOpenVendor:(id:string)=>void;
}) {
  const {isPersonal,organization}=useWorkspace();
  const receipt=isPersonal?'receipt':'invoice';
  const [period, setPeriod] = useState<SummaryPeriod>('month');
  const [offset, setOffset] = useState(0);
  const [productView, setProductView] = useState(false);
  const data = summarizeSpend(invoices, period, offset);
  const label = period === 'month'
    ? data.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : period === 'day' ? data.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : `${data.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${data.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const openPeriod=()=>onOpenInvoices({from:localDay(data.start),to:localDay(data.end)});
  const hasPeriodData = data.count > 0;
  const chevron = hasPeriodData ? ' ›' : '';
  return <View style={s.wrapper}>
    {!productView&&<RevealPanel><View style={s.tabs}>
      {(['day', 'week', 'month'] as const).map(p => <TouchableOpacity key={p} accessibilityRole="button" accessibilityState={{ selected: p === period }} onPress={() => { setPeriod(p); setOffset(0); }} style={[s.tab, p === period && s.selected]}>
        <Text style={[s.tabText, p === period && s.selectedText]}>{p === 'day' ? 'Day' : p === 'week' ? 'Week' : 'Month'}</Text>
      </TouchableOpacity>)}
    </View></RevealPanel>}
    <RevealPanel delay={40}><ProductCarousel key={organization?.id} onProductViewChange={setProductView}><View style={s.hero}>
      <View style={s.heroTop}><Text style={s.eyebrow}>TOTAL SPENDING</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${receipt}s for ${label}`} onPress={openPeriod} style={s.savedPill}><Text style={s.savedText}>View {receipt}s ›</Text></TouchableOpacity></View>
      <View style={s.navigation}>
        <Text style={s.date}>{label}</Text>
        <View style={s.arrows}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Previous ${period}`} onPress={() => setOffset(x => x - 1)} style={s.arrow}><Text style={s.arrowText}>‹</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Next ${period}`} accessibilityState={{ disabled: offset === 0 }} disabled={offset === 0} onPress={() => setOffset(x => Math.min(0, x + 1))} style={[s.arrow, offset === 0 && s.disabled]}><Text style={s.arrowText}>›</Text></TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity onPress={openPeriod} accessibilityRole="button" accessibilityLabel={`View ${receipt}s behind ${money(data.total)} spending for ${label}`}><AnimatedNumber value={data.total} format={money} contextKey={`${organization?.id}:${period}:${offset}`} ready={!loading&&!error} placeholder={error?"Unavailable":"Loading…"} style={s.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} /></TouchableOpacity>
      <Text style={s.heroCaption}>Based on the date printed on each {receipt}</Text>
      <SupplierSpendBar contextKey={`${organization?.id}:${period}:${offset}`} ready={!loading&&!error} totals={data.vendors} vendors={vendors} variant="bar" />
      <View style={s.stats}>
        {/* A period with nothing saved has nothing behind these tiles, so they
            drop their chevron and stop being buttons until it does. */}
        <TouchableOpacity disabled={!hasPeriodData} accessibilityRole={hasPeriodData?'button':'text'} accessibilityLabel={hasPeriodData?`View ${receipt}s for this period`:`No ${receipt}s this period`} onPress={openPeriod} style={s.stat}><AnimatedNumber value={data.count} format={n=>Math.round(n).toLocaleString('en-US')} contextKey={`${organization?.id}:${period}:${offset}`} ready={!loading&&!error} style={s.statNumber} /><Text style={s.statLabel}>{isPersonal?'Receipts':'Invoices'}{chevron}</Text></TouchableOpacity>
        <TouchableOpacity disabled={!hasPeriodData} accessibilityRole={hasPeriodData?'button':'text'} accessibilityLabel={hasPeriodData?(isPersonal?'Browse stores':'Browse suppliers'):(isPersonal?'No stores this period':'No suppliers this period')} onPress={onOpenSuppliers} style={s.stat}><AnimatedNumber value={data.vendors.length} format={n=>Math.round(n).toLocaleString('en-US')} contextKey={`${organization?.id}:${period}:${offset}`} ready={!loading&&!error} style={s.statNumber} /><Text style={s.statLabel}>{isPersonal?'Stores':'Suppliers'}{chevron}</Text></TouchableOpacity>
        <TouchableOpacity disabled={!hasPeriodData} accessibilityRole={hasPeriodData?'button':'text'} accessibilityLabel={hasPeriodData?`View ${receipt}s behind this average`:`No average ${receipt} this period`} onPress={openPeriod} style={s.stat}><AnimatedNumber value={data.count?data.total/data.count:0} format={money} contextKey={`${organization?.id}:${period}:${offset}`} ready={!loading&&!error} style={s.statNumber} numberOfLines={1} adjustsFontSizeToFit /><Text style={s.statLabel}>Avg. {receipt}{chevron}</Text></TouchableOpacity>
      </View>
      <HistoryMilestone invoices={invoices} loading={loading} onPress={() => onOpenInvoices()} />
    </View></ProductCarousel></RevealPanel>
    <RevealPanel><View style={s.breakdown}>
      <View style={s.sectionRow}><Text style={s.heading}>Where it went</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={isPersonal?'Browse all stores':'Browse all suppliers'} onPress={onOpenSuppliers} style={s.browse}><Text style={s.browseText}>{isPersonal?'Stores':'Suppliers'} ›</Text></TouchableOpacity></View>
      <Text style={s.note}>{label}</Text>
      <SupplierSpendBar contextKey={`${organization?.id}:${period}:${offset}`} ready={!loading&&!error} totals={data.vendors} vendors={vendors} onPressVendor={onOpenVendor} light variant="list" />
      {loading && data.vendors.length === 0 && <View style={s.breakdownLoading}><Text style={s.note}>Loading {isPersonal?'store':'supplier'} breakdown…</Text></View>}
      {!loading && data.count === 0 && <Text style={s.empty}>{data.allCount>0?`No saved ${receipt}s in this period. Use the arrows above to look at another one.`:`No saved ${receipt}s yet. Scan your first ${receipt} to see where the money goes.`}</Text>}
      {data.fallbackCount > 0 && <Text style={s.note}>{data.fallbackCount} {data.fallbackCount === 1 ? `${receipt} uses` : `${receipt}s use`} upload date because the {receipt} date is missing.</Text>}
      <TouchableOpacity disabled={data.allCount===0} accessibilityRole="button" accessibilityLabel={`View all saved ${receipt}s`} onPress={()=>onOpenInvoices()} style={s.footer}><Text style={s.note}>All time · {data.allCount} saved</Text><AnimatedNumber value={data.allTotal} format={n=>data.allCount?`${money(n)} ›`:money(n)} contextKey={`${organization?.id}:all`} ready={!loading&&!error} style={s.allTotal} /></TouchableOpacity>
    </View></RevealPanel>
  </View>;
}
const s = StyleSheet.create({
  breakdownLoading: { minHeight: 128, justifyContent: 'center' },
  browse: { minHeight:44, justifyContent:'center', paddingHorizontal:4 },
  browseText: { fontFamily:'Manrope_600SemiBold', fontSize:13, color:Colors.primaryDark },
  wrapper: { gap: 14 }, tabs: { flexDirection: 'row', backgroundColor: Colors.primaryLight, borderRadius: Design.radius.pill, padding: 4},
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Design.radius.pill}, selected: { backgroundColor: Colors.accent},
  tabText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: Colors.textSecondary }, selectedText: { color: Colors.primaryDark },
  hero: { backgroundColor: Colors.hero, borderRadius: Design.radius.hero, padding: 24}, heroTop: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 1.5, color: Colors.heroMuted }, savedPill: { minHeight:44,justifyContent:'center',paddingHorizontal: 14, paddingVertical: 6, borderRadius: Design.radius.pill, backgroundColor: Colors.accent }, savedText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: Colors.hero},
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 4 }, date: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 15, color: Colors.heroMuted }, arrows: { flexDirection: 'row' }, arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, arrowText: { color: Colors.heroText, fontSize: 28 }, disabled: { opacity: 0.3 },
  amount: { fontFamily: 'Manrope_800ExtraBold', fontSize: 52, letterSpacing: -2, color: Colors.accent, marginTop: -1, fontVariant: ['tabular-nums'] }, heroCaption: { lineHeight: 18, fontFamily: 'Manrope_400Regular', fontSize: 12, color: Colors.heroMuted, marginTop: 6 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#3B5C4D', marginTop: 22, paddingTop: 18, gap: 12 }, stat: { flex: 1, gap: 4, minHeight:48 }, statNumber: { fontFamily: 'Manrope_700Bold', fontSize: 19, color: Colors.heroText, fontVariant: ['tabular-nums'] }, statLabel: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: Colors.heroMuted },
  breakdown: { padding: 20, borderRadius: Design.radius.card, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 18 }, sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, heading: { letterSpacing: -0.4, fontFamily: 'Manrope_700Bold', fontSize: 19, color: Colors.textPrimary }, note: { fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
  vendorRow: { minHeight:48,flexDirection: 'row', alignItems: 'center', gap: 12 }, rank: { width: 34, height: 34, borderRadius: Design.radius.pill, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }, firstRank: { backgroundColor: Colors.primaryLight }, rankText: { fontFamily: 'Manrope_700Bold', fontSize: 11, color: Colors.primaryDark }, vendorBody: { flex: 1, gap: 8 }, vendor: { flex: 1, fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: Colors.textPrimary }, vendorAmount: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: Colors.textPrimary, fontVariant: ['tabular-nums'] }, track: { height: 4, borderRadius: 2, backgroundColor: Colors.background, overflow: 'hidden' }, fill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 }, empty: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 22, color: Colors.textSecondary }, footer: { minHeight:44,flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 14, gap: 8 }, allTotal: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: Colors.textPrimary },
});

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, ReduceMotion, Easing } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../constants/Colors';
import { kitchenProgress } from '../../lib/kitchenProgress';
import type { SpendInvoice } from '../../lib/spendSummary';
import Touch from '../ui/MotionTouchable';

export default function KitchenMomentumCard({ invoices, pending, loading, onInvoices, onReview, onScan }: {
  invoices: SpendInvoice[]; pending:number; loading:boolean; onInvoices:()=>void; onReview:()=>void; onScan:()=>void;
}) {
  const p=kitchenProgress(invoices);
  const fill=useSharedValue(0);
  useEffect(()=>{fill.value=withTiming(p.fraction,{duration:480,easing:Easing.out(Easing.cubic),reduceMotion:ReduceMotion.System});},[p.fraction,fill]);
  const bar=useAnimatedStyle(()=>({transformOrigin:'left center',transform:[{scaleX:fill.value}]}));
  return <View style={s.card}>
    <View style={s.top}><View style={s.icon} accessible={false}><Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={Colors.primaryDark} strokeWidth={1.8}><Path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.2l5.9-.9L12 3Z" /></Svg></View><View style={{flex:1}}><Text style={s.title}>Kitchen momentum</Text><Text style={s.caption}>Every saved invoice builds your picture.</Text></View></View>
    <Touch onPress={onInvoices} accessibilityRole="button" accessibilityLabel={`Invoice milestone: ${p.count} saved, next milestone ${p.target}. Open invoice library.`} style={s.milestone}>
      <View style={s.row}><Text style={s.goal}>Next milestone · {p.target} invoices</Text><Text style={s.value}>{loading?'—':`${p.count} / ${p.target}`} <Text style={s.chevron}>›</Text></Text></View>
      <View style={s.track} accessible={false}><Animated.View style={[s.fill,bar]} /></View>
      <View style={s.row}><Text style={s.caption}>{loading?'Updating your progress…':`${p.remaining} more saved ${p.remaining===1?'invoice':'invoices'} to go`}</Text><View style={s.badges}>{p.badges.map(b=><View key={b.value} style={[s.badge,b.earned&&s.earned]}><Text style={[s.badgeText,b.earned&&{color:Colors.primaryDark}]}>{b.earned?'✓ ':''}{b.value}</Text></View>)}</View></View>
    </Touch>
    <View style={s.weekHeader}><Text style={s.goal}>This week’s rhythm</Text><Text style={s.caption}>{loading?'—':p.activeDays} active {p.activeDays===1?'day':'days'}</Text></View>
    <View style={s.days} accessible accessibilityLabel={loading?'Updating this week’s activity':`${p.activeDays} days with saved invoice uploads this week. ${p.days.filter(d=>d.logged).map(d=>new Date(d.iso+'T12:00:00').toLocaleDateString('en-US',{weekday:'long'})).join(', ')}`}>
      {p.days.map(d=><View key={d.iso} style={[s.day,d.logged&&s.dayLogged,d.isToday&&s.today]}><Text style={[s.dayText,d.logged&&{color:Colors.textOnPrimary}]}>{d.label}</Text><Text style={[s.mark,d.logged&&{color:Colors.textOnPrimary}]}>{d.logged?'✓':d.isToday?'•':'·'}</Text></View>)}
    </View>
    <Text style={s.footnote}>Based on upload dates of saved invoices. No need to scan on days without a delivery.</Text>
    <View style={s.actions}><Touch onPress={pending?onReview:onInvoices} style={s.review} accessibilityRole="button"><Text style={s.reviewText}>{pending?`${pending} to review`:'View your progress'} <Text>›</Text></Text></Touch><Touch onPress={onScan} accessibilityRole="button" style={s.scan}><Text style={s.scanText}>+ Scan</Text></Touch></View>
  </View>;
}
const s=StyleSheet.create({
 card:{padding:20,borderRadius:24,backgroundColor:Colors.primaryLight,borderWidth:1,borderColor:Colors.border,gap:16},top:{flexDirection:'row',gap:12,alignItems:'center'},icon:{width:42,height:42,borderRadius:14,backgroundColor:Colors.surface,alignItems:'center',justifyContent:'center'},title:{fontFamily:'Manrope_800ExtraBold',fontSize:19,color:Colors.primaryDark},caption:{fontFamily:'Manrope_500Medium',fontSize:12,lineHeight:18,color:Colors.textSecondary},
 milestone:{gap:10,minHeight:84},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'},goal:{fontFamily:'Manrope_700Bold',fontSize:13,color:Colors.textPrimary},value:{fontFamily:'Manrope_800ExtraBold',fontSize:16,color:Colors.primaryDark},chevron:{fontSize:20},track:{height:8,borderRadius:4,backgroundColor:'#CEDFD2',overflow:'hidden'},fill:{width:'100%',height:8,borderRadius:4,backgroundColor:Colors.primary},badges:{flexDirection:'row',gap:5},badge:{paddingHorizontal:8,paddingVertical:4,borderRadius:8,borderWidth:1,borderColor:Colors.border},earned:{backgroundColor:Colors.surface},badgeText:{fontSize:12,fontFamily:'Manrope_700Bold',color:Colors.textSecondary},weekHeader:{flexDirection:'row',justifyContent:'space-between',gap:8},days:{flexDirection:'row',gap:6},day:{flex:1,paddingVertical:8,minHeight:48,borderRadius:12,backgroundColor:Colors.surface,alignItems:'center',gap:3,borderWidth:1,borderColor:'transparent'},dayLogged:{backgroundColor:Colors.primary},today:{borderColor:Colors.primary},dayText:{fontSize:12,fontFamily:'Manrope_700Bold',color:Colors.textSecondary},mark:{fontSize:14,color:Colors.textSecondary},footnote:{fontSize:12,lineHeight:18,fontFamily:'Manrope_400Regular',color:Colors.textSecondary},actions:{flexDirection:'row',gap:10},review:{flex:1,minHeight:46,justifyContent:'center'},reviewText:{fontFamily:'Manrope_700Bold',fontSize:13,color:Colors.primaryDark},scan:{paddingHorizontal:18,minHeight:46,borderRadius:14,backgroundColor:Colors.primary,alignItems:'center',justifyContent:'center'},scanText:{fontFamily:'Manrope_700Bold',fontSize:14,color:Colors.textOnPrimary},
});

import LoadFailure from '../../components/ui/LoadFailure';
import ScanInboxCard from '../../components/ScanInboxCard';
import { Design } from '../../constants/Design';
import HouseholdInsightsCard from '../../components/dashboard/HouseholdInsightsCard';
import { useWorkspace } from '../../lib/workspaceContext';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { DashboardMotionContext, RevealPanel } from '../../components/dashboard/DashboardMotion';
import GlassSurface from '../../components/ui/GlassSurface';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { fetchInvoiceById, fetchInvoiceImageUrls } from '../../lib/invoicePipeline';
import SpendOverviewCard from '../../components/dashboard/SpendOverviewCard';
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  AppState,
  StyleSheet,
} from "react-native";
import SafeAreaView from '../../components/ui/Screen';
import { useRouter, useFocusEffect } from "expo-router";

import { Colors } from "../../constants/Colors";
import { useStore } from "../../store/useStore";
import { useSpendPeriod } from "../../hooks/useSpendPeriod";
import { useEntitlement } from "../../hooks/useEntitlement";
import { useMissingInvoices } from "../../hooks/useMissingInvoices";
import { useSupabase } from "../../lib/supabase";
import Toast from "../../components/ui/Toast";
import ProLockCard from "../../components/ui/ProLockCard";
import InfoButton from "../../components/ui/InfoButton";
import {
  OnboardingExplainerSheet,
  type ExplainerConfig,
} from "../../components/ui/OnboardingExplainerSheet";
import { DashboardOverviewPreview } from "../../components/onboarding/PreviewCards";
import MissingInvoiceCard from "../../components/dashboard/MissingInvoiceCard";
import TopItemsCard from "../../components/dashboard/TopItemsCard";
import RecipeCostingCard from "../../components/dashboard/RecipeCostingCard";
import { initialsFor } from "../../lib/initials";
import VendorSpendListCard from "../../components/dashboard/VendorSpendListCard";
import SpendTrendCard from "../../components/dashboard/SpendTrendCard";
import AIInsightCard from "../../components/dashboard/AIInsightCard";
import CategorySpendCard from "../../components/dashboard/CategorySpendCard";
import UploadActivityCard from "../../components/dashboard/UploadActivityCard";
import DeliveryGapCard from "../../components/dashboard/DeliveryGapCard";
import KitchenMomentumCard from "../../components/dashboard/KitchenMomentumCard";
import HomeWelcomeCard from "../../components/dashboard/HomeWelcomeCard";
import { TourTarget } from "../../components/tour/TourTarget";
import { useTour } from "../../components/tour/TourProvider";

const CARD_PAD = 20;

// The home dashboard has no empty state to gate on, so its onboarding lives only
// behind the header info button. Copy orients a new user to the whole app rather
// than any single feature the way the Recipes/Invoices explainers do.
const APP_EXPLAINER: ExplainerConfig = {
  eyebrow: "WELCOME TO SIFT",
  title: "Every invoice,\nworking for you",
  subtitle:
    "Scan an invoice and Sift turns it into tracked spend, per-vendor and category breakdowns, price-creep alerts, delivery-gap recovery, and live recipe costs — all from your own paperwork.",
  Illustration: DashboardOverviewPreview,
  ctaLabel: "Scan an invoice",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization, isPersonal } = useWorkspace();
  const { isPaid } = useEntitlement();
  const { flags: missingInvoices } = useMissingInvoices(isPaid && !isPersonal);
  const restaurantName = organization?.name ?? "";
  const userInitials = initialsFor(restaurantName);
  const {
    vendors,
    spendInvoices, awaitingReview, awaitingReviewCount, dashboardError,
    categorySpend,
    topItems,
    uploadActivity,
    deliveryGapTotal,
    deliveryGapItems,
    priceAlerts,
    monthTotal,
    fetchDashboardSummary,
    fetchPriceAlerts,
  } = useStore();
  const {
    spendView,
    setSpendView,
    yearsBack,
    setYearsBack,
    maxYears,
    periodBarData,
    periodTotal,
    periodPctChange,
  } = useSpendPeriod();

  const [retryOverview,setRetryOverview]=useState(0);
  // Leaving the sample-data tour clears the fixture; refetch the real account
  // right away instead of showing an empty $0 dashboard until the next focus.
  const demoMode = useStore((s) => s.demoMode);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  // Which workspace has finished at least one load. A refocus refetch flips
  // isLoadingSummary, so gating the welcome card on it alone would flicker.
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const viewport = useSharedValue(0);
  const epoch = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(event => { scrollY.value = event.contentOffset.y; });
  const [infoOpen, setInfoOpen] = useState(false);
  const [openingReview, setOpeningReview] = useState(false);
  const openInvoices = (range?: {from:string;to:string}) => router.push({ pathname:'/(tabs)/vendors', params:{view:'invoices',from:range?.from??'',to:range?.to??'',entry:Date.now().toString()} });
  const openSuppliers = () => router.push({pathname:'/(tabs)/vendors',params:{view:'vendors',from:'',to:''}});
  const openVendor = (id:string) => { if(vendors.some(v=>v.id===id)) router.push(`/vendor/${id}`); else openInvoices(); };
  const openReview = async (id:string) => {
    if (!organization?.id || openingReview) return;
    const scope=useStore.getState().activeScope;
    setOpeningReview(true);
    try {
      const [invoice,imageUris]=await Promise.all([fetchInvoiceById(supabase,organization.id,id),fetchInvoiceImageUrls(supabase,organization.id,id)]);
      if (useStore.getState().activeScope!==scope) return;
      useStore.getState().setCurrentInvoice({...invoice,imageUris});
      router.push('/scan/review');
    } catch { useStore.getState().showToast('Could not open invoice review. Please retry.'); }
    finally {setOpeningReview(false);}
  };


  // Let the product tour scroll this screen so targets below the fold can be
  // brought into view before the spotlight measures them.
  const { registerScroller, start: startTour } = useTour();
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    registerScroller("index", {
      scrollTo: (y) => scrollRef.current?.scrollTo({ y, animated: true }),
      getOffset: () => scrollY.value,
    });
    return () => registerScroller("index", null);
  }, [registerScroller, scrollY]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let request = 0;
      let appState = AppState.currentState;
      const load = () => {
        if (!organization?.id) { setIsLoadingSummary(false); return; }
        const current = ++request;
        const scope = useStore.getState().activeScope;
        setIsLoadingSummary(true);
        void Promise.all([
          fetchDashboardSummary(supabase, organization.id),
          isPaid ? fetchPriceAlerts(supabase, organization.id) : Promise.resolve(),
        ]).catch(() => {
          if (active && current === request && scope === useStore.getState().activeScope) useStore.setState({dashboardError:'Could not refresh your spending overview.'});
        }).finally(() => {
          if (!active || current !== request || scope !== useStore.getState().activeScope) return;
          setIsLoadingSummary(false);
          setLoadedOrgId(organization.id);
          epoch.value += 1;
        });
      };
      epoch.value += 1;
      load();
      const subscription = AppState.addEventListener('change', next => {
        if (next === 'active' && appState !== 'active') {
          epoch.value += 1;
          load();
        }
        appState = next;
      });
      return () => { active = false; subscription.remove(); };
    // Retry version intentionally reruns this focused fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization?.id, supabase, isPaid, fetchDashboardSummary, fetchPriceAlerts, epoch, retryOverview, demoMode]),
  );

  // A workspace with nothing saved yet gets one onboarding explainer instead of
  // a stack of $0.00 tiles. Demo mode always has data, so it never lands here.
  const isNewWorkspace = !demoMode && !dashboardError && loadedOrgId === organization?.id && spendInvoices.length === 0;
  const startSample = isPersonal ? () => useStore.getState().startDemo('personal') : startTour;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.greeting}>{getGreeting().toUpperCase()}</Text>
          <View style={styles.nameRow}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {restaurantName}
            </Text>
            <InfoButton onPress={() => setInfoOpen(true)} />
          </View>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/(tabs)/alerts")}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Price alerts"
          >
            <BellIcon />
            {isPaid && priceAlerts.filter((a) => !a.read).length > 0 && (
              <View style={styles.alertDot} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push("/(tabs)/more")}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Text style={styles.avatarText}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <DashboardMotionContext.Provider value={{ scrollY, viewport, epoch }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: 112 + insets.bottom }]}
        onLayout={event => { viewport.value = event.nativeEvent.layout.height; }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        {dashboardError&&<LoadFailure message={dashboardError} hasData={spendInvoices.length>0} onRetry={()=>setRetryOverview(n=>n+1)}/>}
        <ScanInboxCard />
        {isNewWorkspace ? <RevealPanel><HomeWelcomeCard isPersonal={isPersonal} onScan={() => router.push('/scan')} onSample={startSample} /></RevealPanel> : <>
        <RevealPanel><View style={styles.overviewHeading}>
          <Text style={styles.overviewStatus}>{isLoadingSummary ? 'Updating your overview…' : 'Your spending, in perspective.'}</Text>
          <TouchableOpacity onPress={() => router.push('/scan')} accessibilityRole="button" accessibilityLabel={isPersonal?'Scan a new receipt':'Scan a new invoice'} style={styles.quickScan}><Text style={styles.quickScanText}>+ Scan</Text></TouchableOpacity>
        </View></RevealPanel>

        <RevealPanel animate={false}><SpendOverviewCard invoices={spendInvoices} vendors={vendors} loading={isLoadingSummary} error={dashboardError} onOpenInvoices={openInvoices} onOpenSuppliers={openSuppliers} onOpenVendor={openVendor} /></RevealPanel>


        <RevealPanel delay={40}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search products and purchase prices" onPress={() => router.push('/products')} style={styles.searchAction}>
            <GlassSurface />
            <View style={styles.searchIcon}><Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={Colors.primaryDark} strokeWidth={1.8} accessible={false}><Path d="M21 21l-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" /></Svg></View>
            <View style={{flex:1}}><Text style={styles.searchTitle}>Search items & prices</Text><Text style={styles.searchCaption}>Find a purchase. Build your product list.</Text></View>
            <Text style={styles.searchChevron} accessible={false}>›</Text>
          </TouchableOpacity>
        </RevealPanel>

        <RevealPanel><View style={styles.intelligenceHeading}>
          <View style={{flex:1}}><Text style={styles.intelligenceEyebrow}>THE BIGGER PICTURE</Text><Text style={styles.intelligenceTitle}>{isPersonal?'Shopping intelligence':'Purchasing intelligence'}</Text><Text style={styles.overviewSubtitle}>{isPersonal?'Your stores. Your essentials. A little more perspective.':'Build momentum. Spot changes. Know your next move.'}</Text></View>
          {isPaid && <View style={styles.intelligenceBadge}><Text style={styles.intelligenceBadgeText}>PRO</Text></View>}
        </View></RevealPanel>
          <RevealPanel>{isPersonal?<HouseholdInsightsCard count={spendInvoices.length} isPaid={isPaid}/>:<TourTarget id="home-streak"><KitchenMomentumCard invoices={spendInvoices} pending={awaitingReviewCount} loading={isLoadingSummary} onInvoices={()=>openInvoices()} onReview={()=>{ if(awaitingReview[0]) void openReview(awaitingReview[0].id); else openInvoices(); }} onScan={()=>router.push('/scan')} /></TourTarget>}</RevealPanel>
          {!isPersonal&&<RevealPanel><RecipeCostingCard isPaid={isPaid} onPress={()=>router.push(isPaid?'/recipes':'/paywall')} /></RevealPanel>}
          {isPaid ? <>
            {!isPersonal&&<RevealPanel><TourTarget id="home-alerts"><AIInsightCard priceAlerts={priceAlerts} onPress={()=>router.push('/(tabs)/alerts')} /></TourTarget></RevealPanel>}
            {!isPersonal&&missingInvoices.length>0&&<RevealPanel><MissingInvoiceCard flags={missingInvoices} onPressVendor={openVendor} /></RevealPanel>}
            <RevealPanel><View style={styles.patternHeading}><Text style={styles.patternTitle}>{isPersonal?'Your shopping patterns':'Your purchasing patterns'}</Text><TouchableOpacity onPress={openSuppliers} accessibilityRole="button" style={styles.sectionAction}><Text style={styles.insightsLink}>{isPersonal?'Stores':'Suppliers'} ›</Text></TouchableOpacity></View></RevealPanel>
            <RevealPanel><TourTarget id="home-spend"><SpendTrendCard period={spendView} yearsBack={yearsBack} periodTotal={periodTotal} periodPctChange={periodPctChange} barData={periodBarData} isLoading={isLoadingSummary} onOpenDetails={openSuppliers} /></TourTarget></RevealPanel>
            <RevealPanel><TourTarget id="home-vendors"><VendorSpendListCard vendors={vendors} period={spendView} onChangePeriod={setSpendView} yearsBack={yearsBack} onChangeYears={setYearsBack} maxYears={maxYears} periodBarData={periodBarData} onPressVendor={openVendor} isLoading={isLoadingSummary} /></TourTarget></RevealPanel>
            {!isPersonal&&deliveryGapItems.length>0&&<RevealPanel><DeliveryGapCard total={deliveryGapTotal} items={deliveryGapItems} onPressInvoice={id=>router.push(`/invoice/${id}`)} /></RevealPanel>}
            {categorySpend.length>0 && <RevealPanel><CategorySpendCard categorySpend={categorySpend} onOpenInvoices={()=>openInvoices()} /></RevealPanel>}
            {!isPersonal&&topItems.length>0&&<RevealPanel><TopItemsCard topItems={topItems} onPressItem={name=>router.push({pathname:'/item-history',params:{itemName:name}})} /></RevealPanel>}
          </> : <RevealPanel><ProLockCard stat={monthTotal>0?`$${Math.round(monthTotal).toLocaleString('en-US')}`:undefined} statLabel={monthTotal>0?'spent this month':undefined} title={isPersonal?'See the patterns behind your shopping':'See the patterns behind your purchasing'} body={isPersonal?'Personal Pro connects your store trends, category breakdowns and comparable item prices.':'Pro connects supplier trends, price-change alerts and recipe costing to your invoices.'} /></RevealPanel>}
        {uploadActivity.length>0 && <RevealPanel><UploadActivityCard entries={uploadActivity} onPressInvoice={id=>router.push(`/invoice/${id}`)} /></RevealPanel>}
        </>}
      </Animated.ScrollView>
      </DashboardMotionContext.Provider>

      <OnboardingExplainerSheet
        visible={infoOpen}
        config={isPersonal?{...APP_EXPLAINER,title:'Every receipt,\nworking for you',subtitle:'Scan groceries and household essentials. Review your receipt, save it, and see spending by purchase date and store. Personal Pro adds category trends and reliable repeat-item price comparisons.',ctaLabel:'Scan a receipt'}:APP_EXPLAINER}
        onClose={() => setInfoOpen(false)}
        onCta={() => router.push("/scan")}
      />

      <Toast />
    </SafeAreaView>
  );
}

function BellIcon() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={Colors.textPrimary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}><Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></Svg>;
}

const styles = StyleSheet.create({
  searchAction: { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:18, paddingVertical:16, minHeight:76, borderRadius:9999, borderWidth:1, borderColor:Colors.border },
  searchIcon: { width:32, height:32, alignItems:'center', justifyContent:'center' },
  searchTitle: { fontFamily:'Manrope_700Bold', fontSize:15, color:Colors.primaryDark },
  searchCaption: { fontFamily:'Manrope_400Regular', fontSize:12, lineHeight:18, color:Colors.textSecondary, marginTop:3 },
  searchChevron: { fontSize:26, color:Colors.primaryDark },
  overviewHeading: {flexDirection:'row',alignItems:'center',gap:12},
  overviewStatus: {flex:1,fontFamily:'Manrope_500Medium',fontSize:13,lineHeight:19,color:Colors.textSecondary},
  overviewSubtitle:{fontFamily:'Manrope_400Regular',fontSize: 14,lineHeight: 21,color:Colors.textSecondary,marginTop:3},
  quickScan:{minWidth:76,minHeight:44,paddingHorizontal:14,borderRadius: Design.radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:Colors.primary},
  quickScanText:{fontFamily:'Manrope_700Bold',fontSize:14,color:Colors.textOnPrimary},
  intelligenceHeading:{flexDirection:'row',alignItems:'flex-start',gap:12,marginTop: 16,marginBottom: 8},
  intelligenceEyebrow:{fontFamily:'Manrope_700Bold',fontSize:10,letterSpacing:1.5,color:Colors.primary,marginBottom:7},
  intelligenceTitle:{fontFamily:'Manrope_800ExtraBold',fontSize: 28,letterSpacing: -1,color:Colors.textPrimary,marginBottom:6},
  intelligenceBadge:{paddingHorizontal:10,paddingVertical:6,borderRadius: Design.radius.pill,backgroundColor:Colors.primaryLight},
  intelligenceBadgeText:{fontFamily:'Manrope_800ExtraBold',fontSize:10,letterSpacing:1,color:Colors.primaryDark},
  patternHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:8},
  patternTitle:{fontFamily:'Manrope_700Bold',fontSize:17,color:Colors.textPrimary},
  sectionAction:{minHeight:44,justifyContent:'center',paddingHorizontal:4},
  insightsToggle:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12},
  insightsTitle:{fontFamily:'Manrope_700Bold',fontSize:17,color:Colors.textPrimary},
  insightsLink:{fontFamily:'Manrope_700Bold',fontSize:13,color:Colors.primary},
  reviewCard:{padding:20,gap:12,borderRadius: Design.radius.card,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border},
  reviewTitle:{fontFamily:'Manrope_700Bold',fontSize:18,color:Colors.textPrimary},
  reviewBody:{fontFamily:'Manrope_400Regular',fontSize:14,lineHeight:21,color:Colors.textSecondary},
  reviewRow:{minHeight:48,flexDirection:'row',alignItems:'center',gap:12},
  reviewVendor:{flex:1,fontFamily:'Manrope_600SemiBold',fontSize:15,color:Colors.textPrimary},
  reviewLink:{fontFamily:'Manrope_700Bold',fontSize:14,color:Colors.textPrimary,textDecorationLine:'underline'},
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  greeting: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontFamily: "Manrope_700Bold",
    color: Colors.textSecondary,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  restaurantName: {
    flexShrink: 1,
    fontSize: 22,
    fontFamily: "Manrope_800ExtraBold",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerIcons: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    flexShrink: 0,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: Design.radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0,
  },
  alertDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Design.radius.pill,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0,
  },
  avatarText: {
    fontSize: 14,
    fontFamily: "Manrope_800ExtraBold",
    color: "#fff",
    letterSpacing: 0.5,
  },

  scroll: { padding: CARD_PAD, gap: 16, paddingBottom: 120 },

  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: Design.radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    shadowOpacity: 0,
  },
  vendorIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  vendorTitle: {
    fontSize: 17,
    fontFamily: "Manrope_800ExtraBold",
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  vendorSub: {
    fontSize: 12,
    fontFamily: "Manrope_600SemiBold",
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import TouchableOpacity from '../../components/ui/MotionTouchable';
import { fetchInvoiceById, fetchInvoiceImageUrls } from '../../lib/invoicePipeline';
import SpendOverviewCard from '../../components/dashboard/SpendOverviewCard';
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import SafeAreaView from '../../components/ui/Screen';
import { useRouter, useFocusEffect } from "expo-router";
import { useOrganization } from "@clerk/clerk-expo";
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
  const { organization } = useOrganization();
  const { isPaid } = useEntitlement();
  const { flags: missingInvoices } = useMissingInvoices(isPaid);
  const restaurantName = organization?.name ?? "";
  const userInitials = initialsFor(restaurantName);
  const {
    vendors,
    spendInvoices, awaitingReview, awaitingReviewCount,
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

  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
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
  const { registerScroller } = useTour();
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  useEffect(() => {
    registerScroller("index", {
      scrollTo: (y) => scrollRef.current?.scrollTo({ y, animated: true }),
      getOffset: () => scrollOffset.current,
    });
    return () => registerScroller("index", null);
  }, [registerScroller]);

  useFocusEffect(
    useCallback(() => {
      if (organization?.id) {
        setIsLoadingSummary(true);
        // Price alerts are a Pro feature — free orgs skip the fetch entirely.
        Promise.all([
          fetchDashboardSummary(supabase, organization.id),
          isPaid
            ? fetchPriceAlerts(supabase, organization.id)
            : Promise.resolve(),
        ]).finally(() => setIsLoadingSummary(false));
      }
    }, [
      organization?.id,
      supabase,
      isPaid,
      fetchDashboardSummary,
      fetchPriceAlerts,
    ]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.greeting}>YOUR WORKSPACE</Text>
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

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollOffset.current = e.nativeEvent.contentOffset.y;
        }}
      >
        <View style={styles.overviewHeading}>
          <View style={{flex:1}}><Text style={styles.overviewTitle}>Kitchen overview</Text><Text style={styles.overviewSubtitle}>{getGreeting()}. Let’s make it a clear one.</Text></View>
          <TouchableOpacity onPress={() => router.push('/scan')} accessibilityRole="button" accessibilityLabel="Scan a new invoice" style={styles.quickScan}><Text style={styles.quickScanText}>+ Scan</Text></TouchableOpacity>
        </View>
        <SpendOverviewCard invoices={spendInvoices} vendors={vendors} loading={isLoadingSummary} onOpenInvoices={openInvoices} onOpenSuppliers={openSuppliers} onOpenVendor={openVendor} />
        {awaitingReviewCount>0&&<View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>{awaitingReviewCount} {awaitingReviewCount===1?'invoice needs':'invoices need'} review</Text>
          <Text style={styles.reviewBody}>These scans are ready. Review and save them to include them in your spending.</Text>
          {awaitingReview.map(invoice=><TouchableOpacity key={invoice.id} disabled={openingReview} accessibilityRole="button" accessibilityLabel={`Review invoice from ${invoice.vendorName}`} onPress={()=>void openReview(invoice.id)} style={styles.reviewRow}>
            <Text style={styles.reviewVendor} numberOfLines={1}>{invoice.vendorName}</Text><Text style={styles.reviewLink}>{openingReview?'Opening…':'Review →'}</Text>
          </TouchableOpacity>)}
        </View>}


        <View style={styles.intelligenceHeading}>
          <View style={{flex:1}}><Text style={styles.intelligenceEyebrow}>THE BIGGER PICTURE</Text><Text style={styles.intelligenceTitle}>Purchasing intelligence</Text><Text style={styles.overviewSubtitle}>Build momentum. Spot changes. Know your next move.</Text></View>
          {isPaid && <View style={styles.intelligenceBadge}><Text style={styles.intelligenceBadgeText}>PRO</Text></View>}
        </View>
        <Animated.View entering={FadeInDown.duration(240).reduceMotion(ReduceMotion.System)} style={{gap:16}}>
          <TourTarget id="home-streak"><KitchenMomentumCard invoices={spendInvoices} pending={awaitingReviewCount} loading={isLoadingSummary} onInvoices={()=>openInvoices()} onReview={()=>{ if(awaitingReview[0]) void openReview(awaitingReview[0].id); else openInvoices(); }} onScan={()=>router.push('/scan')} /></TourTarget>
          <RecipeCostingCard isPaid={isPaid} onPress={()=>router.push(isPaid?'/recipes':'/paywall')} />
          {isPaid ? <>
            <TourTarget id="home-alerts"><AIInsightCard priceAlerts={priceAlerts} onPress={()=>router.push('/(tabs)/alerts')} /></TourTarget>
            <MissingInvoiceCard flags={missingInvoices} onPressVendor={openVendor} />
            <View style={styles.patternHeading}><Text style={styles.patternTitle}>Your purchasing patterns</Text><TouchableOpacity onPress={openSuppliers} accessibilityRole="button" style={styles.sectionAction}><Text style={styles.insightsLink}>Suppliers ›</Text></TouchableOpacity></View>
            <TourTarget id="home-spend"><SpendTrendCard period={spendView} yearsBack={yearsBack} periodTotal={periodTotal} periodPctChange={periodPctChange} barData={periodBarData} isLoading={isLoadingSummary} onOpenDetails={openSuppliers} /></TourTarget>
            <TourTarget id="home-vendors"><VendorSpendListCard vendors={vendors} period={spendView} onChangePeriod={setSpendView} yearsBack={yearsBack} onChangeYears={setYearsBack} maxYears={maxYears} periodBarData={periodBarData} onPressVendor={openVendor} isLoading={isLoadingSummary} /></TourTarget>
            <DeliveryGapCard total={deliveryGapTotal} items={deliveryGapItems} onPressInvoice={id=>router.push(`/invoice/${id}`)} />
            {categorySpend.length>0 && <CategorySpendCard categorySpend={categorySpend} onOpenInvoices={()=>openInvoices()} />}
            <TopItemsCard topItems={topItems} onPressItem={name=>router.push({pathname:'/item-history',params:{itemName:name}})} />
          </> : <ProLockCard stat={monthTotal>0?`$${Math.round(monthTotal).toLocaleString('en-US')}`:undefined} statLabel={monthTotal>0?'spent this month':undefined} title="See the patterns behind your purchasing" body="Pro connects supplier trends, price-change alerts and recipe costing to your invoices." />}
        </Animated.View>
        {uploadActivity.length>0 && <UploadActivityCard entries={uploadActivity} onPressInvoice={id=>router.push(`/invoice/${id}`)} />}
      </ScrollView>

      <OnboardingExplainerSheet
        visible={infoOpen}
        config={APP_EXPLAINER}
        onClose={() => setInfoOpen(false)}
        onCta={() => router.push("/scan")}
      />

      <Toast />
    </SafeAreaView>
  );
}

function BellIcon() {
  return (
    <View style={{ width: 17, height: 18, alignItems: "center" }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 3,
          width: 11,
          height: 10,
          borderWidth: 2,
          borderColor: Colors.textPrimary,
          borderRadius: 6,
          borderBottomWidth: 0,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 3,
          left: 0,
          width: 17,
          height: 2.5,
          backgroundColor: Colors.textPrimary,
          borderRadius: 2,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 6.5,
          width: 4,
          height: 3,
          backgroundColor: Colors.textPrimary,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overviewHeading: {flexDirection:'row',alignItems:'center',gap:12,marginBottom:4},
  overviewTitle:{fontFamily:'Manrope_800ExtraBold',fontSize:27,letterSpacing:-1,color:Colors.textPrimary},
  overviewSubtitle:{fontFamily:'Manrope_400Regular',fontSize:12,lineHeight:19,color:Colors.textSecondary,marginTop:3},
  quickScan:{minWidth:76,minHeight:44,paddingHorizontal:14,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:Colors.primary},
  quickScanText:{fontFamily:'Manrope_700Bold',fontSize:14,color:Colors.textOnPrimary},
  intelligenceHeading:{flexDirection:'row',alignItems:'flex-start',gap:12,marginTop:20,marginBottom:2},
  intelligenceEyebrow:{fontFamily:'Manrope_700Bold',fontSize:10,letterSpacing:1.5,color:Colors.primary,marginBottom:7},
  intelligenceTitle:{fontFamily:'Manrope_800ExtraBold',fontSize:25,letterSpacing:-0.6,color:Colors.textPrimary,marginBottom:6},
  intelligenceBadge:{paddingHorizontal:10,paddingVertical:6,borderRadius:10,backgroundColor:Colors.primaryLight},
  intelligenceBadgeText:{fontFamily:'Manrope_800ExtraBold',fontSize:10,letterSpacing:1,color:Colors.primaryDark},
  patternHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:8},
  patternTitle:{fontFamily:'Manrope_700Bold',fontSize:17,color:Colors.textPrimary},
  sectionAction:{minHeight:44,justifyContent:'center',paddingHorizontal:4},
  insightsToggle:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12},
  insightsTitle:{fontFamily:'Manrope_700Bold',fontSize:17,color:Colors.textPrimary},
  insightsLink:{fontFamily:'Manrope_700Bold',fontSize:13,color:Colors.primary},
  reviewCard:{padding:20,gap:12,borderRadius:20,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border},
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
    borderRadius: 13,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
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
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 18,
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

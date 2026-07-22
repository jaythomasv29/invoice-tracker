import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { useStore } from '../../store/useStore';
import { useSpendPeriod } from '../../hooks/useSpendPeriod';
import { useSupabase } from '../../lib/supabase';
import Toast from '../../components/ui/Toast';
import { initialsFor } from '../../lib/initials';
import VendorSpendListCard from '../../components/dashboard/VendorSpendListCard';
import SpendTrendCard from '../../components/dashboard/SpendTrendCard';
import AIInsightCard from '../../components/dashboard/AIInsightCard';
import CategorySpendCard from '../../components/dashboard/CategorySpendCard';
import PriceAlertBanner from '../../components/dashboard/PriceAlertBanner';
import UploadActivityCard from '../../components/dashboard/UploadActivityCard';

const CARD_PAD = 16;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const restaurantName = organization?.name ?? '';
  const userInitials = initialsFor(restaurantName);
  const {
    vendors,
    categorySpend,
    uploadActivity,
    priceAlerts,
    fetchDashboardSummary, fetchPriceAlerts,
  } = useStore();
  const {
    spendView, setSpendView, yearsBack, setYearsBack, maxYears, periodBarData,
    periodTotal, periodPctChange,
  } = useSpendPeriod();

  const topAlert = priceAlerts.find((a) => !a.read);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (organization?.id) {
        setIsLoadingSummary(true);
        Promise.all([
          fetchDashboardSummary(supabase, organization.id),
          fetchPriceAlerts(supabase, organization.id),
        ]).finally(() => setIsLoadingSummary(false));
      }
    }, [organization?.id, supabase, fetchDashboardSummary, fetchPriceAlerts])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.restaurantName} numberOfLines={1}>{restaurantName}</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/(tabs)/alerts')}
            activeOpacity={0.7}
          >
            <BellIcon />
            {priceAlerts.filter((a) => !a.read).length > 0 && (
              <View style={styles.alertDot} />
            )}
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <SpendTrendCard
          period={spendView}
          yearsBack={yearsBack}
          periodTotal={periodTotal}
          periodPctChange={periodPctChange}
          barData={periodBarData}
          isLoading={isLoadingSummary}
        />

        <VendorSpendListCard
          vendors={vendors}
          period={spendView}
          onChangePeriod={setSpendView}
          yearsBack={yearsBack}
          onChangeYears={setYearsBack}
          maxYears={maxYears}
          periodBarData={periodBarData}
          onPressVendor={(id) => router.push(`/vendor/${id}`)}
          isLoading={isLoadingSummary}
        />

        <AIInsightCard priceAlerts={priceAlerts} onPress={() => router.push('/(tabs)/alerts')} />

        {categorySpend.length > 0 && <CategorySpendCard categorySpend={categorySpend} />}

        {uploadActivity.length > 0 && (
          <UploadActivityCard
            entries={uploadActivity}
            onPressInvoice={(id) => router.push(`/invoice/${id}`)}
          />
        )}

        {topAlert && (
          <PriceAlertBanner alert={topAlert} onPress={() => router.push('/(tabs)/alerts')} />
        )}

        {/* Action tile */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(tabs)/vendors')}
          activeOpacity={0.85}
        >
          <View style={styles.vendorIconWrap}>
            <GridIcon />
          </View>
          <View>
            <Text style={styles.vendorTitle}>Vendors</Text>
            <Text style={styles.vendorSub}>{vendors.length} active this week</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <Toast />
    </SafeAreaView>
  );
}

function BellIcon() {
  return (
    <View style={{ width: 17, height: 18, alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: 0, left: 3, width: 11, height: 10, borderWidth: 2, borderColor: Colors.textPrimary, borderRadius: 6, borderBottomWidth: 0 }} />
      <View style={{ position: 'absolute', bottom: 3, left: 0, width: 17, height: 2.5, backgroundColor: Colors.textPrimary, borderRadius: 2 }} />
      <View style={{ position: 'absolute', bottom: 0, left: 6.5, width: 4, height: 3, backgroundColor: Colors.textPrimary, borderRadius: 2 }} />
    </View>
  );
}

function GridIcon() {
  return (
    <View style={{ width: 20, height: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 8, height: 8, backgroundColor: Colors.primary, borderRadius: 2 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, gap: 10,
  },
  greeting: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  restaurantName: {
    fontSize: 22, fontFamily: 'Manrope_800ExtraBold',
    color: Colors.textPrimary, letterSpacing: -0.3,
  },
  headerIcons: { flexDirection: 'row', gap: 9, alignItems: 'center', flexShrink: 0 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3,
  },
  alertDot: {
    position: 'absolute', top: 9, right: 10, width: 8, height: 8,
    borderRadius: 4, backgroundColor: Colors.danger, borderWidth: 1.5, borderColor: '#fff',
  },
  avatar: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 10,
  },
  avatarText: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: 0.5 },

  scroll: { padding: CARD_PAD, gap: 11, paddingBottom: 120 },

  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    padding: 18,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 18,
  },
  vendorIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  vendorTitle: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.2 },
  vendorSub: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 2 },
});

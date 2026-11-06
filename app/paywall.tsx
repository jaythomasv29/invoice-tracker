import { Design } from '../constants/Design';
import { WORKSPACE_PLANS } from '../shared/workspacePolicy.ts';
import { useWorkspace } from '../lib/workspaceContext';
import TouchableOpacity from '../components/ui/MotionTouchable';
import { useSupabase } from '../lib/supabase';
import { syncSubscription } from '../lib/subscriptionSync';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import SafeAreaView from '../components/ui/Screen';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../constants/Colors';
import { featuresFor, PAYWALL_HEADLINE, PAYWALL_SUBHEAD } from '../constants/plans';

import { useExtractionUsage } from '../hooks/useExtractionUsage';
import { useEntitlement } from '../hooks/useEntitlement';
import {
  getTierPackages,
  purchaseTier,
  restorePurchases,
  purchasesReady,
  type TierPackages,
} from '../lib/purchases';
import { PRIVACY_POLICY_URL, TERMS_URL, openLegalUrl } from '../constants/legal';

// Which tier is preselected. Pro is the flagship (highest margin); Plus is one
// tap away and clearly priced. Flip this to 'plus' to default to the entry tier.


export default function PaywallScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const [offeringError, setOfferingError] = useState<string | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const { organization, accountType, isPersonal } = useWorkspace();
  const features=featuresFor(accountType);
  const policy=WORKSPACE_PLANS[accountType];
  const { plan, isPaid } = useEntitlement();
  const { used, cap } = useExtractionUsage();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Plus + Pro packages from RevenueCat — each carries the store-localized price
  // (Apple 3.1.2 requires showing the real price). Null until loaded, or if the
  // RevenueCat project/key isn't set up yet.
  const [packages, setPackages] = useState<TierPackages>({ plus: null, pro: null });

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true); setOfferingError(null);
    try {
      const loaded = await getTierPackages(accountType);
      setPackages(loaded);
      if (!loaded.pro) setOfferingError('The App Store is not returning a Pro price yet.');
    } catch (error: any) { setOfferingError(error?.message ?? 'Could not load the subscription.'); }
    finally { setLoadingPackages(false); }
  },[accountType]);
  useEffect(() => { void loadPackages(); }, [loadPackages]);
  const selectedPkg = packages.pro;
  const proDisplay = selectedPkg ? `${selectedPkg.product.priceString}/month` : 'Price unavailable';
  const ctaPriceLabel = proDisplay;
  const ctaTierLabel = isPersonal?'Personal Pro':'Business Pro';

  const usagePct = cap > 0 ? Math.min(1, used / cap) : 0;

  // After a purchase/restore that RevenueCat confirms locally, the app-wide
  // entitlement (and the server extraction gate) still read the Clerk org's
  // `plan` flag, which the revenuecat-webhook writes a few seconds later. Poll
  // the org so the paywall flips to the "on a paid plan" state without a manual
  // reload, then auto-close back to wherever the user came from (often mid-scan).
  const awaitEntitlementAndClose = async (expectedPlan: string) => {
    const confirmed = await syncSubscription(supabase);
    await organization?.reload();
    if (confirmed !== expectedPlan) throw new Error('Your purchase is pending verification. Please retry Restore purchases shortly.');
    router.back();
  };

  const handleUpgrade = async () => {
    if (busy || restoring || !organization?.canPurchase) return;
    // RevenueCat project/key not wired yet (migration in progress) or the
    // selected package isn't configured — don't dead-end the button.
    if (!purchasesReady() || !selectedPkg) {
      Alert.alert('Not available yet', 'In-app purchases aren’t available on this build yet. Please try again after updating.');
      return;
    }
    setBusy(true);
    try {
      const { plan: purchasedPlan, cancelled } = await purchaseTier(selectedPkg, organization!.billingCustomerId, accountType);
      if (cancelled) return; // user backed out of the native sheet — no error
      if (purchasedPlan !== 'free') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await awaitEntitlementAndClose(purchasedPlan);
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Purchase failed', e?.message ?? 'Could not complete the purchase. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (restoring || busy || !organization?.canPurchase) return;
    setRestoring(true);
    try {
      const restoredPlan = await restorePurchases(organization.billingCustomerId, accountType);
      if (restoredPlan !== 'free') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await awaitEntitlementAndClose(restoredPlan);
      } else {
        Alert.alert('Nothing to restore', 'No active subscription was found for your Apple ID.');
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const planLabel = plan === 'pro' ? 'Pro' : plan === 'plus' ? 'Plus' : 'Free';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.headline}>{isPersonal?'Make more sense of your grocery spend.':PAYWALL_HEADLINE}</Text>
          <Text style={styles.subhead}>{`${isPersonal?'Personal':'Business'} Pro includes ${policy.pro.scans} scans per calendar month${isPersonal?'':', plus 10 AI recipe draft attempts'}. ${PAYWALL_SUBHEAD}`}</Text>
        </View>

        {isPaid ? (
          <View style={styles.proBanner}>
            <Text style={styles.proBannerText}>✓ You&apos;re on {planLabel}</Text>
          </View>
        ) : (
          <View style={styles.usageCard}>
            <Text style={styles.usageText}>
              You&apos;ve used <Text style={styles.usageStrong}>{used}</Text> of{' '}
              <Text style={styles.usageStrong}>{cap}</Text> free extractions this month.
            </Text>
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, { width: `${usagePct * 100}%` }]} />
            </View>
          </View>
        )}

        {!organization?.canPurchase&&<Text style={styles.disclosure}>{organization?.purchaseUnavailableReason??'Only the workspace billing owner can purchase or restore.'}</Text>}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={styles.featureCol} />
            <View style={styles.planCol}>
              <Text style={styles.planHeaderText}>Free</Text>
            </View>
            <View style={[styles.planCol, styles.proColHighlight, styles.proColHeader]}>
              <Text style={styles.planHeaderTextPro}>Pro</Text>
            </View>
          </View>

          {features.map((feature, i) => (
            <View
              key={feature.label}
              style={[styles.tableRow, i > 0 && styles.tableRowBorder]}
            >
              <View style={styles.featureCol}>
                {feature.differentiator && <View style={styles.starDot} />}
                <Text style={[styles.featureLabel, feature.differentiator && styles.featureLabelEmphasis]}>
                  {feature.label}
                </Text>
                {feature.comingSoon && (
                  <View style={styles.soonTag}>
                    <Text style={styles.soonTagText}>SOON</Text>
                  </View>
                )}
              </View>
              <View style={styles.planCol}>
                <FeatureCell value={feature.free} />
              </View>
              <View style={[styles.planCol, styles.proColHighlight]}>
                <FeatureCell value={feature.pro} pro />
              </View>
            </View>
          ))}
        </View>

        {isPaid ? (
          <View style={[styles.cta, styles.ctaDisabled]}>
            <Text style={styles.ctaTextDisabled}>You&apos;re on {planLabel}</Text>
          </View>
        ) : (
          <>
            {/* Plus / Pro tier selector — Pro (flagship) is the default. */}
            <View style={styles.plans}>
              <TierOption
                label="Pro"
                price={proDisplay}
                caption={`${policy.pro.scans} ${isPersonal?'receipts':'invoices'} / mo`}
                badge="Recommended"
                selected
                onPress={() => Haptics.selectionAsync()}
              />
            </View>

            <TouchableOpacity
              style={[styles.cta, (busy || loadingPackages || !selectedPkg) && styles.ctaBusy]}
              onPress={handleUpgrade}
              disabled={busy || restoring || loadingPackages || !selectedPkg || !organization?.canPurchase}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>{busy ? 'Verifying purchase…' : loadingPackages ? 'Loading price…' : !selectedPkg ? 'Subscription unavailable' : `Upgrade to ${ctaTierLabel} — ${ctaPriceLabel}`}</Text>
            </TouchableOpacity>

            {offeringError && <TouchableOpacity onPress={loadPackages} style={styles.restoreBtn} accessibilityRole="button"><Text style={styles.restoreText}>{offeringError} Tap to retry.</Text></TouchableOpacity>}
            <TouchableOpacity
              onPress={handleRestore}
              disabled={restoring || busy}
              activeOpacity={0.7}
              style={styles.restoreBtn}
            >
              <Text style={styles.restoreText}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
            </TouchableOpacity>

            {/* Apple 3.1.2: auto-renewal disclosure + functional Terms/Privacy links. */}
            <Text style={styles.disclosure}>
              Sift {ctaTierLabel} is an auto-renewing monthly subscription. Payment is charged to
              your Apple ID account at confirmation. It renews automatically unless cancelled at
              least 24 hours before the end of the current period; manage or cancel anytime in your
              Apple ID settings. Personal and Business are separate subscriptions, managed by the purchasing owner’s Apple ID.
            </Text>
            <View style={styles.legalRow}>
              <TouchableOpacity onPress={() => openLegalUrl(TERMS_URL, () => Alert.alert('Terms', 'Terms of Service will be available at launch.'))}>
                <Text style={styles.legalLink}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>·</Text>
              <TouchableOpacity onPress={() => openLegalUrl(PRIVACY_POLICY_URL, () => Alert.alert('Privacy', 'Privacy Policy will be available at launch.'))}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureCell({ value, pro }: { value: string | boolean; pro?: boolean }) {
  if (typeof value === 'string') {
    return <Text style={[styles.cellText, pro && styles.cellTextPro]}>{value}</Text>;
  }
  if (value) {
    return <Text style={styles.cellCheck}>✓</Text>;
  }
  return <Text style={styles.cellLock}>🔒</Text>;
}

function TierOption({
  label,
  price,
  caption,
  badge,
  selected,
  onPress,
}: {
  label: string;
  price: string;
  caption?: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.planOption, selected && styles.planOptionSelected]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.planOptionHeader}>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioDot} />}
        </View>
        <Text style={styles.planOptionLabel}>{label}</Text>
      </View>
      <Text style={styles.planOptionPrice}>{price}</Text>
      {caption && <Text style={styles.planOptionCaption}>{caption}</Text>}
      {badge && (
        <View style={[styles.planBadge, selected && styles.planBadgeSelected]}>
          <Text style={[styles.planBadgeText, selected && styles.planBadgeTextSelected]}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 },
  closeBtn: {
    width: 44, height: 44, borderRadius: Design.radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },

  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 20 },

  hero: { gap: 8, marginTop: 4 },
  headline: {
    fontSize: 32, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary,
    letterSpacing: -1, lineHeight: 36,
  },
  subhead: {
    fontSize: 15, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, lineHeight: 21,
  },

  proBanner: {
    backgroundColor: Colors.primaryLight, borderRadius: Design.radius.card, borderWidth: 1, borderColor: Colors.primaryMuted,
    paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center',
  },
  proBannerText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },

  usageCard: {
    backgroundColor: Colors.surface, borderRadius: Design.radius.card, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 16, gap: 10,
  },
  usageText: { fontSize: 13.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, lineHeight: 19 },
  usageStrong: { fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  meterTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },

  table: {
    backgroundColor: Colors.surface, borderRadius: Design.radius.card, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.surface,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  featureCol: { flex: 1.7, flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 4 },
  planCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  proColHighlight: { backgroundColor: Colors.primaryLight, marginVertical: -12, paddingVertical: 12, alignSelf: 'stretch' },
  proColHeader: { marginVertical: 0, paddingVertical: 10, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  planHeaderText: {
    fontSize: 10.5, fontFamily: 'Manrope_700Bold', letterSpacing: 0.4, textTransform: 'uppercase',
    color: Colors.textTertiary,
  },
  planHeaderTextPro: {
    fontSize: 10.5, fontFamily: 'Manrope_700Bold', letterSpacing: 0.4, textTransform: 'uppercase',
    color: Colors.primaryDark,
  },
  starDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  soonTag: {
    backgroundColor: Colors.background, borderRadius: 5, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  soonTagText: { fontSize: 8, fontFamily: 'Manrope_800ExtraBold', color: Colors.textTertiary, letterSpacing: 0.5 },
  featureLabel: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary, flexShrink: 1 },
  featureLabelEmphasis: { fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  cellText: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  cellTextPro: { color: Colors.primaryDark, fontFamily: 'Manrope_700Bold' },
  cellCheck: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.primary },
  cellLock: { fontSize: 13, color: Colors.textTertiary },

  cta: { paddingVertical: 14, minHeight: 54,
    backgroundColor: Colors.primary, borderRadius: Design.radius.pill,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0, elevation: 0,
  },
  ctaText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textOnPrimary },
  ctaBusy: { opacity: 0.6 },
  ctaDisabled: {
    backgroundColor: Colors.surfacePressed, shadowOpacity: 0, elevation: 0,
    borderWidth: 1, borderColor: Colors.border,
  },
  ctaTextDisabled: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },

  plans: { flexDirection: 'row', gap: 12 },
  planOption: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 14, gap: 6,
  },
  planOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  planOptionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  planOptionLabel: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  planOptionPrice: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.4 },
  planOptionCaption: { fontSize: 11.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary },
  planBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.background, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 6, paddingVertical: 2,
  },
  planBadgeSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  planBadgeText: { fontSize: 10, fontFamily: 'Manrope_800ExtraBold', color: Colors.textSecondary, letterSpacing: 0.3 },
  planBadgeTextSelected: { color: Colors.textOnPrimary },

  restoreBtn: { alignItems: 'center', paddingVertical: 4 },
  restoreText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },

  disclosure: {
    fontSize: 11, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary,
    textAlign: 'center', lineHeight: 16,
  },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legalLink: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, textDecorationLine: 'underline' },
  legalDot: { fontSize: 12, color: Colors.textTertiary },
});

import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../constants/Colors';
import { PLAN_FEATURES, PLUS_PRICE_LABEL, PRO_PRICE_LABEL, PAYWALL_HEADLINE, PAYWALL_SUBHEAD } from '../constants/plans';
import { PLAN_INVOICE_CAPS } from '../lib/entitlements';
import { useExtractionUsage } from '../hooks/useExtractionUsage';
import { useEntitlement } from '../hooks/useEntitlement';
import {
  getTierPackages,
  purchaseTier,
  restorePurchases,
  purchasesReady,
  type TierPackages,
  type PaidTier,
} from '../lib/purchases';
import { PRIVACY_POLICY_URL, TERMS_URL, openLegalUrl } from '../constants/legal';

// Which tier is preselected. Pro is the flagship (highest margin); Plus is one
// tap away and clearly priced. Flip this to 'plus' to default to the entry tier.
const DEFAULT_TIER: PaidTier = 'pro';

export default function PaywallScreen() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { plan, isPaid } = useEntitlement();
  const { used, cap } = useExtractionUsage();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Plus + Pro packages from RevenueCat — each carries the store-localized price
  // (Apple 3.1.2 requires showing the real price). Null until loaded, or if the
  // RevenueCat project/key isn't set up yet.
  const [packages, setPackages] = useState<TierPackages>({ plus: null, pro: null });
  const [tier, setTier] = useState<PaidTier>(DEFAULT_TIER);

  useEffect(() => {
    let cancelled = false;
    getTierPackages()
      .then((p) => { if (!cancelled) setPackages(p); })
      .catch(() => { /* leave null — falls back to placeholder labels */ });
    return () => { cancelled = true; };
  }, []);

  const selectedPkg = packages[tier];
  // Real store prices when available; placeholder labels otherwise.
  const plusDisplay = packages.plus ? `${packages.plus.product.priceString}/mo` : PLUS_PRICE_LABEL;
  const proDisplay = packages.pro ? `${packages.pro.product.priceString}/mo` : PRO_PRICE_LABEL;
  const ctaPriceLabel = tier === 'pro' ? proDisplay : plusDisplay;
  const ctaTierLabel = tier === 'pro' ? 'Pro' : 'Plus';

  // `isPaid` mirrored into a ref so the polling loop below can observe it
  // updating across re-renders. The loop reads a ref (kept in sync via effect)
  // rather than the `organization` captured in the handler's closure, since
  // `organization?.reload()` may hand back a new resource object rather than
  // mutating this one in place.
  const isPaidRef = useRef(isPaid);
  useEffect(() => { isPaidRef.current = isPaid; }, [isPaid]);

  const usagePct = cap > 0 ? Math.min(1, used / cap) : 0;

  // After a purchase/restore that RevenueCat confirms locally, the app-wide
  // entitlement (and the server extraction gate) still read the Clerk org's
  // `plan` flag, which the revenuecat-webhook writes a few seconds later. Poll
  // the org so the paywall flips to the "on a paid plan" state without a manual
  // reload, then auto-close back to wherever the user came from (often mid-scan).
  const awaitEntitlementAndClose = async () => {
    let confirmed = false;
    for (let i = 0; i < 6 && !confirmed; i++) {
      await organization?.reload?.();
      await new Promise((r) => setTimeout(r, 400));
      if (isPaidRef.current) { confirmed = true; break; }
      await new Promise((r) => setTimeout(r, 1100));
    }
    if (confirmed) setTimeout(() => router.back(), 900);
    return confirmed;
  };

  const handleUpgrade = async () => {
    if (busy) return;
    // RevenueCat project/key not wired yet (migration in progress) or the
    // selected package isn't configured — don't dead-end the button.
    if (!purchasesReady() || !selectedPkg) {
      Alert.alert('Not available yet', 'In-app purchases aren’t available on this build yet. Please try again after updating.');
      return;
    }
    setBusy(true);
    try {
      const { plan: purchasedPlan, cancelled } = await purchaseTier(selectedPkg);
      if (cancelled) return; // user backed out of the native sheet — no error
      if (purchasedPlan !== 'free') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await awaitEntitlementAndClose();
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Purchase failed', e?.message ?? 'Could not complete the purchase. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const restoredPlan = await restorePurchases();
      if (restoredPlan !== 'free') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const confirmed = await awaitEntitlementAndClose();
        if (!confirmed) Alert.alert('Purchases restored', `Your ${restoredPlan} subscription is active.`);
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
          <Text style={styles.headline}>{PAYWALL_HEADLINE}</Text>
          <Text style={styles.subhead}>{PAYWALL_SUBHEAD}</Text>
        </View>

        {isPaid ? (
          <View style={styles.proBanner}>
            <Text style={styles.proBannerText}>✓ You're on {planLabel}</Text>
          </View>
        ) : (
          <View style={styles.usageCard}>
            <Text style={styles.usageText}>
              You've used <Text style={styles.usageStrong}>{used}</Text> of{' '}
              <Text style={styles.usageStrong}>{cap}</Text> free extractions this month.
            </Text>
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, { width: `${usagePct * 100}%` }]} />
            </View>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <View style={styles.featureCol} />
            <View style={styles.planCol}>
              <Text style={styles.planHeaderText}>Free</Text>
            </View>
            <View style={styles.planCol}>
              <Text style={styles.planHeaderText}>Plus</Text>
            </View>
            <View style={[styles.planCol, styles.proColHighlight, styles.proColHeader]}>
              <Text style={styles.planHeaderTextPro}>Pro</Text>
            </View>
          </View>

          {PLAN_FEATURES.map((feature, i) => (
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
              <View style={styles.planCol}>
                <FeatureCell value={feature.plus} />
              </View>
              <View style={[styles.planCol, styles.proColHighlight]}>
                <FeatureCell value={feature.pro} pro />
              </View>
            </View>
          ))}
        </View>

        {isPaid ? (
          <View style={[styles.cta, styles.ctaDisabled]}>
            <Text style={styles.ctaTextDisabled}>You're on {planLabel}</Text>
          </View>
        ) : (
          <>
            {/* Plus / Pro tier selector — Pro (flagship) is the default. */}
            <View style={styles.plans}>
              <TierOption
                label="Plus"
                price={plusDisplay}
                caption={`${PLAN_INVOICE_CAPS.plus} invoices / mo`}
                selected={tier === 'plus'}
                onPress={() => { Haptics.selectionAsync(); setTier('plus'); }}
              />
              <TierOption
                label="Pro"
                price={proDisplay}
                caption={`${PLAN_INVOICE_CAPS.pro} invoices / mo`}
                badge="Recommended"
                selected={tier === 'pro'}
                onPress={() => { Haptics.selectionAsync(); setTier('pro'); }}
              />
            </View>

            <TouchableOpacity
              style={[styles.cta, busy && styles.ctaBusy]}
              onPress={handleUpgrade}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>{busy ? 'Processing…' : `Upgrade to ${ctaTierLabel} — ${ctaPriceLabel}`}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRestore}
              disabled={restoring}
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
              Apple ID settings. One subscription per restaurant, managed by the owner’s Apple ID.
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
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },

  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 20 },

  hero: { gap: 8, marginTop: 4 },
  headline: {
    fontSize: 26, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary,
    letterSpacing: -0.5, lineHeight: 32,
  },
  subhead: {
    fontSize: 15, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, lineHeight: 21,
  },

  proBanner: {
    backgroundColor: Colors.primaryLight, borderRadius: 14, borderWidth: 1, borderColor: Colors.primaryMuted,
    paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center',
  },
  proBannerText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },

  usageCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 16, gap: 10,
  },
  usageText: { fontSize: 13.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, lineHeight: 19 },
  usageStrong: { fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  meterTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },

  table: {
    backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border,
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

  cta: {
    backgroundColor: Colors.primary, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
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

import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUser, useOrganization } from '@clerk/clerk-expo';
import { Colors } from '../constants/Colors';
import { PLAN_FEATURES, PRO_PRICE_LABEL, PAYWALL_HEADLINE, PAYWALL_SUBHEAD } from '../constants/plans';
import { useExtractionUsage } from '../hooks/useExtractionUsage';
import { useEntitlement } from '../hooks/useEntitlement';
import { useSupabase } from '../lib/supabase';
import { planFromOrg } from '../lib/entitlements';
import { startProCheckout } from '../lib/billing';

export default function PaywallScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { isPro } = useEntitlement();
  const { used, cap } = useExtractionUsage();
  const [busy, setBusy] = useState(false);

  const usagePct = cap > 0 ? Math.min(1, used / cap) : 0;

  const handleUpgrade = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await startProCheckout(supabase, user?.primaryEmailAddress?.emailAddress);
      // The subscription is fulfilled server-side by the stripe-webhook
      // function (it flips the org's plan). Poll the Clerk org a few times so
      // the paywall flips to the "You're on Pro" state without a manual reload.
      for (let i = 0; i < 5; i++) {
        await organization?.reload?.();
        if (planFromOrg(organization) === 'pro') break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Checkout', e?.message ?? 'Could not start checkout. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.headline}>{PAYWALL_HEADLINE}</Text>
          <Text style={styles.subhead}>{PAYWALL_SUBHEAD}</Text>
        </View>

        {isPro ? (
          <View style={styles.proBanner}>
            <Text style={styles.proBannerText}>✓ You're on Pro</Text>
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
              <View style={[styles.planCol, styles.proColHighlight]}>
                <FeatureCell value={feature.pro} pro />
              </View>
            </View>
          ))}
        </View>

        {isPro ? (
          <View style={[styles.cta, styles.ctaDisabled]}>
            <Text style={styles.ctaTextDisabled}>You're on Pro</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.cta, busy && styles.ctaBusy]}
            onPress={handleUpgrade}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>{busy ? 'Opening checkout…' : `Upgrade to Pro — ${PRO_PRICE_LABEL}`}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footnote}>Cancel anytime. Prices shown are placeholders.</Text>
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
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: Colors.surface,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  featureCol: { flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 },
  planCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  proColHighlight: { backgroundColor: Colors.primaryLight, marginVertical: -12, paddingVertical: 12, alignSelf: 'stretch' },
  proColHeader: { marginVertical: 0, paddingVertical: 10, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  planHeaderText: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.6, textTransform: 'uppercase',
    color: Colors.textTertiary,
  },
  planHeaderTextPro: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.6, textTransform: 'uppercase',
    color: Colors.primaryDark,
  },
  starDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  soonTag: {
    backgroundColor: Colors.background, borderRadius: 5, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  soonTagText: { fontSize: 8, fontFamily: 'Manrope_800ExtraBold', color: Colors.textTertiary, letterSpacing: 0.5 },
  featureLabel: { fontSize: 13.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary, flexShrink: 1 },
  featureLabelEmphasis: { fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  cellText: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
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

  footnote: { fontSize: 12, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, textAlign: 'center' },
});

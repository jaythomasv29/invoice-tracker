import type { ComponentType } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';

// One description of an onboarding explainer, shared between the full empty-state
// (OnboardingExplainer) and the on-demand sheet (OnboardingExplainerSheet) so a
// screen defines its hero/copy/CTA exactly once.
export interface ExplainerConfig {
  eyebrow: string;
  eyebrowAccent?: string;
  eyebrowTint?: string;
  title: string;
  subtitle: string;
  Illustration: ComponentType<{ active: boolean }>;
  ctaLabel: string;
}

function ExplainerBody({
  config, active, onCta,
}: { config: ExplainerConfig; active: boolean; onCta: () => void }) {
  const {
    eyebrow, eyebrowAccent = Colors.primary, eyebrowTint = Colors.primaryLight,
    title, subtitle, Illustration, ctaLabel,
  } = config;
  return (
    <>
      <Animated.View
        key={active ? 'illo-in' : 'illo-out'}
        entering={FadeInUp.duration(460).delay(60)}
        style={styles.illustrationWrap}
      >
        <Illustration active={active} />
      </Animated.View>
      <View style={[styles.eyebrowPill, { backgroundColor: eyebrowTint }]}>
        <Text style={[styles.eyebrowText, { color: eyebrowAccent }]}>{eyebrow}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <TouchableOpacity style={styles.cta} onPress={onCta} activeOpacity={0.85}>
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </TouchableOpacity>
    </>
  );
}

// Full-screen empty state: the explainer shown when a screen has no content yet.
export function OnboardingExplainer({
  config, onCta,
}: { config: ExplainerConfig; onCta: () => void }) {
  return (
    <ScrollView
      contentContainerStyle={styles.screenScroll}
      showsVerticalScrollIndicator={false}
    >
      <ExplainerBody config={config} active onCta={onCta} />
    </ScrollView>
  );
}

// The same explainer, reopened on demand from the info button once content exists.
export function OnboardingExplainerSheet({
  visible, config, onClose, onCta,
}: { visible: boolean; config: ExplainerConfig; onClose: () => void; onCta?: () => void }) {
  const handleCta = () => {
    onClose();
    onCta?.();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheetCard}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8} activeOpacity={0.7}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.textTertiary} strokeWidth={2.4} strokeLinecap="round">
              <Path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </TouchableOpacity>
          <ExplainerBody config={config} active={visible} onCta={onCta ? handleCta : onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screenScroll: {
    flexGrow: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 28, paddingTop: 8, paddingBottom: 130,
  },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(10,10,16,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  sheetCard: {
    width: '100%', maxWidth: 380, backgroundColor: Colors.background,
    borderRadius: 24, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24,
    alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 14, right: 14, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', zIndex: 2 },

  illustrationWrap: { width: '100%', marginBottom: 26 },
  eyebrowPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 14 },
  eyebrowText: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.8 },
  title: {
    fontSize: 23, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary,
    letterSpacing: -0.5, lineHeight: 29, textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    fontSize: 14.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary,
    lineHeight: 21, textAlign: 'center', marginBottom: 24,
  },
  cta: {
    width: '100%', backgroundColor: Colors.primary, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  ctaText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#fff' },
});

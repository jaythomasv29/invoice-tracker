import { useCallback, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  interpolate, Extrapolation, FadeInUp,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
import { ScanPreview, PriceAlertPreview, VerifyPreview } from '../../components/onboarding/PreviewCards';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    id: 'scan',
    eyebrow: 'SCAN',
    title: 'Snap a photo,\nskip the data entry',
    subtitle: 'Point your camera at any invoice — line items, prices, and totals come out the other side automatically.',
    accent: Colors.primary,
    accentTint: Colors.primaryLight,
    Preview: ScanPreview,
  },
  {
    id: 'alerts',
    eyebrow: 'PRICE ALERTS',
    title: 'Catch price hikes\nthe moment they happen',
    subtitle: 'Every new invoice is checked against your price history, so a quiet increase never slips past you.',
    accent: Colors.warning,
    accentTint: Colors.warningLight,
    Preview: PriceAlertPreview,
  },
  {
    id: 'verify',
    eyebrow: 'VERIFICATION',
    title: 'Know what actually\nshowed up on the truck',
    subtitle: 'Check delivered items against what you were billed for, and flag what’s missing in one tap.',
    accent: Colors.vendorGolden,
    accentTint: '#EEF2FF',
    Preview: VerifyPreview,
  },
] as const;

const LAST_INDEX = SLIDES.length - 1;

export default function WelcomeScreen() {
  const router = useRouter();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const goToSignIn = useCallback(() => {
    router.push('/(auth)/sign-in');
  }, [router]);

  const handleMomentumEnd = useCallback((e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActiveIndex(Math.max(0, Math.min(i, LAST_INDEX)));
  }, []);

  const handleNext = () => {
    Haptics.selectionAsync();
    if (activeIndex < LAST_INDEX) {
      scrollRef.current?.scrollTo({ x: (activeIndex + 1) * SCREEN_W, animated: true });
    } else {
      goToSignIn();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>Invoice Intelligence</Text>
        </View>
        {activeIndex < LAST_INDEX && (
          <TouchableOpacity onPress={goToSignIn} hitSlop={8} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <Slide key={slide.id} slide={slide} index={i} scrollX={scrollX} active={activeIndex === i} />
        ))}
      </Animated.ScrollView>

      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <Dot key={i} index={i} scrollX={scrollX} />
        ))}
      </View>

      <View style={styles.bottomArea}>
        <TouchableOpacity style={styles.cta} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{activeIndex === LAST_INDEX ? 'Get started' : 'Next'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToSignIn} hitSlop={8} activeOpacity={0.7} style={styles.signInLinkWrap}>
          <Text style={styles.signInLink}>
            Already have an account? <Text style={styles.signInLinkBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

interface SlideData {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  accentTint: string;
  Preview: ComponentType<{ active: boolean }>;
}

function Slide({ slide, index, scrollX, active }: {
  slide: SlideData; index: number; scrollX: SharedValue<number>; active: boolean;
}) {
  const inputRange = [(index - 1) * SCREEN_W, index * SCREEN_W, (index + 1) * SCREEN_W];

  const blobStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollX.value, inputRange, [0.7, 1, 0.7], Extrapolation.CLAMP) },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollX.value, inputRange, [18, 0, 18], Extrapolation.CLAMP) },
    ],
  }));

  const { Preview } = slide;

  return (
    <View style={[styles.slide, { width: SCREEN_W }]}>
      <Animated.View style={[styles.blob, { backgroundColor: slide.accentTint }, blobStyle]} />
      <Animated.View style={[styles.slideContent, contentStyle]}>
        <View style={[styles.eyebrowPill, { backgroundColor: slide.accentTint }]}>
          <Text style={[styles.eyebrowText, { color: slide.accent }]}>{slide.eyebrow}</Text>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        <Animated.View
          key={active ? `${slide.id}-in` : `${slide.id}-out`}
          entering={FadeInUp.duration(480).delay(80)}
          style={styles.previewWrap}
        >
          <Preview active={active} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function Dot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const inputRange = [(index - 1) * SCREEN_W, index * SCREEN_W, (index + 1) * SCREEN_W];
  const style = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, inputRange, [7, 22, 7], Extrapolation.CLAMP),
    opacity: interpolate(scrollX.value, inputRange, [0.35, 1, 0.35], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4, height: 40,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  brandText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary, letterSpacing: 0.2 },
  skipText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },

  slide: { paddingHorizontal: 28, paddingTop: 8, alignItems: 'center' },
  blob: {
    position: 'absolute', top: 20, alignSelf: 'center',
    width: 280, height: 280, borderRadius: 140,
  },
  slideContent: { width: '100%', alignItems: 'flex-start' },
  eyebrowPill: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 18,
  },
  eyebrowText: { fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.8 },
  title: {
    fontSize: 28, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary,
    letterSpacing: -0.6, lineHeight: 34, marginBottom: 12,
  },
  subtitle: {
    fontSize: 15, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary,
    lineHeight: 22, marginBottom: 28,
  },
  previewWrap: { width: '100%' },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 20 },
  dot: { height: 7, borderRadius: 4, backgroundColor: Colors.primary },

  bottomArea: { paddingHorizontal: 24, paddingBottom: 8 },
  cta: {
    backgroundColor: Colors.primary, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  ctaText: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#fff' },
  signInLinkWrap: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  signInLink: { fontSize: 13.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary },
  signInLinkBold: { fontFamily: 'Manrope_700Bold', color: Colors.primary },
});

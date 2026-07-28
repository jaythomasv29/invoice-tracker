import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/Colors';
import { useTour } from './TourProvider';

const HOLE_PAD = 8; // padding around the highlighted element
const HOLE_RADIUS = 18;
const CARD_GAP = 16; // gap between the hole and the caption card
const SIDE_MARGIN = 20;

export default function SpotlightOverlay() {
  const { active, step, stepIndex, stepCount, measuredRect, next, back, skip } = useTour();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!active || !step) return null;

  const rect = measuredRect;
  const isFinal = !!step.isFinal;

  // Caption position derived from the hole. Falls back to vertically centered
  // when the target hasn't been measured yet (e.g. mid tab-switch).
  let cardPos: { top?: number; bottom?: number };
  if (!rect) {
    cardPos = { top: Math.round(H * 0.38) };
  } else if (step.placement === 'bottom') {
    const top = rect.y + rect.height + HOLE_PAD + CARD_GAP;
    cardPos = { top: Math.min(top, H - insets.bottom - 220) };
  } else {
    const bottom = H - (rect.y - HOLE_PAD - CARD_GAP);
    cardPos = { bottom: Math.min(bottom, H - insets.top - 120) };
  }

  const onNext = () => { Haptics.selectionAsync(); next(); };
  const onBack = () => { Haptics.selectionAsync(); back(); };
  const onSkip = () => { Haptics.selectionAsync(); skip(); };

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Blocks all touches to the app behind the tour. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

      {/* Dim + spotlight cutout. */}
      <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none" entering={FadeIn.duration(220)}>
        <Svg width={W} height={H}>
          <Defs>
            <Mask id="spotlight">
              <Rect x={0} y={0} width={W} height={H} fill="white" />
              {rect && (
                <Rect
                  x={rect.x - HOLE_PAD}
                  y={rect.y - HOLE_PAD}
                  width={rect.width + HOLE_PAD * 2}
                  height={rect.height + HOLE_PAD * 2}
                  rx={HOLE_RADIUS}
                  ry={HOLE_RADIUS}
                  fill="black"
                />
              )}
            </Mask>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="rgba(10,10,16,0.72)" mask="url(#spotlight)" />
        </Svg>
      </Animated.View>

      {/* Caption card. */}
      <Animated.View
        key={step.id}
        entering={FadeInUp.duration(320)}
        style={[styles.card, { left: SIDE_MARGIN, right: SIDE_MARGIN }, cardPos]}
      >
        <View style={styles.dots}>
          {Array.from({ length: stepCount }).map((_, i) => (
            <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
          ))}
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
        <View style={styles.actions}>
          {stepIndex > 0 ? (
            <Pressable onPress={onBack} hitSlop={8}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={styles.rightActions}>
            <Pressable onPress={onSkip} hitSlop={8}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable onPress={onNext} style={[styles.nextBtn, isFinal && styles.nextBtnWide]}>
              <Text style={styles.nextText}>{isFinal ? 'Scan an invoice' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    backgroundColor: Colors.background,
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 12,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 18 },
  title: {
    fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary,
    letterSpacing: -0.3, marginBottom: 6,
  },
  body: {
    fontSize: 13.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary,
    lineHeight: 19, marginBottom: 18,
  },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  backText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textTertiary },
  skipText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  nextBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 22, paddingVertical: 11,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  nextBtnWide: { paddingHorizontal: 18 },
  nextText: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: '#fff', letterSpacing: -0.1 },
});

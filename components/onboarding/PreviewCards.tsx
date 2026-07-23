import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  ZoomIn, FadeInDown,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
import DonutChart from '../ui/DonutChart';

interface PreviewProps {
  active: boolean;
}

// Shared "device frame" wrapper so every preview reads as a real screenshot
// of the app rather than a marketing graphic — same radius/shadow the real
// cards use, just scaled down to sit inside an onboarding slide.
function Frame({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <View style={[styles.frame, dark ? styles.frameDark : styles.frameLight]}>
      {children}
    </View>
  );
}

export function ScanPreview({ active }: PreviewProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    } else {
      pulse.value = 0;
    }
  }, [active, pulse]);

  const cornerStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));

  return (
    <Frame dark>
      <View style={styles.scanCorners}>
        <Animated.View style={[styles.corner, styles.cornerTL, cornerStyle]} />
        <Animated.View style={[styles.corner, styles.cornerTR, cornerStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBL, cornerStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBR, cornerStyle]} />
        <Text style={styles.scanHint}>Align invoice within frame</Text>
      </View>
      <View style={styles.scanBottomBar}>
        <Animated.View style={[styles.scanCaptureRing, ringStyle]}>
          <View style={styles.scanCaptureBtn} />
        </Animated.View>
      </View>
    </Frame>
  );
}

export function PriceAlertPreview({ active }: PreviewProps) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!active) {
      setPct(0);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const duration = 900;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setPct(Math.round(t * 11));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <Frame>
      <View style={styles.alertRow}>
        <Animated.View
          key={active ? 'alert-in' : 'alert-out'}
          entering={ZoomIn.duration(420)}
          style={styles.alertIconWrap}
        >
          <Text style={styles.alertIconText}>!</Text>
        </Animated.View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.alertEyebrow}>Price increase</Text>
          <Text style={styles.alertTitle} numberOfLines={1}>Chicken Breast · Cascade</Text>
          <Text style={styles.alertSub}>up $0.31/lb ({pct}%) since last order</Text>
        </View>
      </View>
      <View style={styles.alertDivider} />
      <View style={styles.alertRow}>
        <View style={[styles.alertIconWrap, { backgroundColor: Colors.successLight }]}>
          <Text style={[styles.alertIconText, { color: Colors.success }]}>↓</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.alertEyebrow, { color: Colors.success }]}>Cheaper elsewhere</Text>
          <Text style={styles.alertTitle} numberOfLines={1}>Tofu, Extra Firm</Text>
          <Text style={[styles.alertSub, { color: Colors.success }]}>15% less at Golden State</Text>
        </View>
      </View>
    </Frame>
  );
}

export function VerifyPreview({ active }: PreviewProps) {
  const segments = [
    { key: 'received', label: 'Received', value: 18, color: Colors.primary },
    { key: 'missing', label: 'Missing', value: 2, color: Colors.danger },
    { key: 'pending', label: 'Pending', value: 5, color: Colors.textTertiary },
  ];
  return (
    <Frame>
      <Text style={styles.tileLabel}>Delivery check</Text>
      <Text style={styles.tileCaption}>Share of invoiced items verified against delivery</Text>
      <View style={styles.verifyRow}>
        <View style={styles.donutWrap}>
          <DonutChart key={active ? 'donut-in' : 'donut-out'} segments={segments} size={72} strokeWidth={11} />
          <View style={styles.donutCenter} pointerEvents="none">
            <Text style={styles.donutCenterText}>72%</Text>
          </View>
        </View>
        <View style={styles.verifyLegend}>
          {segments.map((s) => (
            <View key={s.key} style={styles.verifyLegendItem}>
              <View style={[styles.verifyLegendDot, { backgroundColor: s.color }]} />
              <Text style={styles.verifyLegendText}>{s.label} {s.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </Frame>
  );
}

// Recipe costing: a miniature dish card the way it renders in the real list —
// name, live cost, confidence badge — plus the ingredient breakdown that makes
// up that cost. The cost figure counts up and the cost-share bars fill in, so
// it reads as the app pricing the dish from invoice history in real time.
const RECIPE_INGREDIENTS = [
  { name: 'Chicken breast', share: 0.62, cost: '$1.98', color: Colors.primary },
  { name: 'Rice noodles', share: 0.24, cost: '$0.77', color: Colors.vendorGolden },
  { name: 'Pad thai sauce', share: 0.14, cost: '$0.45', color: Colors.warning },
] as const;

export function RecipeCostPreview({ active }: PreviewProps) {
  const [cents, setCents] = useState(0);
  const fill = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      setCents(0);
      fill.value = 0;
      return;
    }
    fill.value = withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    let raf = 0;
    const start = Date.now();
    const duration = 800;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setCents(Math.round(t * 320));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, fill]);

  return (
    <Frame>
      <View style={styles.recipeTopRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.recipeName} numberOfLines={1}>Pad Thai</Text>
          <View style={styles.recipeCostRow}>
            <Text style={styles.recipeCost}>${(cents / 100).toFixed(2)}</Text>
            <Text style={styles.recipeMargin}>68% margin</Text>
          </View>
        </View>
        <View style={styles.recipeBadge}>
          <Text style={styles.recipeBadgeText}>High</Text>
        </View>
      </View>

      <View style={styles.recipeDivider} />

      {RECIPE_INGREDIENTS.map((ing) => (
        <IngredientRow key={ing.name} ing={ing} fill={fill} />
      ))}
    </Frame>
  );
}

function IngredientRow({
  ing, fill,
}: { ing: (typeof RECIPE_INGREDIENTS)[number]; fill: SharedValue<number> }) {
  const barStyle = useAnimatedStyle(() => ({
    width: `${fill.value * ing.share * 100}%`,
  }));
  return (
    <View style={styles.ingRow}>
      <Text style={styles.ingName} numberOfLines={1}>{ing.name}</Text>
      <View style={styles.ingTrack}>
        <Animated.View style={[styles.ingBar, { backgroundColor: ing.color }, barStyle]} />
      </View>
      <Text style={styles.ingCost}>{ing.cost}</Text>
    </View>
  );
}

// Invoice capture: a scanned invoice resolving into structured line-item data —
// vendor header, clean line items with prices, and a running total. Rows drop in
// one after another to convey the "photo → parsed data" transformation.
const INVOICE_ROWS = [
  { name: 'Chicken breast', qty: '2 CS', price: '$184.00' },
  { name: 'Jasmine rice', qty: '4 BX', price: '$96.40' },
  { name: 'Canola oil', qty: '1 CS', price: '$61.20' },
] as const;

export function InvoiceParsePreview({ active }: PreviewProps) {
  return (
    <Frame>
      <View style={styles.invHeader}>
        <View style={styles.invAvatar}>
          <Text style={styles.invAvatarText}>CF</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.invVendor} numberOfLines={1}>Cascade Foods</Text>
          <Text style={styles.invNumber}>Invoice #4821</Text>
        </View>
        <View style={styles.invScannedPill}>
          <Text style={styles.invScannedText}>Scanned</Text>
        </View>
      </View>

      <View style={styles.recipeDivider} />

      {INVOICE_ROWS.map((row, i) => (
        <Animated.View
          key={active ? `${row.name}-in` : `${row.name}-out`}
          entering={active ? FadeInDown.duration(340).delay(140 + i * 130) : undefined}
          style={styles.invRow}
        >
          <Text style={styles.invItemName} numberOfLines={1}>{row.name}</Text>
          <Text style={styles.invQty}>{row.qty}</Text>
          <Text style={styles.invPrice}>{row.price}</Text>
        </Animated.View>
      ))}

      <View style={styles.recipeDivider} />
      <View style={styles.invTotalRow}>
        <Text style={styles.invTotalLabel}>Total</Text>
        <Text style={styles.invTotalValue}>$341.60</Text>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%', borderRadius: 22, padding: 18,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 24,
  },
  frameLight: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  frameDark: { backgroundColor: Colors.darkBg, borderWidth: 1, borderColor: Colors.darkBorder },

  // Scan preview
  scanCorners: {
    height: 150, borderRadius: 16, backgroundColor: Colors.darkSurface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
  },
  corner: { position: 'absolute', width: 22, height: 22 },
  cornerTL: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary, borderTopLeftRadius: 6 },
  cornerTR: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderColor: Colors.primary, borderTopRightRadius: 6 },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderColor: Colors.primary, borderBottomRightRadius: 6 },
  scanHint: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: 'rgba(255,255,255,0.45)' },
  scanBottomBar: { alignItems: 'center', marginTop: 16 },
  scanCaptureRing: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 3.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  scanCaptureBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary },

  // Price alert preview
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 14 },
  alertIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center',
  },
  alertIconText: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.warning },
  alertEyebrow: {
    fontSize: 10, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.warning, marginBottom: 2,
  },
  alertTitle: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  alertSub: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.warning, marginTop: 1 },

  // Verify preview
  tileLabel: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  tileCaption: { fontSize: 11, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 2, lineHeight: 14 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  donutWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  donutCenterText: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
  verifyLegend: { flex: 1, gap: 6 },
  verifyLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  verifyLegendDot: { width: 8, height: 8, borderRadius: 4 },
  verifyLegendText: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },

  // Recipe cost preview
  recipeTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recipeName: { fontSize: 15.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  recipeCostRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 3 },
  recipeCost: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
  recipeMargin: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary },
  recipeBadge: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  recipeBadgeText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },
  recipeDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 13 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  ingName: { width: 96, fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  ingTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: Colors.background, overflow: 'hidden' },
  ingBar: { height: 7, borderRadius: 4 },
  ingCost: { width: 44, textAlign: 'right', fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },

  // Invoice parse preview
  invHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  invAvatar: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  invAvatarText: { fontSize: 13, fontFamily: 'Manrope_800ExtraBold', color: Colors.primaryDark },
  invVendor: { fontSize: 14.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  invNumber: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, marginTop: 1 },
  invScannedPill: { backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  invScannedText: { fontSize: 9.5, fontFamily: 'Manrope_800ExtraBold', color: Colors.primaryDark, letterSpacing: 0.5, textTransform: 'uppercase' },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  invItemName: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textPrimary },
  invQty: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary,
    backgroundColor: Colors.background, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden',
  },
  invPrice: { width: 62, textAlign: 'right', fontSize: 13, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  invTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  invTotalLabel: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.textSecondary },
  invTotalValue: { fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
});

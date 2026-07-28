import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  ZoomIn, FadeInDown,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, Easing,
  interpolate, Extrapolation,
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

// Scan: a live viewfinder that resolves an invoice into structured data. A green
// beam sweeps the framed document and lights up each extracted price in turn —
// the "photo in, line items out" promise happening on screen.
const SCAN_VIEW_H = 240;
const SCAN_BEAM_H = 30;
const SCAN_ROWS = [
  { threshold: 0.33, width: '54%', price: '$184.00' },
  { threshold: 0.50, width: '44%', price: '$96.40' },
  { threshold: 0.67, width: '60%', price: '$61.20' },
] as const;

export function ScanPreview({ active }: PreviewProps) {
  const pulse = useSharedValue(0);
  const scan = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      scan.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
          withDelay(650, withTiming(1, { duration: 0 }))
        ),
        -1
      );
    } else {
      pulse.value = 0;
      scan.value = 0;
    }
  }, [active, pulse, scan]);

  const cornerStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));
  const beamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scan.value, [0, 0.06, 0.92, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scan.value, [0, 1], [0, SCAN_VIEW_H - SCAN_BEAM_H], Extrapolation.CLAMP) }],
  }));

  return (
    <Frame dark>
      <View style={styles.scanViewfinder}>
        <Animated.View style={[styles.corner, styles.cornerTL, cornerStyle]} />
        <Animated.View style={[styles.corner, styles.cornerTR, cornerStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBL, cornerStyle]} />
        <Animated.View style={[styles.corner, styles.cornerBR, cornerStyle]} />

        <View style={styles.scanDoc}>
          <View style={styles.scanDocTitle} />
          {SCAN_ROWS.map((row) => (
            <ScanDocRow key={row.price} scan={scan} threshold={row.threshold} width={row.width} price={row.price} />
          ))}
          <View style={styles.scanDocDivider} />
          <ScanDocRow scan={scan} threshold={0.86} width="34%" price="$341.60" total />
        </View>

        <Animated.View style={[styles.scanBeam, beamStyle]}>
          <View style={styles.scanBeamGlow} />
          <View style={styles.scanBeamLine} />
        </Animated.View>
      </View>

      <View style={styles.scanBottomBar}>
        <Text style={styles.scanHint}>Extracting line items</Text>
        <Animated.View style={[styles.scanCaptureRing, ringStyle]}>
          <View style={styles.scanCaptureBtn} />
        </Animated.View>
      </View>
    </Frame>
  );
}

function ScanDocRow({
  scan, threshold, width, price, total,
}: { scan: SharedValue<number>; threshold: number; width: string; price: string; total?: boolean }) {
  const chipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scan.value, [threshold - 0.05, threshold + 0.05], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scan.value, [threshold - 0.05, threshold + 0.05], [0.8, 1], Extrapolation.CLAMP) }],
  }));
  return (
    <View style={styles.scanDocRow}>
      <View style={[styles.scanDocName, { width } as any]} />
      <View style={styles.scanDocPriceSlot}>
        <View style={[styles.scanDocPricePh, total && styles.scanDocPricePhTotal]} />
        <Animated.View style={[styles.scanDocChip, total && styles.scanDocChipTotal, chipStyle]}>
          <Text style={[styles.scanDocChipText, total && styles.scanDocChipTextTotal]}>{price}</Text>
        </Animated.View>
      </View>
    </View>
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

// Whole-app overview: the home dashboard at a glance — a running spend total,
// a mini spend-trend chart, and the per-vendor / top-item rollups underneath.
// The total counts up and the bars fill in, so it reads as Sift turning a pile
// of invoices into a single live picture of the business.
const OV_BARS = [40, 62, 50, 78, 58, 90] as const;

export function DashboardOverviewPreview({ active }: PreviewProps) {
  const [total, setTotal] = useState(0);
  const fill = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      setTotal(0);
      fill.value = 0;
      return;
    }
    fill.value = withDelay(120, withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) }));
    let raf = 0;
    const start = Date.now();
    const duration = 850;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setTotal(Math.round(t * 12480));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, fill]);

  return (
    <Frame>
      <View style={ov.headRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={ov.headLabel}>Spend this month</Text>
          <Text style={ov.headTotal}>${total.toLocaleString('en-US')}</Text>
        </View>
        <View style={ov.trendPill}>
          <Text style={ov.trendText}>↑ 8%</Text>
        </View>
      </View>

      <View style={ov.chartRow}>
        {OV_BARS.map((h, i) => (
          <OverviewBar key={i} target={h} fill={fill} accent={i === OV_BARS.length - 1} />
        ))}
      </View>

      <View style={ov.divider} />

      <View style={ov.metricRow}>
        <View style={[ov.metricDot, { backgroundColor: Colors.vendorGolden }]} />
        <Text style={ov.metricName} numberOfLines={1}>Cascade Foods</Text>
        <Text style={ov.metricVal}>$4,210</Text>
      </View>
      <View style={[ov.metricRow, { marginBottom: 0 }]}>
        <View style={[ov.metricDot, { backgroundColor: Colors.warning }]} />
        <Text style={ov.metricName} numberOfLines={1}>Chicken breast · top item</Text>
        <Text style={ov.metricVal}>$1,980</Text>
      </View>
    </Frame>
  );
}

function OverviewBar({
  target, fill, accent,
}: { target: number; fill: SharedValue<number>; accent: boolean }) {
  const barStyle = useAnimatedStyle(() => ({
    height: `${fill.value * target}%`,
  }));
  return (
    <View style={ov.barTrack}>
      <Animated.View
        style={[ov.bar, { backgroundColor: accent ? Colors.chartBarTo : Colors.primaryMuted }, barStyle]}
      />
    </View>
  );
}

const ov = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  headTotal: { fontSize: 24, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5, marginTop: 3 },
  trendPill: { backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, flexShrink: 0 },
  trendText: { fontSize: 12, fontFamily: 'Manrope_700Bold', color: Colors.primaryDark },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, height: 60, marginTop: 18 },
  barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 5, minHeight: 4 },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 14 },

  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  metricDot: { width: 9, height: 9, borderRadius: 4.5, flexShrink: 0 },
  metricName: { flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  metricVal: { fontSize: 12.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
});

const styles = StyleSheet.create({
  frame: {
    width: '100%', borderRadius: 22, padding: 18,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 24,
  },
  frameLight: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  frameDark: { backgroundColor: Colors.darkBg, borderWidth: 1, borderColor: Colors.darkBorder },

  // Scan preview
  scanViewfinder: {
    height: 240, borderRadius: 16, backgroundColor: Colors.darkSurface,
    borderWidth: 1, borderColor: Colors.darkBorder, position: 'relative', overflow: 'hidden',
  },
  corner: { position: 'absolute', width: 22, height: 22, zIndex: 2 },
  cornerTL: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary, borderTopLeftRadius: 6 },
  cornerTR: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderColor: Colors.primary, borderTopRightRadius: 6 },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderColor: Colors.primary, borderBottomRightRadius: 6 },

  scanDoc: {
    position: 'absolute', top: 24, left: 24, right: 24, bottom: 24,
    backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14, paddingVertical: 16, justifyContent: 'center',
  },
  scanDocTitle: { width: '46%', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.30)', marginBottom: 18 },
  scanDocRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  scanDocName: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)' },
  scanDocPriceSlot: { marginLeft: 'auto', width: 66, height: 19, position: 'relative' },
  scanDocPricePh: { position: 'absolute', right: 0, top: 5.5, width: 42, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.10)' },
  scanDocPricePhTotal: { width: 50 },
  scanDocChip: {
    position: 'absolute', right: 0, top: 0, height: 19, paddingHorizontal: 7, borderRadius: 6,
    backgroundColor: 'rgba(93,176,117,0.20)', borderWidth: 1, borderColor: 'rgba(93,176,117,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanDocChipTotal: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  scanDocChipText: { fontSize: 10.5, fontFamily: 'Manrope_700Bold', color: Colors.primary },
  scanDocChipTextTotal: { color: '#fff' },
  scanDocDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.09)', marginTop: 3, marginBottom: 17 },

  scanBeam: { position: 'absolute', top: 0, left: 10, right: 10, height: 30, zIndex: 1 },
  scanBeamGlow: { flex: 1, borderRadius: 8, backgroundColor: 'rgba(93,176,117,0.10)' },
  scanBeamLine: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 2, backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },

  scanBottomBar: { alignItems: 'center', marginTop: 16 },
  scanHint: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.2, marginBottom: 12 },
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

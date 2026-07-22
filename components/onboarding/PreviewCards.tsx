import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  ZoomIn,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing,
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
});

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, {
  Defs, LinearGradient, Stop, Rect, Line, ClipPath, Text as SvgText, G,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, withDelay, Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
import { DayData, SpendPeriod } from '../../store/useStore';
import { spendPeriodLabel, spendPeriodCompareLabel } from '../../hooks/useSpendPeriod';
import Spinner from '../ui/Spinner';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Chart geometry
const TOP_PAD = 22;   // headroom for the peak $ direct-label
const PLOT_H = 116;   // bar plotting area height
const LABEL_H = 20;   // x-axis label band
const SVG_H = TOP_PAD + PLOT_H + LABEL_H;
const BASELINE = TOP_PAD + PLOT_H;
const RADIUS = 6;     // bar top-corner radius
const GRID_STEPS = [0.25, 0.5, 0.75, 1]; // recessive gridlines as fractions of PLOT_H

interface SpendTrendCardProps {
  period: SpendPeriod;
  yearsBack: number;
  periodTotal: number;
  periodPctChange: number;
  barData: DayData[];
  isLoading?: boolean;
}

// A single duotone gradient bar. Grows up from the baseline on mount / whenever
// the data changes, via a shared reanimated `grow` value (the house pattern —
// see PreviewCards). Bottom corners are square: the bar extends RADIUS below the
// baseline and a plot-height clipPath shears them off, leaving a rounded top on
// a flat axis.
function Bar({
  x, width, fullH, fill, grow,
}: { x: number; width: number; fullH: number; fill: string; grow: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    const h = fullH * grow.value;
    return { y: BASELINE - h, height: h + RADIUS };
  });
  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={RADIUS}
      ry={RADIUS}
      fill={fill}
      clipPath="url(#plotClip)"
      animatedProps={animatedProps}
    />
  );
}

// Headline "is spend trending up or down" glance — sits above the per-vendor
// Total Invoices tile and reads whatever period/years that card's picker has
// selected via the shared useSpendPeriod hook, so the two stay in sync with one
// control. The single tallest bar is direct-labeled with its $ value and the
// current bucket is drawn in the vivid gradient so the row of bars has reference
// points instead of reading as noise.
export default function SpendTrendCard({
  period, yearsBack, periodTotal, periodPctChange, barData, isLoading,
}: SpendTrendCardProps) {
  const compare = spendPeriodCompareLabel(period, yearsBack);
  const hasData = barData.some((d) => d.total > 0);
  const maxBar = Math.max(1, ...barData.map((d) => d.total));
  const peakIndex = hasData
    ? barData.reduce((best, d, i) => (d.total > barData[best].total ? i : best), 0)
    : -1;
  const currentIndex = barData.length - 1;
  const isUp = periodPctChange > 0;

  const [w, setW] = useState(0);
  const grow = useSharedValue(0);

  // Replay the grow-in whenever the underlying series changes (period switch or
  // a live fetch resolving), so bars animate to their new shape.
  const dataKey = barData.map((d) => Math.round(d.total)).join(',');
  useEffect(() => {
    grow.value = 0;
    grow.value = withDelay(80, withTiming(1, { duration: 780, easing: Easing.out(Easing.cubic) }));
  }, [dataKey, grow]);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next && Math.abs(next - w) > 1) setW(next);
  };

  // Bar layout: even slots, bar takes ~52% of each slot, centered.
  const n = barData.length || 1;
  const slotW = w / n;
  const barW = Math.max(6, Math.min(30, slotW * 0.52));

  return (
    <View style={styles.card}>
      {/* faint green wash marks this as the hero analytics tile */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="heroWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.heroTintTop} />
            <Stop offset="1" stopColor={Colors.heroTintBottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroWash)" />
      </Svg>

      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{spendPeriodLabel(period, yearsBack)}</Text>
            {isLoading && <Spinner size={12} color={Colors.textSecondary} />}
          </View>
          <Text style={styles.amount}>${periodTotal.toLocaleString()}</Text>
        </View>
        {compare && (
          <View style={[styles.trendPill, isUp ? styles.trendPillUp : styles.trendPillDown]}>
            <Text style={[styles.trendArrow, isUp ? styles.trendTextUp : styles.trendTextDown]}>
              {isUp ? '↑' : '↓'}
            </Text>
            <Text style={[styles.trendPct, isUp ? styles.trendTextUp : styles.trendTextDown]}>
              {Math.abs(periodPctChange)}%
            </Text>
          </View>
        )}
      </View>
      {compare && <Text style={styles.compareLabel}>{compare}</Text>}

      {hasData ? (
        <View style={styles.chartWrap} onLayout={onLayout}>
          {w > 0 && (
            <Svg width={w} height={SVG_H}>
              <Defs>
                <LinearGradient id="barMain" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={Colors.chartBarFrom} />
                  <Stop offset="1" stopColor={Colors.chartBarTo} />
                </LinearGradient>
                <LinearGradient id="barMuted" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={Colors.chartBarMutedFrom} />
                  <Stop offset="1" stopColor={Colors.chartBarMutedTo} />
                </LinearGradient>
                <ClipPath id="plotClip">
                  <Rect x="0" y={TOP_PAD - 2} width={w} height={PLOT_H + 2} />
                </ClipPath>
              </Defs>

              {/* recessive gridlines + baseline */}
              {GRID_STEPS.map((f) => {
                const y = BASELINE - PLOT_H * f;
                return (
                  <Line
                    key={f}
                    x1={0}
                    x2={w}
                    y1={y}
                    y2={y}
                    stroke={Colors.chartGrid}
                    strokeWidth={f === 1 ? 0 : 1}
                  />
                );
              })}
              <Line x1={0} x2={w} y1={BASELINE} y2={BASELINE} stroke={Colors.border} strokeWidth={1.5} />

              {/* zero-bucket stubs — a faint rail so empty periods still read
                  as part of the time axis instead of leaving one lonely bar */}
              {barData.map((d, i) => {
                if (d.total > 0) return null;
                const cx = slotW * i + slotW / 2;
                return (
                  <Rect
                    key={`stub-${i}`}
                    x={cx - barW / 2}
                    y={BASELINE - 4}
                    width={barW}
                    height={4}
                    rx={2}
                    fill={Colors.primaryMuted}
                    fillOpacity={0.4}
                  />
                );
              })}

              {/* bars */}
              {barData.map((d, i) => {
                const cx = slotW * i + slotW / 2;
                const x = cx - barW / 2;
                const fullH = d.total > 0 ? Math.max((d.total / maxBar) * PLOT_H, 4) : 0;
                // The bar that matters most gets the vivid gradient: the peak,
                // plus the current period when it actually has spend.
                const emphasize = i === peakIndex || (i === currentIndex && d.total > 0);
                if (fullH === 0) return null;
                return (
                  <Bar
                    key={i}
                    x={x}
                    width={barW}
                    fullH={fullH}
                    fill={emphasize ? 'url(#barMain)' : 'url(#barMuted)'}
                    grow={grow}
                  />
                );
              })}

              {/* x-axis labels */}
              <G>
                {barData.map((d, i) => {
                  const cx = slotW * i + slotW / 2;
                  const isCurrent = i === currentIndex;
                  return (
                    <SvgText
                      key={i}
                      x={cx}
                      y={BASELINE + 15}
                      fill={isCurrent ? Colors.textSecondary : Colors.textTertiary}
                      fontSize={10}
                      fontFamily={isCurrent ? 'Manrope_700Bold' : 'Manrope_600SemiBold'}
                      textAnchor="middle"
                    >
                      {d.label}
                    </SvgText>
                  );
                })}
              </G>
            </Svg>
          )}

          {/* peak direct-label — rendered as RN Text (not SvgText) so the
              Manrope glyphs measure correctly */}
          {w > 0 && peakIndex >= 0 && (() => {
            const cx = slotW * peakIndex + slotW / 2;
            const fullH = Math.max((barData[peakIndex].total / maxBar) * PLOT_H, 4);
            return (
              <Text
                style={[styles.peakLabel, { left: cx - 50, top: BASELINE - fullH - 19 }]}
                numberOfLines={1}
              >
                ${Math.round(barData[peakIndex].total).toLocaleString()}
              </Text>
            );
          })()}
        </View>
      ) : (
        <Text style={styles.empty}>Scan a few invoices to see your spend trend here.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 24,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, overflow: 'hidden',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 22,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  label: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary },
  amount: { fontSize: 34, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.9 },

  trendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    borderRadius: 11, paddingHorizontal: 9, paddingVertical: 5, marginTop: 4, flexShrink: 0,
  },
  trendPillUp: { backgroundColor: Colors.dangerLight },
  trendPillDown: { backgroundColor: Colors.primaryLight },
  trendArrow: { fontSize: 12, fontFamily: 'Manrope_800ExtraBold' },
  trendPct: { fontSize: 13, fontFamily: 'Manrope_800ExtraBold', letterSpacing: -0.2 },
  trendTextUp: { color: Colors.danger },
  trendTextDown: { color: Colors.primaryDark },
  compareLabel: { fontSize: 12, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, marginTop: 4 },

  chartWrap: { marginTop: 14, height: SVG_H, width: '100%', position: 'relative' },
  peakLabel: {
    position: 'absolute', width: 100, textAlign: 'center',
    fontSize: 11.5, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary,
  },

  empty: {
    fontSize: 13, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary,
    marginTop: 16, lineHeight: 19,
  },
});

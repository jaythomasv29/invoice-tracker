import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useOrganization } from '@clerk/clerk-expo';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { Colors } from '../constants/Colors';
import { useSupabase } from '../lib/supabase';
import { fetchItemPriceHistory, ItemPricePoint } from '../lib/invoicePipeline';
import BackButton from '../components/ui/BackButton';
import Spinner from '../components/ui/Spinner';

const CHART_H = 130;
const CHART_PAD_X = 14;
const CHART_PAD_Y = 16;

// Turns a price alert's single "then vs now" diff, or a Top Item's all-time
// total, into the actual trend behind it — every purchase of one item over
// time, oldest first, with the price-per-unit chart and the raw invoice list
// underneath it. All of this data already existed (line items always carried
// unit_price + a date); it just had no dedicated view before.
export default function ItemHistoryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { itemName, vendorId } = useLocalSearchParams<{ itemName: string; vendorId?: string }>();
  const { organization } = useOrganization();
  const supabase = useSupabase();

  const [points, setPoints] = useState<ItemPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!organization?.id || !itemName) return;
    setLoading(true);
    setLoadError('');
    fetchItemPriceHistory(supabase, organization.id, itemName, vendorId || null)
      .then(setPoints)
      .catch((err: any) => setLoadError(err?.message ?? 'Could not load price history'))
      .finally(() => setLoading(false));
  }, [organization?.id, supabase, itemName, vendorId]);

  const chartW = width - 32 - CHART_PAD_X * 2;
  const prices = points.map((p) => p.unitPrice);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const range = maxPrice - minPrice || 1;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * chartW : chartW / 2;
    const y = CHART_H - CHART_PAD_Y - ((p.unitPrice - minPrice) / range) * (CHART_H - CHART_PAD_Y * 2);
    return { x, y };
  });
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');

  const latest = points[points.length - 1];
  const first = points[0];
  const changePct = first && latest && first.unitPrice > 0
    ? Math.round(((latest.unitPrice - first.unitPrice) / first.unitPrice) * 1000) / 10
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>{itemName}</Text>
          {!!vendorId && points[0] && <Text style={styles.subtitle} numberOfLines={1}>{points[0].vendorName}</Text>}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <Spinner size={20} color={Colors.textSecondary} />
        </View>
      ) : loadError ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : points.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyTitle}>No purchase history yet</Text>
          <Text style={styles.emptySub}>This item hasn't shown up on a saved invoice.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
              <View>
                <Text style={styles.chartLabel}>Latest unit price</Text>
                <Text style={styles.chartPrice}>${latest.unitPrice.toFixed(2)}/{latest.unit}</Text>
              </View>
              {points.length > 1 && (
                <View style={[styles.changePill, changePct > 0 ? styles.changePillUp : styles.changePillDown]}>
                  <Text style={[styles.changePillText, changePct > 0 ? styles.changeTextUp : styles.changeTextDown]}>
                    {changePct >= 0 ? '↑' : '↓'} {Math.abs(changePct)}% since first order
                  </Text>
                </View>
              )}
            </View>

            {points.length > 1 ? (
              <Svg width={chartW} height={CHART_H} style={{ marginTop: 14 }}>
                <Line
                  x1={0} y1={CHART_H - CHART_PAD_Y} x2={chartW} y2={CHART_H - CHART_PAD_Y}
                  stroke={Colors.border} strokeWidth={1}
                />
                <Polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={Colors.primary}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {coords.map((c, i) => (
                  <Circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4 : 2.5} fill={Colors.primary} />
                ))}
              </Svg>
            ) : (
              <Text style={styles.onePointNote}>Only one order on record so far — the trend will show up after the next one.</Text>
            )}
          </View>

          <Text style={styles.sectionLabel}>Every order, most recent first</Text>
          <View style={styles.list}>
            {[...points].reverse().map((p, i) => (
              <View key={`${p.invoiceId}-${i}`} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowVendor} numberOfLines={1}>{p.vendorName}</Text>
                  <Text style={styles.rowDate}>{p.dateLabel}</Text>
                </View>
                <Text style={styles.rowPrice}>${p.unitPrice.toFixed(2)}/{p.unit}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, marginTop: 1 },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  errorText: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  emptyTitle: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  emptySub: { fontSize: 13.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, textAlign: 'center' },

  scroll: { padding: 16, gap: 16, paddingBottom: 40 },

  chartCard: {
    backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    padding: 18,
  },
  chartHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  chartLabel: { fontSize: 11.5, fontFamily: 'Manrope_600SemiBold', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  chartPrice: { fontSize: 24, fontFamily: 'Manrope_800ExtraBold', color: Colors.textPrimary, letterSpacing: -0.5, marginTop: 2 },
  changePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  changePillUp: { backgroundColor: Colors.warningLight },
  changePillDown: { backgroundColor: Colors.primaryLight },
  changePillText: { fontSize: 11.5, fontFamily: 'Manrope_700Bold' },
  changeTextUp: { color: Colors.warning },
  changeTextDown: { color: Colors.primaryDark },
  onePointNote: { fontSize: 12.5, fontFamily: 'Manrope_500Medium', color: Colors.textSecondary, marginTop: 14, lineHeight: 18 },

  sectionLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', letterSpacing: 0.5,
    textTransform: 'uppercase', color: Colors.textTertiary,
  },
  list: {
    backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  rowVendor: { fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
  rowDate: { fontSize: 11.5, fontFamily: 'Manrope_500Medium', color: Colors.textTertiary, marginTop: 1 },
  rowPrice: { fontSize: 13.5, fontFamily: 'Manrope_700Bold', color: Colors.textPrimary },
});

import { Design } from '../../constants/Design';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import Touch from '../ui/MotionTouchable';
import { Colors } from '../../constants/Colors';
import { useSupabase } from '../../lib/supabase';
import { useWorkspace } from '../../lib/workspaceContext';
import { buildPriceWatch, type PriceWatchItem } from '../../lib/householdPriceWatch';
import { buildDemoPriceWatch } from '../../lib/demoData';
import { useStore } from '../../store/useStore';
export default function HouseholdInsightsCard({
  count,
  isPaid,
}: {
  count: number;
  isPaid: boolean;
}) {
  const { organization } = useWorkspace();
  const db = useSupabase();
  const router = useRouter();
  const demoMode = useStore((s) => s.demoMode);
  const [watch, setWatch] = useState<PriceWatchItem[]>([]);
  const [error, setError] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!organization?.id || !isPaid) {
        setWatch([]);
        return;
      }
      // Sample household: ranked from the fixture, never from the database.
      if (demoMode) {
        setError(false);
        setWatch(buildDemoPriceWatch());
        return;
      }
      void (async () => {
        const data: any[] = [];
        setError(false);
        for (let offset = 0; ; offset += 1000) {
          const { data: page, error: e } = await db
            .from('invoice_line_items')
            .select(
              'id,invoice_id,clean_name,qty,extended_price,retail_product,invoices!inner(invoice_date,created_at,vendor_id,status)',
            )
            .eq('organization_id', organization.id)
            .eq('line_item_type', 'charge')
            .is('voided_at', null)
            .eq('invoices.status', 'saved')
            .order('id')
            .range(offset, offset + 999);
          if (!active) return;
          if (e) {
            setError(true);
            return;
          }
          data.push(...(page ?? []));
          if ((page ?? []).length < 1000) break;
        }
        setWatch(buildPriceWatch(data));
      })();
      return () => {
        active = false;
      };
    }, [organization?.id, isPaid, db, demoMode]),
  );
  const next =
    count < 1
      ? 1
      : count < 5
        ? 5
        : count < 10
          ? 10
          : count < 25
            ? 25
            : Math.ceil((count + 1) / 25) * 25;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(Math.min(1, count / next), {
      duration: 480,
      reduceMotion: ReduceMotion.System,
    });
  }, [count, next, progress]);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));
  return (
    <Animated.View
      entering={FadeInDown.duration(240).reduceMotion(ReduceMotion.System)}
      style={s.wrap}
    >
      <View style={s.card}>
        <Text style={s.eyebrow}>A CLEARER PICTURE, ONE RECEIPT AT A TIME</Text>
        <Text style={s.title}>
          {count === 0
            ? 'Your household story starts here.'
            : `${count} receipt${count === 1 ? '' : 's'}. More perspective.`}
        </Text>
        <Text style={s.body}>
          Shop when you need to. Every saved receipt adds to your
          history—there’s no daily spending goal.
        </Text>
        <View style={s.track}>
          <Animated.View
            style={[
              s.fill,
              { width: '100%', transformOrigin: 'left' },
              progressStyle,
            ]}
          />
        </View>
        <Text style={s.caption}>
          {count} of {next} receipts toward your next history milestone
        </Text>
      </View>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.title}>Your price watch</Text>
          <Text style={s.badge}>PERSONAL PRO</Text>
        </View>
        <Text style={s.body}>
          Buying more can raise your total without any price increase. Compare
          the same product and package using clear net unit prices. Coupons and
          offers can change what you paid.
        </Text>
        {!isPaid ? (
          <Touch style={s.action} onPress={() => router.push('/paywall')}>
            <Text style={s.link}>Explore Personal Pro →</Text>
          </Touch>
        ) : error ? (
          <Text style={s.caption}>
            Could not refresh price watch. Reopen Home to retry.
          </Text>
        ) : !watch.length ? (
          <Text style={s.caption}>
            Add repeat purchases with readable product codes and package sizes.
            Ambiguous products or discounts stay out of comparisons.
          </Text>
        ) : (
          watch.map((item, i) => {
            const pct = (item.last / item.first - 1) * 100;
            return (
              <Touch
                key={`${item.name}-${i}`}
                style={s.item}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/item-history',
                    params: { itemName: item.name, comparisonKey: item.key },
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{item.name}</Text>
                  <Text style={s.caption}>
                    ${item.last.toFixed(4)}/{item.unit} · {item.count}{' '}
                    comparable lines
                  </Text>
                </View>
                <Text style={[s.link, pct > 0 && { color: Colors.danger }]}>
                  {pct > 0 ? '+' : ''}
                  {pct.toFixed(1)}% ›
                </Text>
              </Touch>
            );
          })
        )}
      </View>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  wrap: { gap: 16 },
  card: {
    padding: 20,
    borderRadius: Design.radius.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  eyebrow: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 10,
    lineHeight: 17,
    letterSpacing: 1,
    color: Colors.primary,
  },
  title: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 19,
    lineHeight: 27,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  body: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primaryLight,
    overflow: 'hidden',
  },
  fill: { height: 7, backgroundColor: Colors.primary, borderRadius: 4 },
  caption: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 9,
    color: Colors.primary,
  },
  action: { minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: Colors.primary },
  item: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 10,
  },
  itemName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
});

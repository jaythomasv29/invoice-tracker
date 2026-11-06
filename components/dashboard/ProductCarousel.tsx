import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, FlatList, StyleSheet, Text, View } from "react-native";
import Animated, {
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { Colors } from "../../constants/Colors";
import { useSupabase } from "../../lib/supabase";
import {
  searchPurchases,
  purchaseHistory,
  type PurchasedProduct,
} from "../../lib/products";
import type { PurchaseObservation } from "../../shared/measurement";
import {
  forecastReorder,
  FORECAST_REASONS,
} from "../../shared/reorderForecast";
import { ensureAiConsent } from "../../lib/aiConsent";
import { useEntitlement } from "../../hooks/useEntitlement";
import { useStore } from "../../store/useStore";
import { buildDemoInvoices } from "../../lib/demoData";
import Touch from "../ui/MotionTouchable";
import PurchaseHistorySheet, {
  displayPurchaseDate,
} from "../products/PurchaseHistorySheet";
import Spinner from "../ui/Spinner";

function demoCatalog() {
  const map = new Map<string, PurchaseObservation[]>();
  for (const inv of buildDemoInvoices())
    for (const line of inv.lineItems) {
      const key = `${inv.vendorId}:${line.rawDesc || line.desc}:${line.unit}`;
      const row: PurchaseObservation = {
        id: line.id,
        raw_description: line.rawDesc || line.desc,
        clean_name: line.desc,
        qty: line.qty,
        unit_of_measure: line.unit,
        extended_price: line.ext,
        unit_price: line.unitPrice,
        invoices: {
          id: inv.id,
          vendor_id: inv.vendorId,
          invoice_date: inv.dateIso ?? null,
          created_at: inv.dateIso ? inv.dateIso + "T12:00:00Z" : "",
          vendors: { name: inv.vendorName },
        },
      };
      map.set(key, [...(map.get(key) ?? []), row]);
    }
  return [...map].map(([key, history]) => ({
    row: { key, purchase: history[0], count: history.length },
    history,
  }));
}
type Page =
  | { kind: "overview" }
  | { kind: "product"; row: PurchasedProduct }
  | { kind: "empty" };
const money = (v: unknown) =>
  v != null && Number.isFinite(Number(v))
    ? Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";
export default function ProductCarousel({
  children,
  onProductViewChange,
}: {
  children: ReactNode;
  onProductViewChange?: (active: boolean) => void;
}) {
  const db = useSupabase(),
    router = useRouter(),
    reduced = useReducedMotion();
  const demo = useStore((s) => s.demoMode);
  const [products, setProducts] = useState<PurchasedProduct[]>([]),
    [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [more, setMore] = useState(false);
  const [active, setActive] = useState(0),
    [width, setWidth] = useState(0),
    [height, setHeight] = useState(620),
    [historyProduct, setHistoryProduct] = useState<PurchasedProduct | null>(
      null,
    );
  const list = useRef<FlatList<Page>>(null),
    busy = useRef(false),
    sequence = useRef(0),
    offset = useRef(0),
    heights = useRef(new Map<number, number>()),
    historyCache = useRef(new Map<string, PurchaseObservation[]>()),
    loadedRef = useRef(false),
    activeRef = useRef(0);
  const [refresh, setRefresh] = useState(0);
  const sample = useMemo(() => (demo ? demoCatalog() : []), [demo]);
  const load = useCallback(
    async (reset = false) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      setError("");
      const id = sequence.current;
      try {
        const rows = demo
          ? sample.map((p) => p.row)
          : await searchPurchases(db, "", reset ? 0 : offset.current);
        if (id !== sequence.current) return;
        offset.current = (reset ? 0 : offset.current) + rows.length;
        loadedRef.current = true;
        setProducts((old) =>
          reset
            ? rows
            : [
                ...old,
                ...rows.filter((r) => !old.some((o) => o.key === r.key)),
              ],
        );
        setLoaded(true);
        setMore(!demo && rows.length === 200);
      } catch {
        if (id === sequence.current)
          setError("Could not load products. Tap Retry.");
      } finally {
        if (id === sequence.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [db, demo, sample],
  );
  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        sequence.current++;
        setLoading(false);
        busy.current = false;
        historyCache.current.clear();
        setRefresh((n) => n + 1);
        if (loadedRef.current) void load(true);
      };
      refresh();
      let state = AppState.currentState;
      const subscription = AppState.addEventListener("change", (next) => {
        if (next === "active" && state !== "active") refresh();
        state = next;
      });
      return () => {
        sequence.current++;
        busy.current = false;
        subscription.remove();
      };
    }, [load]),
  );
  useEffect(() => {
    if (active > 0 && !loaded && !loading && !error) void load(true);
  }, [active, loaded, loading, error, load]);
  useEffect(() => {
    if (loaded && more && active >= products.length - 2) void load();
  }, [loaded, more, active, products.length, load]);
  const pages: Page[] = [
    { kind: "overview" },
    ...(products.length
      ? products.map((row) => ({ kind: "product" as const, row }))
      : [{ kind: "empty" as const }]),
  ];
  const select = (index: number) => {
    const n = Math.max(0, Math.min(pages.length - 1, index));
    activeRef.current = n;
    setActive(n);
    onProductViewChange?.(n > 0);
    setHeight(heights.current.get(n) ?? 620);
    list.current?.scrollToOffset({ offset: n * width, animated: !reduced });
  };
  useEffect(() => {
    list.current?.scrollToOffset({
      offset: activeRef.current * width,
      animated: false,
    });
  }, [width]);
  const onPage = (index: number) => {
    activeRef.current = index;
    setActive(index);
    onProductViewChange?.(index > 0);
    setHeight(heights.current.get(index) ?? 620);
  };
  return (
    <Animated.View
      layout={LinearTransition.duration(240).reduceMotion(ReduceMotion.System)}
      style={s.shell}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={s.navigation}>
        <View style={s.segments}>
          <Touch
            style={[s.segment, active === 0 && s.selected]}
            onPress={() => select(0)}
            accessibilityState={{ selected: active === 0 }}
          >
            <Text style={[s.segmentText, active === 0 && s.selectedText]}>
              Spending
            </Text>
          </Touch>
          <Touch
            style={[s.segment, active > 0 && s.selected]}
            onPress={() => select(active || 1)}
            accessibilityState={{ selected: active > 0 }}
          >
            <Text style={[s.segmentText, active > 0 && s.selectedText]}>
              Products
            </Text>
          </Touch>
        </View>
        <View style={s.arrows}>
          <Touch
            style={s.arrow}
            onPress={() => select(active - 1)}
            disabled={active === 0}
            accessibilityLabel="Previous panel"
          >
            <Text style={[s.arrowText, active === 0 && s.disabled]}>‹</Text>
          </Touch>
          <Touch
            style={s.arrow}
            onPress={() => select(active + 1)}
            disabled={active === pages.length - 1}
            accessibilityLabel="Next panel"
          >
            <Text
              style={[s.arrowText, active === pages.length - 1 && s.disabled]}
            >
              ›
            </Text>
          </Touch>
        </View>
      </View>
      {width > 0 && (
        <FlatList
          ref={list}
          horizontal
          pagingEnabled
          data={pages}
          showsHorizontalScrollIndicator={false}
          style={{ height }}
          contentContainerStyle={{ alignItems: "flex-start" }}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews={false}
          keyExtractor={(p) => (p.kind === "product" ? p.row.key : p.kind)}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={(e) =>
            onPage(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          onEndReached={() => {
            if (loaded && more && active >= products.length - 2) void load();
          }}
          onEndReachedThreshold={0.5}
          renderItem={({ item, index }) => (
            <View
              style={{ width, alignSelf: "flex-start" }}
              onLayout={(e) => {
                const value = e.nativeEvent.layout.height;
                heights.current.set(index, value);
                if (index === active && Math.abs(height - value) > 1)
                  setHeight(value);
              }}
            >
              {item.kind === "overview" ? (
                children
              ) : item.kind === "product" ? (
                <ProductPage
                  key={`${item.row.key}:${refresh}`}
                  row={item.row}
                  active={active === index}
                  demoHistory={
                    demo
                      ? sample.find((p) => p.row.key === item.row.key)?.history
                      : undefined
                  }
                  cache={historyCache.current}
                  onHistory={() => setHistoryProduct(item.row)}
                />
              ) : (
                <View style={s.page}>
                  <Text style={s.title}>Your products, one swipe away</Text>
                  <Text style={s.body}>
                    {loading
                      ? "Loading your saved purchases…"
                      : error ||
                        (loaded
                          ? "Save your first invoice or receipt to start your product history."
                          : "Swipe here to load your purchase history.")}
                  </Text>
                  {loading ? (
                    <Spinner color={Colors.accent} />
                  ) : (
                    <Touch style={s.cta} onPress={() => void load(true)}>
                      <Text style={s.ctaText}>
                        {error ? "Retry products" : "Load products"}
                      </Text>
                    </Touch>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}
      <View style={s.footer}>
        <Text style={s.note} accessibilityLiveRegion="polite">
          {loading && loaded
            ? "Loading products…"
            : active === 0
              ? "Swipe for products →"
              : products.length
                ? `Product ${active} · ${products.length}${more ? "+" : ""} loaded`
                : "Products"}
        </Text>
        <Touch style={s.browse} onPress={() => router.push("/products")}>
          <Text style={s.link}>Browse all ›</Text>
        </Touch>
      </View>
      {!!error && products.length > 0 && (
        <Touch style={s.retry} onPress={() => void load()}>
          <Text style={s.body}>{error}</Text>
        </Touch>
      )}
      <PurchaseHistorySheet
        product={historyProduct}
        onClose={() => setHistoryProduct(null)}
        demoRows={
          demo && historyProduct
            ? sample.find((p) => p.row.key === historyProduct.key)?.history
            : undefined
        }
      />
    </Animated.View>
  );
}
function ProductPage({
  row,
  active,
  demoHistory,
  cache,
  onHistory,
}: {
  row: PurchasedProduct;
  active: boolean;
  demoHistory?: PurchaseObservation[];
  cache: Map<string, PurchaseObservation[]>;
  onHistory: () => void;
}) {
  const db = useSupabase(),
    router = useRouter();
  const { isPaid } = useEntitlement();
  const [history, setHistory] = useState<PurchaseObservation[]>(
      demoHistory ?? cache.get(row.key) ?? [],
    ),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState<{
      summary: string;
      focusNote: string;
    } | null>(null),
    [reviewing, setReviewing] = useState(false);
  const mounted = useRef(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!active || demoHistory || cache.has(row.key)) return;
    let live = true;
    setLoading(true);
    setError("");
    void purchaseHistory(db, row.key)
      .then((rows) => {
        if (live) {
          cache.set(row.key, rows);
          setHistory(rows);
        }
      })
      .catch(() => {
        if (live) setError("History could not load. Tap Retry history.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [active, db, row.key, demoHistory, cache, retry]);
  const facts = forecastReorder(history),
    p = row.purchase;
  const analyze = async () => {
    if (!isPaid) {
      router.push("/paywall");
      return;
    }
    if (reviewing) return;
    setError("");
    setReviewing(true);
    const scope = useStore.getState().activeScope;
    try {
      if (demoHistory) {
        setReview({
          summary: FORECAST_REASONS[facts.status],
          focusNote:
            "Sample history preview. Live Smart Sift reviews analyze your saved purchase patterns.",
        });
        return;
      }
      if (!(await ensureAiConsent(db))) return;
      const { data, error: callError } = await db.functions.invoke(
        "product-reorder-insight",
        { body: { key: row.key } },
      );
      if (!mounted.current || scope !== useStore.getState().activeScope) return;
      if (callError || data?.error)
        throw new Error(
          data?.error || "Could not complete the Smart Sift review. Please retry.",
        );
      setReview(data);
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Could not review this product.",
        );
    } finally {
      if (mounted.current) setReviewing(false);
    }
  };
  const datedProgress = Math.min(4, facts.datedOrderCount);
  return (
    <View style={s.page}>
      <View style={s.productTop}>
        <Text style={s.eyebrow}>PURCHASED PRODUCT</Text>
        <Text style={s.badge}>
          {facts.window ? "PATTERN READY" : `${datedProgress}/4 DATES`}
        </Text>
      </View>
      <Text style={s.title}>{p.clean_name || p.raw_description}</Text>
      <Text style={s.body}>{p.invoices.vendors?.name ?? "Supplier"}</Text>
      <View style={s.detail}>
        <Text style={s.note}>Last recorded purchase</Text>
        <Text style={s.detailValue}>
          {displayPurchaseDate(p.invoices.invoice_date)}
        </Text>
        {p.invoices.invoice_date &&
          p.invoices.invoice_date > new Date().toISOString().slice(0, 10) && (
            <Text style={s.note}>
              Future-dated record · excluded from timing evidence.
            </Text>
          )}
        {!p.invoices.invoice_date && (
          <Text style={s.note}>
            Upload dates do not establish order timing.
          </Text>
        )}
        <View style={s.detailRow}>
          <Text style={s.body}>
            {p.qty ?? "—"} {p.unit_of_measure ?? "units"}
          </Text>
          <Text style={s.detailValue}>{money(p.extended_price)}</Text>
        </View>
      </View>
      <View style={s.pattern}>
        <Text style={s.patternTitle}>
          {facts.window
            ? "Your buying rhythm"
            : loading
              ? "Reading your history…"
              : "Build your buying pattern"}
        </Text>
        <View style={s.progressTrack} accessible={false}>
          <View
            style={[s.progressFill, { width: `${(datedProgress / 4) * 100}%` }]}
          />
        </View>
        <Text style={s.body}>
          {facts.window
            ? `Usually every ${Number(facts.medianDays?.toFixed(1))} days · stock-check window ${displayPurchaseDate(facts.window.from)} – ${displayPurchaseDate(facts.window.to)}`
            : FORECAST_REASONS[facts.status]}
        </Text>
        <Text style={s.note}>
          {facts.datedOrderCount} distinct purchase dates · same supplier and
          product
        </Text>
        {!!facts.evidenceDates.length && (
          <Text style={s.note}>
            Recent:{" "}
            {facts.evidenceDates
              .slice(-3)
              .map((d) => displayPurchaseDate(d))
              .join(" · ")}
          </Text>
        )}
      </View>
      {review && (
        <View style={s.review}>
          <Text style={s.patternTitle}>Smart Sift review</Text>
          <Text style={s.body}>{review.summary}</Text>
          <Text style={s.note}>{review.focusNote}</Text>
        </View>
      )}
      <Text style={s.note}>
        Check stock before ordering. Purchase history does not tell Sift what is
        left on hand.
      </Text>
      <Touch
        style={s.cta}
        disabled={reviewing || loading}
        onPress={() => void analyze()}
        accessibilityLabel={
          isPaid
            ? "Review product pattern with Smart Sift"
            : "Unlock Smart Sift product reviews with Pro"
        }
      >
        <Text style={s.ctaText}>
          {reviewing
            ? "Reviewing…"
            : isPaid
              ? "Smart Sift"
              : "Unlock Smart Sift review · Pro"}
        </Text>
      </Touch>
      <Text style={s.small}>
        Smart Sift reviews send purchase dates, quantities and derived metrics to
        Anthropic. Pro: 60 reviews/month, up to 10/day. Repeated unchanged
        reviews are cached.
      </Text>
      <Touch style={s.historyButton} onPress={onHistory}>
        <Text style={s.link}>Purchase details & history ›</Text>
      </Touch>
      {!!error && (
        <Text style={s.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {!!error && !reviewing && (
        <Touch
          style={s.historyButton}
          onPress={() => {
            if (!cache.has(row.key)) setRetry((n) => n + 1);
            else void analyze();
          }}
        >
          <Text style={s.link}>
            {cache.has(row.key) ? "Retry Smart Sift review" : "Retry history"}
          </Text>
        </Touch>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  shell: { backgroundColor: Colors.hero, borderRadius: 32, overflow: "hidden" },
  navigation: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  segments: { flexDirection: "row", gap: 4 },
  segment: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 9999,
  },
  selected: { backgroundColor: Colors.accent },
  segmentText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: Colors.heroMuted,
  },
  selectedText: { color: Colors.hero },
  arrows: { flexDirection: "row" },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontSize: 28, color: Colors.heroText },
  disabled: { opacity: 0.3 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  browse: { minHeight: 44, justifyContent: "center" },
  link: { fontFamily: "Manrope_700Bold", fontSize: 13, color: Colors.accent },
  note: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.heroMuted,
    flexShrink: 1,
  },
  page: { padding: 24, gap: 16 },
  title: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 27,
    letterSpacing: -0.7,
    color: Colors.heroText,
  },
  body: {
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    lineHeight: 22,
    color: Colors.heroText,
  },
  productTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontFamily: "Manrope_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.heroMuted,
  },
  badge: {
    fontFamily: "Manrope_700Bold",
    fontSize: 10,
    color: Colors.hero,
    backgroundColor: Colors.accent,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  detail: {
    padding: 16,
    gap: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  detailValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
    color: Colors.heroText,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  pattern: { gap: 10 },
  patternTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: Colors.accent,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(196,215,205,0.2)",
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  review: {
    gap: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cta: {
    minHeight: 48,
    padding: 12,
    borderRadius: 9999,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: "Manrope_700Bold", fontSize: 14, color: Colors.hero },
  historyButton: { minHeight: 44, justifyContent: "center" },
  small: {
    fontFamily: "Manrope_400Regular",
    fontSize: 11,
    lineHeight: 17,
    color: Colors.heroMuted,
  },
  error: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    lineHeight: 20,
    color: Colors.heroText,
  },
  retry: { padding: 20 },
});

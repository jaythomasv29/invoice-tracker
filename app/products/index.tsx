import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Screen from "../../components/ui/Screen";
import BackButton from "../../components/ui/BackButton";
import Spinner from "../../components/ui/Spinner";
import Touch from "../../components/ui/MotionTouchable";
import {
  Action,
  Field,
  UnitPrice,
  ui,
} from "../../components/products/ProductUI";
import { useSupabase } from "../../lib/supabase";
import { useWorkspace } from "../../lib/workspaceContext";
import {
  searchPurchases,
  fetchSavedProducts,
  productPrices,
  savePurchaseProduct,
  createManualProduct,
  type PurchasedProduct,
} from "../../lib/products";
import { normalizePurchase } from "../../shared/measurement";
import {
  resolveProductPricing,
  type ProductRecord,
  type ProductPricing,
} from "../../shared/productCost";
export default function Products() {
  const db = useSupabase(),
    router = useRouter(),
    { organization } = useWorkspace();
  const [query, setQuery] = useState(""),
    [tab, setTab] = useState<"purchases" | "saved">("purchases"),
    [metric, setMetric] = useState(false);
  const [purchases, setPurchases] = useState<PurchasedProduct[]>([]),
    [saved, setSaved] = useState<ProductRecord[]>([]),
    [prices, setPrices] = useState(new Map<string, ProductPricing>());
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false),
    [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    if (!organization) return;
    const seq = ++request.current;
    setLoading(true);
    setError("");
    try {
      if (tab === "purchases") {
        const rows = await searchPurchases(db, query);
        if (seq !== request.current) return;
        setPurchases(rows);
        setMore(rows.length === 200);
      } else {
        const rows = await fetchSavedProducts(db, organization.id);
        const values = await productPrices(
          db,
          rows.map((r) => r.id),
        );
        if (seq !== request.current) return;
        setSaved(rows);
        setPrices(
          new Map(
            [...values].map(([id, v]) => [
              id,
              resolveProductPricing(v.product, v.observations),
            ]),
          ),
        );
      }
    } catch (e) {
      if (seq === request.current)
        setError(e instanceof Error ? e.message : "Could not load products.");
    } finally {
      if (seq === request.current) setLoading(false);
    }
  }, [organization, db, tab, query]);
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => void load(), 250);
      return () => {
        clearTimeout(timer);
        request.current++;
      };
    }, [load]),
  );
  useEffect(() => {
    setPurchases([]);
    setSaved([]);
    setPrices(new Map());
  }, [organization?.id]);
  const open = async (row: PurchasedProduct) => {
    if (!organization || busy) return;
    setBusy(true);
    try {
      const id = await savePurchaseProduct(db, organization.id, row);
      router.push(`/products/${id}`);
    } catch (e) {
      Alert.alert(
        "Could not save product",
        e instanceof Error ? e.message : "Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (!organization || busy) return;
    if (!query.trim()) {
      Alert.alert(
        "Name your product",
        "Type a name in the search field, then tap Add product.",
      );
      return;
    }
    setBusy(true);
    try {
      const id = await createManualProduct(db, organization.id, query);
      router.push(`/products/${id}`);
    } catch (e) {
      Alert.alert(
        "Could not add product",
        e instanceof Error ? e.message : "Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const next = async () => {
    if (loadingMore || !more) return;
    const seq = request.current;
    setLoadingMore(true);
    try {
      const rows = await searchPurchases(db, query, purchases.length);
      if (seq === request.current) {
        setPurchases((prev) => [
          ...prev,
          ...rows.filter((r) => !prev.some((p) => p.key === r.key)),
        ]);
        setMore(rows.length === 200);
      }
    } catch {
      setError("Could not load more products. Please retry.");
    } finally {
      setLoadingMore(false);
    }
  };
  const data: (
    | { kind: "purchase"; row: PurchasedProduct }
    | { kind: "saved"; row: ProductRecord }
  )[] =
    tab === "purchases"
      ? purchases.map((row) => ({ kind: "purchase", row }))
      : saved
          .filter((p) =>
            p.canonical_name.toLowerCase().includes(query.trim().toLowerCase()),
          )
          .map((row) => ({ kind: "saved", row }));
  return (
    <Screen style={ui.safe} edges={["top", "bottom"]}>
      <View style={ui.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={ui.title}>Products & prices</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          data={loading || error ? [] : data}
          contentContainerStyle={ui.body}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) =>
            item.kind === "purchase" ? item.row.key : item.row.id
          }
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              <Text style={ui.hint}>
                Find what you paid. Build a product list from your saved{" "}
                {organization?.type === "personal" ? "receipts" : "invoices"}.
              </Text>
              <Field
                maxLength={250}
                label="Search items or suppliers"
                value={query}
                onChangeText={setQuery}
                placeholder="Milk, chicken, coffee…"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              <View style={ui.wrap}>
                {(["purchases", "saved"] as const).map((t) => (
                  <Touch
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === t }}
                    style={[ui.chip, tab === t && ui.chipSelected]}
                    key={t}
                    onPress={() => {
                      setLoading(true);
                      setTab(t);
                    }}
                  >
                    <Text style={[ui.label, tab === t && { color: "#fff" }]}>
                      {t === "purchases" ? "Purchased" : "Saved products"}
                    </Text>
                  </Touch>
                ))}
                <Touch
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${metric ? "US" : "metric"} unit prices`}
                  style={ui.chip}
                  onPress={() => setMetric((v) => !v)}
                >
                  <Text style={ui.label}>{metric ? "Metric" : "US units"}</Text>
                </Touch>
              </View>
              {error ? (
                <View style={ui.card}>
                  <Text style={ui.error}>{error}</Text>
                  <Action title="Retry" onPress={() => void load()} />
                </View>
              ) : null}
              {loading ? <Spinner /> : null}
            </View>
          }
          renderItem={({ item }) => {
            const purchased = item.kind === "purchase" ? item.row : null;
            const product = item.kind === "saved" ? item.row : null;
            const source = purchased?.purchase;
            return (
              <Touch
                accessibilityRole="button"
                disabled={busy}
                style={ui.card}
                onPress={() =>
                  product
                    ? router.push(`/products/${product.id}`)
                    : void open(purchased!)
                }
              >
                <Text style={ui.name}>
                  {product?.canonical_name ||
                    source?.clean_name ||
                    source?.raw_description}
                </Text>
                {source && (
                  <Text style={ui.hint}>
                    {source.invoices.vendors?.name || "Supplier"} ·{" "}
                    {source.invoices.invoice_date ||
                      source.invoices.created_at.slice(0, 10)}
                    {!source.invoices.invoice_date ? " (upload date)" : ""}
                    {"\n"}${Number(source.extended_price).toFixed(2)} for{" "}
                    {source.qty} {source.unit_of_measure}
                  </Text>
                )}
                <UnitPrice
                  metric={metric}
                  price={
                    source
                      ? normalizePurchase(source)
                      : (prices.get(product!.id)?.unitCost ?? null)
                  }
                />
                <Text style={ui.label}>
                  {purchased ? "Save & view product" : "View details"} →
                </Text>
              </Touch>
            );
          }}
          ListEmptyComponent={
            !loading && !error ? (
              <View style={ui.card}>
                <Text style={ui.name}>
                  {query
                    ? "No matching products"
                    : "Your product list starts here"}
                </Text>
                <Text style={ui.hint}>
                  Search another name, scan a receipt, or add a product and
                  enter its package size and price.
                </Text>
                <Action
                  secondary
                  title="Scan a receipt"
                  onPress={() => router.push("/scan")}
                />
              </View>
            ) : null
          }
          ListFooterComponent={
            <View style={{ gap: 16 }}>
              {tab === "purchases" && more && (
                <Action
                  title={loadingMore ? "Loading…" : "Load more"}
                  secondary
                  disabled={loadingMore}
                  onPress={() => void next()}
                />
              )}
              <Action
                title={
                  busy
                    ? "Opening…"
                    : query.trim()
                      ? `Add “${query.trim()}”`
                      : "Add product"
                }
                secondary
                disabled={busy}
                onPress={() => void create()}
              />
              <Text style={ui.hint}>
                Unit prices exclude invoice-level tax and shipping. Package
                measurements are kept separately from the original receipt. US
                liquid measures are used for cups and fluid ounces.
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

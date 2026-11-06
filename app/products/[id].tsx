import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import Screen from "../../components/ui/Screen";
import BackButton from "../../components/ui/BackButton";
import Spinner from "../../components/ui/Spinner";
import {
  Action,
  Field,
  Units,
  UnitPrice,
  ui,
} from "../../components/products/ProductUI";
import { useSupabase } from "../../lib/supabase";
import { fetchProduct, updateProduct } from "../../lib/products";
import { normalizePurchase } from "../../shared/measurement";
export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    db = useSupabase(),
    router = useRouter();
  const [data, setData] = useState<Awaited<
      ReturnType<typeof fetchProduct>
    > | null>(null),
    [name, setName] = useState(""),
    [quantity, setQuantity] = useState(""),
    [count, setCount] = useState("1"),
    [unit, setUnit] = useState("g"),
    [price, setPrice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const value = await fetchProduct(db, id);
      setData(value);
      setName(value.product.canonical_name);
      setQuantity(
        value.product.pack_quantity == null
          ? ""
          : String(value.product.pack_quantity),
      );
      setCount(String(value.product.pack_count ?? 1));
      setUnit(value.product.pack_unit ?? "g");
      setPrice(
        value.product.manual_price == null
          ? ""
          : String(value.product.manual_price),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load product.");
    } finally {
      setLoading(false);
    }
  }, [db, id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const save = async () => {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const number = (s: string) => (s.trim() === "" ? null : Number(s));
      await updateProduct(db, data.product.id, {
        canonical_name: name,
        pack_quantity: number(quantity),
        pack_count: number(count),
        pack_unit: quantity.trim() ? unit : null,
        manual_price: data.product.source_line_id ? null : number(price),
      });
      await load();
      setNotice(
        "Product saved. Recipe prices will use the updated measurement.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save product.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen style={ui.safe} edges={["top", "bottom"]}>
      <View style={ui.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={ui.title}>Product details</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={ui.body}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? <Spinner /> : null}
          {error ? (
            <Text accessibilityRole="alert" style={ui.error}>
              {error}
            </Text>
          ) : null}
          {!data && !loading ? (
            <Action title="Retry" onPress={() => void load()} />
          ) : null}
          {data && (
            <>
              <View style={ui.card}>
                <Text style={ui.name}>{data.product.canonical_name}</Text>
                <UnitPrice price={data.pricing.unitCost} />
                {data.pricing.isManual ? (
                  <Text style={ui.hint}>
                    Manual estimate · not a recorded purchase
                  </Text>
                ) : (
                  <Text style={ui.hint}>
                    {data.pricing.sampleSize} usable purchase
                    {data.pricing.sampleSize === 1 ? "" : "s"} · latest three
                    with compatible units, weighted by quantity
                  </Text>
                )}
              </View>
              <View style={ui.card}>
                <Text style={ui.name}>Package & pricing</Text>
                <Field
                  label="Product name"
                  value={name}
                  onChangeText={setName}
                />
                <Text style={ui.hint}>
                  Confirm what one billed purchase unit contains. For a case of
                  12 × 16 oz, enter size 16 oz and pack count 12. Leave size
                  blank to use clear printed measurements.
                </Text>
                <Field
                  label="Size of each inner package"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholder="Not yet confirmed"
                />
                <Units value={unit} onChange={setUnit} />
                <Field
                  label="Packages per billed purchase unit"
                  value={count}
                  onChangeText={setCount}
                  keyboardType="decimal-pad"
                />
                {!data.product.source_line_id && (
                  <Field
                    label="Price per billed purchase unit ($, estimate)"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="Not yet entered"
                  />
                )}
                <Text style={ui.hint}>
                  A confirmed size applies to the selected source purchase only.
                  It never changes your invoice or assumes older packages had
                  the same size. Weight and liquid volume are never
                  interchanged.
                </Text>
                <Action
                  title={busy ? "Saving…" : "Save product"}
                  disabled={busy}
                  onPress={() => void save()}
                />
                {notice ? (
                  <Text accessibilityLiveRegion="polite" style={ui.label}>
                    {notice}
                  </Text>
                ) : null}
              </View>
              <Text style={ui.name}>Source purchases</Text>
              {data.observations.length === 0 ? (
                <Text style={ui.hint}>
                  No linked purchases. Enter a package size and manual price
                  above to use this product in a recipe estimate.
                </Text>
              ) : (
                data.observations.map((row) => (
                  <View key={row.id} style={ui.card}>
                    <Text style={ui.name}>
                      {row.invoices.vendors?.name || "Supplier"}
                    </Text>
                    <Text style={ui.hint}>
                      {row.invoices.invoice_date ||
                        row.invoices.created_at.slice(0, 10)}
                      {!row.invoices.invoice_date ? " · upload date" : ""}
                      {"\n"}
                      {row.raw_description}
                      {"\n"}${Number(row.extended_price).toFixed(2)} for{" "}
                      {row.qty} {row.unit_of_measure}
                    </Text>
                    <UnitPrice price={normalizePurchase(row, data.product)} />
                    <Action
                      title="View original invoice"
                      secondary
                      onPress={() => router.push(`/invoice/${row.invoices.id}`)}
                    />
                  </View>
                ))
              )}
              <Text style={ui.hint}>
                Costs exclude invoice-level tax, freight and other overhead.
                Check package sizes against the supplier label before using them
                for recipe or purchase decisions.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

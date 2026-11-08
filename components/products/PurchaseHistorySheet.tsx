import { useEffect, useRef, useState } from "react";
import { FlatList, Modal, StyleSheet, Text, View } from "react-native";
import Screen from "../ui/Screen";
import Touch from "../ui/MotionTouchable";
import Spinner from "../ui/Spinner";
import { useReducedMotion } from "react-native-reanimated";
import { Colors } from "../../constants/Colors";
import { purchaseHistory, type PurchasedProduct } from "../../lib/products";
import { useSupabase } from "../../lib/supabase";
import type { PurchaseObservation } from "../../shared/measurement";
import { useRouter } from "expo-router";
import { useWorkspace } from "../../lib/workspaceContext";
export const displayPurchaseDate = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Date not recorded";
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date not recorded";
};
export default function PurchaseHistorySheet({
  product,
  onClose,
  demoRows,
}: {
  product: PurchasedProduct | null;
  onClose: () => void;
  demoRows?: PurchaseObservation[];
}) {
  const db = useSupabase(),
    router = useRouter(),
    reduced = useReducedMotion();
  const { isPersonal } = useWorkspace();
  const [rows, setRows] = useState<PurchaseObservation[]>([]),
    [loading, setLoading] = useState(false),
    [more, setMore] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0),
    busy = useRef(false),
    offset = useRef(0);
  useEffect(() => {
    const id = ++sequence.current;
    setRows([]);
    setError("");
    offset.current = 0;
    busy.current = false;
    setMore(false);
    if (!product) return;
    if (demoRows) {
      setRows(demoRows);
      return;
    }
    busy.current = true;
    setLoading(true);
    void purchaseHistory(db, product.key)
      .then((data) => {
        if (sequence.current === id) {
          setRows(data);
          offset.current = data.length;
          setMore(data.length === 100);
        }
      })
      .catch(() => {
        if (sequence.current === id)
          setError("Could not load purchase history. Close and retry.");
      })
      .finally(() => {
        if (sequence.current === id) {
          busy.current = false;
          setLoading(false);
        }
      });
    return () => {
      sequence.current = id + 1;
    };
  }, [product, db, demoRows]);
  const next = async () => {
    if (!product || busy.current || !more) return;
    const id = sequence.current;
    busy.current = true;
    setLoading(true);
    try {
      const data = await purchaseHistory(db, product.key, offset.current);
      if (sequence.current === id) {
        offset.current += data.length;
        setRows((old) => [
          ...old,
          ...data.filter((r) => !old.some((o) => o.id === r.id)),
        ]);
        setMore(data.length === 100);
        setError("");
      }
    } catch {
      if (sequence.current === id)
        setError("Could not load more orders. Tap Retry below.");
    } finally {
      if (sequence.current === id) {
        busy.current = false;
        setLoading(false);
      }
    }
  };
  return (
    <Modal
      visible={!!product}
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <Screen edges={["top", "bottom"]} style={s.screen}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>
              {product?.purchase.clean_name ||
                product?.purchase.raw_description}
            </Text>
            <Text style={s.note}>
              Recorded purchases · same supplier and product
            </Text>
          </View>
          <Touch
            onPress={onClose}
            accessibilityLabel="Close purchase history"
            style={s.close}
          >
            <Text style={s.closeText}>Done</Text>
          </Touch>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={s.list}
          onEndReached={() => void next()}
          onEndReachedThreshold={0.4}
          renderItem={({ item: r }) => (
            <Touch
              style={s.row}
              accessibilityLabel={`Open purchase dated ${r.invoices.invoice_date ?? "date not recorded"}`}
              onPress={() => {
                onClose();
                router.push(`/invoice/${r.invoices.id}`);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.date}>
                  {displayPurchaseDate(r.invoices.invoice_date)}
                </Text>
                <Text style={s.note}>
                  {r.qty ?? "—"} {r.unit_of_measure ?? "units"} ·{" "}
                  {r.invoices.vendors?.name ?? (isPersonal ? "Store" : "Supplier")}
                </Text>
                {!r.invoices.invoice_date && (
                  <Text style={s.note}>
                    Upload date is not used to predict buying timing.
                  </Text>
                )}
              </View>
              <Text style={s.total}>
                {Number.isFinite(Number(r.extended_price))
                  ? Number(r.extended_price).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })
                  : "—"}{" "}
                ›
              </Text>
            </Touch>
          )}
          ListEmptyComponent={
            !loading ? (
              <Text style={s.note}>
                No saved purchase history is available.
              </Text>
            ) : null
          }
          ListFooterComponent={
            <View style={{ gap: 12 }}>
              {loading && <Spinner />}
              {!!error && (
                <Text accessibilityRole="alert" style={s.note}>
                  {error}
                </Text>
              )}
              {!!error && more && (
                <Touch style={s.close} onPress={() => void next()}>
                  <Text style={s.closeText}>Retry</Text>
                </Touch>
              )}
            </View>
          }
        />
      </Screen>
    </Modal>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, flexDirection: "row", gap: 12, alignItems: "center" },
  title: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 22,
    color: Colors.textPrimary,
  },
  note: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  close: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    color: Colors.primary,
  },
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  row: {
    minHeight: 64,
    padding: 16,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  date: {
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
  },
  total: {
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    color: Colors.textPrimary,
  },
});

import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSupabase } from "../../lib/supabase";
import { useStore } from "../../store/useStore";
import { useWorkspace } from "../../lib/workspaceContext";
import {
  productGroupAliases,
  type ProductGroup,
} from "../../lib/productGroups";
import {
  searchProductGroups,
  fetchProductGroupingHistory,
  linkProductGroups,
  undoProductGrouping,
  type ProductGroupingAction,
} from "../../lib/products";
import Screen from "../ui/Screen";
import BackButton from "../ui/BackButton";
import Touch from "../ui/MotionTouchable";
import Spinner from "../ui/Spinner";
import Toast from "../ui/Toast";
import { Action, Field, ui } from "./ProductUI";

export default function ProductGroupingSheet({
  source,
  historyOpen,
  onClose,
  onChanged,
}: {
  source: ProductGroup | null;
  historyOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const db = useSupabase(),
    reduced = useReducedMotion();
  const { organization } = useWorkspace();
  const open = !!source || historyOpen;
  const sequence = useRef(0),
    offset = useRef(0),
    busyRef = useRef(false);
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState<ProductGroup[]>([]),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<ProductGroup | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [reload, setReload] = useState(0);
  const [actions, setActions] = useState<ProductGroupingAction[]>([]),
    [latestId, setLatestId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRows([]);
    setSelected(null);
    setConfirmed(false);
    setError("");
    setActions([]);
    setLatestId(null);
  }, [open, source?.key]);
  useEffect(() => {
    if (!open) return;
    const seq = ++sequence.current,
      scope = useStore.getState().activeScope;
    setLoading(true);
    setError("");
    const timer = setTimeout(
      () => {
        void (async () => {
          try {
            if (source) {
              const groups = await searchProductGroups(db, query);
              if (
                seq !== sequence.current ||
                scope !== useStore.getState().activeScope
              )
                return;
              offset.current = groups.length;
              setRows(groups.filter((g) => g.key !== source.key));
              setMore(groups.length === 200);
            } else {
              const history = await fetchProductGroupingHistory(db);
              if (
                seq !== sequence.current ||
                scope !== useStore.getState().activeScope
              )
                return;
              setActions(history.actions);
              setLatestId(history.latestId);
            }
          } catch (e) {
            if (
              seq === sequence.current &&
              scope === useStore.getState().activeScope
            )
              setError((e as Error).message);
          } finally {
            if (
              seq === sequence.current &&
              scope === useStore.getState().activeScope
            )
              setLoading(false);
          }
        })();
      },
      source ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      sequence.current = seq + 1;
    };
  }, [open, source, query, db, organization?.id, reload]);
  const next = async () => {
    if (loading || !more || !source) return;
    const seq = sequence.current,
      scope = useStore.getState().activeScope;
    setLoading(true);
    setError("");
    try {
      const groups = await searchProductGroups(db, query, offset.current);
      if (seq !== sequence.current || scope !== useStore.getState().activeScope)
        return;
      offset.current += groups.length;
      setRows((old) => [
        ...old,
        ...groups.filter(
          (g) => g.key !== source.key && !old.some((o) => o.key === g.key),
        ),
      ]);
      setMore(groups.length === 200);
    } catch (e) {
      if (seq === sequence.current) setError((e as Error).message);
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  };
  const save = async () => {
    if (!source || !selected || !confirmed || busyRef.current) return;
    const scope = useStore.getState().activeScope;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (useStore.getState().demoMode)
        throw new Error("Exit the demo before linking product names.");
      await linkProductGroups(db, source, selected);
      if (scope !== useStore.getState().activeScope) return;
      onChanged();
      onClose();
      useStore
        .getState()
        .showToast("Products linked. Undo from Grouping history.");
    } catch (e) {
      if (scope === useStore.getState().activeScope)
        setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const undo = async (id: string) => {
    if (busyRef.current) return;
    const scope = useStore.getState().activeScope;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (useStore.getState().demoMode)
        throw new Error("Exit the demo before changing product groups.");
      await undoProductGrouping(db, id);
      if (scope !== useStore.getState().activeScope) return;
      onChanged();
      setReload((n) => n + 1);
      useStore.getState().showToast("Previous product groups restored.");
    } catch (e) {
      if (scope === useStore.getState().activeScope)
        setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const errors = !!error && (
    <View style={ui.card}>
      <Text accessibilityRole="alert" style={ui.error}>
        {error}
      </Text>
      <Action
        secondary
        title={source && selected ? "Refresh product list" : "Retry"}
        disabled={busy}
        onPress={() => {
          if (source && selected) {
            onChanged();
            onClose();
          } else setReload((n) => n + 1);
        }}
      />
    </View>
  );
  const summary = (group: ProductGroup, label: string) => (
    <View style={ui.card}>
      <Text style={ui.label}>{label}</Text>
      <Text style={ui.name}>{group.name}</Text>
      <Text style={ui.hint}>
        {group.variants.length} supplier/package option
        {group.variants.length === 1 ? "" : "s"}
      </Text>
      <Text style={ui.hint}>
        Names: {productGroupAliases(group).join(" · ")}
      </Text>
    </View>
  );
  return (
    <Modal
      visible={open}
      presentationStyle="pageSheet"
      allowSwipeDismissal={false}
      animationType={reduced ? "none" : "slide"}
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <Screen style={ui.safe} edges={["top", "bottom"]}>
        <View style={ui.header}>
          <BackButton
            disabled={busy}
            onPress={() => {
              if (!busy) onClose();
            }}
          />
          <Text style={[ui.title, { flex: 1, flexShrink: 1 }]}>
            {source ? "Link product names" : "Grouping history"}
          </Text>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {source ? (
            selected ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={ui.body}
              >
                <Text style={ui.hint}>
                  Review the match before linking. Both sets of names will
                  appear under “{selected.name}”.
                </Text>
                {summary(source, "Link from")}
                {summary(selected, "Display under")}
                <Text style={ui.hint}>
                  This also applies to future purchases with these same names.
                  Supplier prices, packages, invoice records, recipe references
                  and Smart Sift patterns stay separate. Keep different
                  varieties and preparation methods separate unless you intend
                  to group them.
                </Text>
                <Touch
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: confirmed }}
                  accessibilityLabel="I confirm these names refer to the same product"
                  onPress={() => setConfirmed((v) => !v)}
                  style={[
                    ui.card,
                    { minHeight: 48, flexDirection: "row", gap: 12 },
                  ]}
                >
                  <Text style={ui.label}>{confirmed ? "✓" : "○"}</Text>
                  <Text style={[ui.label, { flex: 1 }]}>
                    These names refer to the same product
                  </Text>
                </Touch>
                {errors}
                <Action
                  title={busy ? "Linking…" : "Confirm link"}
                  disabled={busy || !confirmed}
                  onPress={() => void save()}
                />
                <Action
                  secondary
                  title="Choose a different product"
                  disabled={busy}
                  onPress={() => {
                    setSelected(null);
                    setConfirmed(false);
                    setError("");
                  }}
                />
              </ScrollView>
            ) : (
              <FlatList
                data={rows}
                keyExtractor={(g) => g.key}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={ui.body}
                ListHeaderComponent={
                  <View style={{ gap: 16 }}>
                    {summary(source, "Link from")}
                    <Text style={ui.hint}>
                      Choose the same item listed under another name. You’ll
                      review both names before anything changes.
                    </Text>
                    <Field
                      label="Search product names or suppliers"
                      maxLength={250}
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Find the matching product…"
                      autoCorrect={false}
                    />
                    {errors}
                    {loading && <Spinner />}
                  </View>
                }
                renderItem={({ item }) => (
                  <Touch
                    accessibilityRole="button"
                    accessibilityLabel={`Review linking ${source.name} with ${item.name}`}
                    style={[ui.card, { minHeight: 60 }]}
                    onPress={() => {
                      setSelected(item);
                      setConfirmed(false);
                      setError("");
                    }}
                  >
                    <Text style={ui.name}>{item.name}</Text>
                    <Text style={ui.hint}>
                      {item.variants.length} supplier/package option
                      {item.variants.length === 1 ? "" : "s"} ·{" "}
                      {productGroupAliases(item).join(" · ")}
                    </Text>
                    <Text style={ui.label}>Review match →</Text>
                  </Touch>
                )}
                ListEmptyComponent={
                  !loading && !error ? (
                    <Text style={ui.hint}>
                      {query
                        ? "No matches. Try a different name or supplier."
                        : "No other products are available to link yet."}
                    </Text>
                  ) : null
                }
                ListFooterComponent={
                  more ? (
                    <Action
                      secondary
                      title={loading ? "Loading…" : "Load more products"}
                      disabled={loading}
                      onPress={() => void next()}
                    />
                  ) : null
                }
              />
            )
          ) : (
            <ScrollView contentContainerStyle={ui.body}>
              <Text style={ui.hint}>
                Your team’s confirmed product-name links. Undo restores the
                previous groups, including earlier links. Purchases and prices
                stay unchanged.
              </Text>
              <Text style={ui.hint}>
                Undo the latest active link first so newer grouping decisions
                are preserved.
              </Text>
              {errors}
              {loading && <Spinner />}
              {!loading && !actions.length && !error && (
                <Text style={ui.name}>No confirmed links yet</Text>
              )}
              {actions.map((action) => (
                <View key={action.id} style={ui.card}>
                  {action.id === latestId && !action.undone_at && (
                    <Text style={ui.hint}>Latest active link</Text>
                  )}
                  <Text style={ui.label}>
                    {action.source_name} → {action.target_name}
                  </Text>
                  <Text style={ui.hint}>
                    {new Date(action.created_at).toLocaleString()} ·{" "}
                    {action.undone_at ? "Undone" : "Linked"}
                  </Text>
                  {action.id === latestId && !action.undone_at && (
                    <Action
                      secondary
                      title={busy ? "Restoring…" : "Undo this link"}
                      disabled={busy || loading}
                      onPress={() => void undo(action.id)}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
        <Toast />
      </Screen>
    </Modal>
  );
}

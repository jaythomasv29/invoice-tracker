import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";
import {
  summarizeSpend,
  type SpendInvoice,
  type SummaryPeriod,
} from "../../lib/spendSummary";
const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export default function SpendOverviewCard({
  invoices,
  vendors,
  loading,
}: {
  invoices: SpendInvoice[];
  vendors: { id: string; name: string }[];
  loading: boolean;
}) {
  const [period, setPeriod] = useState<SummaryPeriod>("month");
  const [offset, setOffset] = useState(0);
  const data = summarizeSpend(invoices, period, offset);
  const date = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const label =
    period === "month"
      ? data.start.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : period === "day"
        ? date(data.start)
        : `${date(data.start)} – ${date(data.end)}`;
  return (
    <View style={s.card}>
      <Text style={s.heading}>Your spending</Text>
      <Text style={s.note}>Saved invoices · grouped by invoice date</Text>
      <View style={s.tabs}>
        {(["day", "week", "month"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            accessibilityRole="button"
            accessibilityState={{ selected: p === period }}
            onPress={() => {
              setPeriod(p);
              setOffset(0);
            }}
            style={[s.tab, p === period && s.selected]}
          >
            <Text style={[s.tabText, p === period && s.selectedText]}>
              {p === "day" ? "Daily" : p === "week" ? "Weekly" : "Monthly"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.navigation}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Previous ${period}`}
          onPress={() => setOffset((x) => x - 1)}
          style={s.arrow}
        >
          <Text style={s.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.date}>{label}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Next ${period}`}
          accessibilityState={{ disabled: offset === 0 }}
          disabled={offset === 0}
          onPress={() => setOffset((x) => Math.min(0, x + 1))}
          style={[s.arrow, offset === 0 && { opacity: 0.25 }]}
        >
          <Text style={s.arrowText}>›</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.amount} accessibilityLiveRegion="polite">
        {loading ? "Loading…" : money(data.total)}
      </Text>
      <Text style={s.count}>
        {data.count} {data.count === 1 ? "invoice" : "invoices"} ·{" "}
        {data.vendors.length} {data.vendors.length === 1 ? "vendor" : "vendors"}
      </Text>
      {data.vendors.slice(0, 3).map(([id, total]) => (
        <View key={id} style={s.row}>
          <Text style={s.vendor} numberOfLines={1}>
            {vendors.find((v) => v.id === id)?.name ?? "Unknown vendor"}
          </Text>
          <Text style={s.vendorAmount}>{money(total)}</Text>
        </View>
      ))}
      {!loading && data.count === 0 && (
        <Text style={s.note}>
          No saved invoices dated in this period. Use the arrows to see older
          invoices.
        </Text>
      )}
      {data.fallbackCount > 0 && (
        <Text style={s.note}>
          {data.fallbackCount}{" "}
          {data.fallbackCount === 1 ? "invoice uses" : "invoices use"} upload
          date because its invoice date is missing. Correct the date in invoice
          review.
        </Text>
      )}
      <Text style={s.footer}>
        {data.allCount} saved overall · {money(data.allTotal)} all-time
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heading: {
    fontFamily: "Manrope_700Bold",
    fontSize: 21,
    color: Colors.textPrimary,
  },
  note: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  selected: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
  },
  tabText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  selectedText: { color: Colors.textPrimary },
  navigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontSize: 32, color: Colors.textPrimary },
  date: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  amount: {
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 36,
    color: Colors.textPrimary,
  },
  count: {
    fontFamily: "Manrope_500Medium",
    fontSize: 15,
    color: Colors.textSecondary,
  },
  row: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  vendor: {
    flex: 1,
    fontFamily: "Manrope_500Medium",
    fontSize: 15,
    color: Colors.textPrimary,
  },
  vendorAmount: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    color: Colors.textPrimary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
});

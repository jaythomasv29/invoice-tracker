import { useState } from "react";
import { View, Text } from "react-native";
import { type ProductGroup } from "../../lib/productGroups";
import { type PurchasedProduct } from "../../lib/products";
import { normalizePurchase } from "../../shared/measurement";
import { displayPurchaseDate } from "./PurchaseHistorySheet";
import Touch from "../ui/MotionTouchable";
import { UnitPrice, ui } from "./ProductUI";
export default function ProductGroupCard({
  group,
  metric,
  busy,
  onOpen,
  onLink,
}: {
  group: ProductGroup;
  metric: boolean;
  busy: boolean;
  onOpen: (option: PurchasedProduct) => void;
  onLink?: (group: ProductGroup) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const suppliers = new Set(
    group.variants.map((v) => v.purchase.invoices.vendor_id),
  ).size;
  return (
    <View style={[ui.card, { gap: 12 }]}>
      <Touch
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${group.name}. ${suppliers} supplier${suppliers === 1 ? "" : "s"}. ${group.variants.length} supplier option${group.variants.length === 1 ? "" : "s"}. ${expanded ? "Collapse" : "Compare options"}`}
        style={{ minHeight: 48, justifyContent: "center", gap: 6 }}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={ui.name}>{group.name}</Text>
        <Text style={ui.hint}>
          {suppliers} supplier{suppliers === 1 ? "" : "s"} ·{" "}
          {group.variants.reduce((n, v) => n + v.count, 0)} purchase records
        </Text>
        <Text style={ui.label}>
          {expanded ? "Hide options −" : "Compare supplier options +"}
        </Text>
      </Touch>
      {expanded && (
        <>
          <Text style={ui.hint}>
            Each option keeps its own package, price and purchase history.
            Compare matching unit prices before choosing.
          </Text>
          {onLink && (
            <Touch
              accessibilityRole="button"
              accessibilityLabel={`Link ${group.name} with another product name`}
              disabled={busy}
              style={{ minHeight: 44, justifyContent: "center" }}
              onPress={() => onLink(group)}
            >
              <Text style={ui.label}>Link with another product name →</Text>
            </Touch>
          )}
          {group.key.startsWith("linked:") && (
            <Text style={ui.hint}>
              Names linked by your team. You can restore previous groups from
              Grouping history.
            </Text>
          )}
          {group.variants.map((option) => {
            const p = option.purchase;
            return (
              <View key={option.key} style={{ gap: 8, paddingTop: 12 }}>
                <Text style={ui.label}>
                  {p.invoices.vendors?.name || "Unknown supplier"}
                </Text>
                <Text style={ui.hint}>
                  {p.clean_name || p.raw_description}
                  {p.clean_name && p.clean_name !== p.raw_description
                    ? `\nInvoice label: ${p.raw_description}`
                    : ""}
                  {"\n"}Last purchased{" "}
                  {displayPurchaseDate(p.invoices.invoice_date)}
                  {!p.invoices.invoice_date ? " · purchase date missing" : ""}
                  {"\n"}${Number(p.extended_price ?? 0).toFixed(2)} for {p.qty}{" "}
                  {p.unit_of_measure}
                </Text>
                <UnitPrice metric={metric} price={normalizePurchase(p)} />
                <Touch
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Save supplier option for ${group.name} from ${p.invoices.vendors?.name || "unknown supplier"}`}
                  onPress={() => onOpen(option)}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={ui.label}>
                    {busy ? "Opening…" : "Save option & view details →"}
                  </Text>
                </Touch>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

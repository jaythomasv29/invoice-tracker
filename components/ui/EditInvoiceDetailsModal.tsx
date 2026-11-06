import { useReducedMotion } from "react-native-reanimated";
import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Colors } from "../../constants/Colors";
import {
  type InvoiceDetails,
  validateInvoiceDetails,
} from "../../lib/invoiceDetails";
import Touch from "./MotionTouchable";
import Spinner from "./Spinner";

export default function EditInvoiceDetailsModal({
  invoice,
  onClose,
  onSave,
}: {
  invoice: InvoiceDetails | null;
  onClose: () => void;
  onSave: (details: InvoiceDetails) => Promise<void>;
}) {
  const reducedMotion = useReducedMotion();
  const [vendor, setVendor] = useState(""),
    [number, setNumber] = useState(""),
    [date, setDate] = useState("");
  const [subtotal, setSubtotal] = useState(""),
    [tax, setTax] = useState(""),
    [total, setTotal] = useState("");
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!invoice) return;
    setVendor(invoice.vendorName);
    setNumber(invoice.invoiceNumber);
    setDate(invoice.dateIso ?? "");
    setSubtotal(invoice.subtotal.toFixed(2));
    setTax(invoice.tax.toFixed(2));
    setTotal(invoice.total.toFixed(2));
    setError("");
  }, [invoice]);
  const save = async () => {
    const details = {
      vendorName: vendor.trim().replace(/\s+/g, " "),
      invoiceNumber: number.trim(),
      dateIso: date.trim() || null,
      subtotal: subtotal.trim() ? Number(subtotal) : NaN,
      tax: tax.trim() ? Number(tax) : NaN,
      total: total.trim() ? Number(total) : NaN,
    };
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const problem = validateInvoiceDetails(details, today);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...details,
        subtotal: Number(details.subtotal.toFixed(2)),
        tax: Number(details.tax.toFixed(2)),
        total: Number(details.total.toFixed(2)),
      });
      onClose();
    } catch (e) {
      setError((e as Error).message || "Could not save details. Please retry.");
    } finally {
      setSaving(false);
    }
  };
  if (!invoice) return null;
  const fields = [
    ["Vendor / store", vendor, setVendor, false],
    ["Invoice / receipt number", number, setNumber, false],
    ["Purchase date · YYYY-MM-DD", date, setDate, false],
    ["Subtotal", subtotal, setSubtotal, true],
    ["Tax", tax, setTax, true],
    ["Total printed on invoice", total, setTotal, true],
  ] as const;
  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={s.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.card} accessibilityViewIsModal>
          <Text style={s.title} accessibilityRole="header">
            Edit invoice details
          </Text>
          <Text style={s.help}>
            Correct the details against your original. Changing the vendor
            applies to this invoice only.
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.fields}
          >
            {fields.map(([label, value, setValue, money]) => (
              <View key={label} style={s.field}>
                <Text style={s.label}>{label}</Text>
                <TextInput
                  accessibilityLabel={label}
                  value={value}
                  onChangeText={setValue}
                  editable={!saving}
                  style={s.input}
                  keyboardType={money ? "decimal-pad" : "default"}
                  autoCapitalize={
                    money || label.startsWith("Purchase") ? "none" : "words"
                  }
                  placeholder={
                    label.startsWith("Purchase")
                      ? "Leave empty if unknown"
                      : undefined
                  }
                  maxLength={200}
                />
              </View>
            ))}
            <Text style={s.help}>
              Printed totals may include discounts or fees. Editing totals does
              not change individual line items.
            </Text>
            {!!error && (
              <Text
                style={s.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            )}
          </ScrollView>
          <View style={s.actions}>
            <Touch
              accessibilityRole="button"
              disabled={saving}
              onPress={onClose}
              style={s.cancel}
            >
              <Text style={s.label}>Cancel</Text>
            </Touch>
            <Touch
              accessibilityRole="button"
              accessibilityLabel="Save invoice details"
              disabled={saving}
              onPress={() => void save()}
              style={[s.save, saving && { opacity: 0.6 }]}
            >
              {saving ? (
                <Spinner color={Colors.surface} size={18} />
              ) : (
                <Text style={s.saveText}>Save details</Text>
              )}
            </Touch>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    maxHeight: "92%",
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: "Manrope_800ExtraBold",
    color: Colors.textPrimary,
  },
  help: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
  fields: { gap: 14, paddingBottom: 8 },
  field: { gap: 6 },
  label: {
    fontSize: 14,
    fontFamily: "Manrope_600SemiBold",
    color: Colors.textPrimary,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  actions: { flexDirection: "row", gap: 12 },
  cancel: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12 },
  save: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 15,
    fontFamily: "Manrope_700Bold",
    color: Colors.surface,
  },
  error: { fontSize: 14, color: Colors.danger },
});

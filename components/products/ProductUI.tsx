import {
  Text,
  TextInput,
  View,
  StyleSheet,
  type TextInputProps,
} from "react-native";
import Touch from "../ui/MotionTouchable";
import { Colors } from "../../constants/Colors";
import {
  displayUnitCost,
  type NormalizedPurchase,
} from "../../shared/measurement";
export const UNITS = [
  "g",
  "kg",
  "oz",
  "lb",
  "mL",
  "L",
  "US fl oz",
  "US cup",
  "each",
];
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8, flex: 1 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={Colors.textSecondary}
        style={[ui.input, props.style]}
      />
    </View>
  );
}
export function Action({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Touch
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        ui.action,
        secondary && ui.secondary,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[ui.actionText, secondary && { color: Colors.primaryDark }]}>
        {title}
      </Text>
    </Touch>
  );
}
export function Units({
  value,
  onChange,
}: {
  value: string;
  onChange: (u: string) => void;
}) {
  return (
    <View style={ui.wrap}>
      {UNITS.map((unit) => (
        <Touch
          key={unit}
          accessibilityRole="button"
          accessibilityState={{ selected: value === unit }}
          style={[ui.chip, value === unit && ui.chipSelected]}
          onPress={() => onChange(unit)}
        >
          <Text style={[ui.label, value === unit && { color: Colors.surface }]}>
            {unit}
          </Text>
        </Touch>
      ))}
    </View>
  );
}
export function UnitPrice({
  price,
  metric = false,
}: {
  price: NormalizedPurchase | null;
  metric?: boolean;
}) {
  if (!price)
    return (
      <Text style={ui.hint}>
        Add a confirmed package size for unit pricing.
      </Text>
    );
  const display = displayUnitCost(price, metric ? "metric" : "us");
  return (
    <View style={{ gap: 4 }}>
      <Text style={ui.price}>
        ${display.value.toFixed(3)}
        <Text style={ui.priceUnit}> / {display.unit}</Text>
      </Text>
      <Text style={ui.hint}>
        {price.basis}
        {price.net ? " · after discounts" : ""}
      </Text>
    </View>
  );
}
export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20 },
  title: {
    fontSize: 24,
    fontFamily: "Manrope_800ExtraBold",
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  body: {
    padding: 20,
    paddingTop: 8,
    gap: 16,
    paddingBottom: 48,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  card: {
    padding: 20,
    gap: 12,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: {
    fontSize: 17,
    fontFamily: "Manrope_700Bold",
    color: Colors.textPrimary,
  },
  label: {
    fontSize: 13,
    fontFamily: "Manrope_700Bold",
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: 13,
    fontFamily: "Manrope_500Medium",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.textTertiary,
    borderRadius: 14,
    padding: 12,
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  price: {
    fontSize: 26,
    fontFamily: "Manrope_800ExtraBold",
    color: Colors.primaryDark,
    fontVariant: ["tabular-nums"],
  },
  priceUnit: { fontSize: 14, fontFamily: "Manrope_600SemiBold" },
  action: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  secondary: { backgroundColor: Colors.primaryLight },
  actionText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    color: Colors.surface,
    textAlign: "center",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  error: {
    color: Colors.danger,
    fontFamily: "Manrope_600SemiBold",
    lineHeight: 21,
  },
});

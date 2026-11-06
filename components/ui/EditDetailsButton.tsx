import Svg, { Path } from "react-native-svg";
import { View, Text, StyleSheet } from "react-native";
import Touch from "./MotionTouchable";
import { Colors } from "../../constants/Colors";
export default function EditDetailsButton({
  name,
  subtitle,
  onPress,
}: {
  name: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Touch
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit invoice details for ${name}`}
      accessibilityHint="Change vendor, purchase date, invoice number and totals"
      style={s.button}
    >
      <View style={s.copy}>
        <View style={s.row}>
          <Text style={s.name}>{name}</Text>
          <Svg
            accessible={false}
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={Colors.primaryDark}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="m15 4 5 5M4 20l4-1L21 6a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" />
          </Svg>
        </View>
        <Text style={s.subtitle}>{subtitle} · Edit details</Text>
      </View>
    </Touch>
  );
}
const s = StyleSheet.create({
  button: { flex: 1, minHeight: 48, justifyContent: "center" },
  copy: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontFamily: "Manrope_700Bold",
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Manrope_600SemiBold",
    color: Colors.textSecondary,
  },
});

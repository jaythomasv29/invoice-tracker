import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";
import Touch from "./MotionTouchable";
export default function LoadFailure({
  message,
  onRetry,
  hasData = false,
}: {
  message: string;
  onRetry: () => void;
  hasData?: boolean;
}) {
  return (
    <View style={s.card}>
      <Text style={s.title} accessibilityRole="alert">
        {message}
      </Text>
      <Text style={s.body}>
        {hasData
          ? "Showing your last loaded data. It may be out of date."
          : "Your records have not been removed. Check your connection and try again."}
      </Text>
      <Touch accessibilityRole="button" onPress={onRetry} style={s.retry}>
        <Text style={s.link}>Try again</Text>
      </Touch>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 16,
    gap: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 15,
    fontFamily: "Manrope_700Bold",
    color: Colors.textPrimary,
  },
  body: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary },
  retry: { minHeight: 44, justifyContent: "center" },
  link: {
    fontSize: 14,
    fontFamily: "Manrope_700Bold",
    color: Colors.primaryDark,
  },
});

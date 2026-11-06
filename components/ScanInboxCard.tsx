import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../constants/Colors";
import { useScanQueue } from "./ScanQueueProvider";
import Touch from "./ui/MotionTouchable";
export default function ScanInboxCard() {
  const { tasks, error } = useScanQueue();
  const router = useRouter();
  if (!tasks.length && !error) return null;
  const ready = tasks.filter((t) => t.phase === "ready").length,
    working = tasks.filter((t) => t.phase === "processing").length;
  return (
    <Touch
      accessibilityRole="button"
      accessibilityLabel={`Scan inbox. ${ready} ready to review, ${working} processing, ${tasks.length - ready - working} need attention`}
      onPress={() => router.push("/scan/activity")}
      style={s.card}
    >
      <View style={s.row}>
        <Text style={s.title}>Scan inbox</Text>
        <Text style={s.link}>
          {error && !tasks.length ? "Check status" : `View ${tasks.length}`} →
        </Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={s.body}>
        {error
          ? error
          : ready
            ? `${ready} ready to review`
            : working
              ? "Smart Sift is reading your scan"
              : "A scan needs your attention"}
        {ready && working ? ` · ${working} processing` : ""}
      </Text>
      {working > 0 && (
        <Text style={s.note}>
          You can keep using Sift. Return here when it’s ready.
        </Text>
      )}
    </Touch>
  );
}
const s = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 16,
    gap: 6,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    minHeight: 76,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  title: {
    fontSize: 15,
    fontFamily: "Manrope_800ExtraBold",
    color: Colors.primaryDark,
  },
  link: {
    fontSize: 13,
    fontFamily: "Manrope_700Bold",
    color: Colors.primaryDark,
  },
  body: { fontSize: 14, color: Colors.textPrimary },
  note: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
});

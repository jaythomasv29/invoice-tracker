import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../components/ui/Screen";
import BackButton from "../../components/ui/BackButton";
import Touch from "../../components/ui/MotionTouchable";
import Spinner from "../../components/ui/Spinner";
import Toast from "../../components/ui/Toast";
import { Colors } from "../../constants/Colors";
import {
  useScanQueue,
  type ScanTask,
} from "../../components/ScanQueueProvider";
import { useSupabase } from "../../lib/supabase";
import { useWorkspace } from "../../lib/workspaceContext";
import {
  fetchInvoiceById,
  fetchInvoiceImageUrls,
} from "../../lib/invoicePipeline";
import { ensureAiConsent } from "../../lib/aiConsent";
import { useStore } from "../../store/useStore";
export default function ScanActivityScreen() {
  const { tasks, start, refresh, error } = useScanQueue();
  const router = useRouter();
  const db = useSupabase();
  const { organization } = useWorkspace();
  const [opening, setOpening] = useState<string | null>(null);
  const open = async (task: ScanTask) => {
    if (!organization || opening) return;
    setOpening(task.id);
    const scope = useStore.getState().activeScope;
    try {
      const invoice = await fetchInvoiceById(db, organization.id, task.id);
      if (invoice.status === "saved") {
        router.push(`/invoice/${invoice.id}`);
        return;
      }
      if (invoice.status !== "scanned") {
        await refresh();
        return;
      }
      const imageUris = await fetchInvoiceImageUrls(
        db,
        organization.id,
        task.id,
      );
      if (useStore.getState().activeScope !== scope) return;
      useStore.getState().setCurrentInvoice({ ...invoice, imageUris });
      router.push("/scan/review");
    } catch {
      useStore
        .getState()
        .showToast("Could not open this review. Please retry.");
    } finally {
      setOpening(null);
    }
  };
  const retry = async (task: ScanTask, skip = false) => {
    try {
      if (await ensureAiConsent(db)) start(task.id, skip);
    } catch (e) {
      useStore.getState().showToast((e as Error).message);
    }
  };
  const remove = (task: ScanTask) =>
    Alert.alert("Discard this scan?", "The uploaded draft will be removed.", [
      { text: "Keep scan", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          void Promise.resolve(
            db.rpc("discard_invoice_draft", { p_invoice: task.id }),
          )
            .then(({ error }) => {
              if (error) throw error;
              return refresh();
            })
            .catch(() =>
              useStore
                .getState()
                .showToast(
                  "Could not discard this scan. Refresh its status and retry.",
                ),
            );
        },
      },
    ]);
  return (
    <Screen style={s.screen} edges={["top", "bottom"]}>
      <View style={s.header}>
        <BackButton
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
        />
        <Text style={s.title}>Scan inbox</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.body}>
          Smart Sift works while you explore the app. Uploaded scans stay here
          until you review and save them.
        </Text>
        <Text style={s.note}>
          If you leave Sift or lose connection, return here to check the result.
          You won’t need to upload the photos again.
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={s.body}>
            {error}
          </Text>
        )}
        {!error && !tasks.length && (
          <Text style={s.body}>
            You’re all caught up. New scans will appear here.
          </Text>
        )}
        {tasks.map((task) => (
          <View key={task.id} style={s.card}>
            <View style={s.row}>
              {task.phase === "processing" && <Spinner size={18} />}
              <Text style={s.status} accessibilityLiveRegion="polite">
                {task.step}
              </Text>
            </View>
            <Text style={s.vendor}>{task.vendorName}</Text>
            {task.phase === "processing" ? (
              <Text style={s.body}>
                You can keep using Sift. This scan will be ready to review here.
              </Text>
            ) : task.phase === "ready" ? (
              <Touch
                accessibilityRole="button"
                disabled={!!opening}
                style={s.primary}
                onPress={() => void open(task)}
              >
                <Text style={s.primaryText}>
                  {opening === task.id ? "Opening…" : "Review scan"}
                </Text>
              </Touch>
            ) : (
              <>
                {!!task.error && <Text style={s.body}>{task.error}</Text>}
                {task.duplicate ? (
                  <>
                    <Touch
                      style={s.secondary}
                      accessibilityRole="button"
                      onPress={() =>
                        router.push(
                          `/invoice/${task.duplicate!.existingInvoiceId}`,
                        )
                      }
                    >
                      <Text style={s.link}>View existing invoice</Text>
                    </Touch>
                    {task.duplicate.canOverride && (
                      <Touch
                        style={s.secondary}
                        accessibilityRole="button"
                        onPress={() => void retry(task, true)}
                      >
                        <Text style={s.link}>Process anyway</Text>
                      </Touch>
                    )}
                  </>
                ) : task.phase === "limit" ? (
                  <Touch
                    style={s.secondary}
                    accessibilityRole="button"
                    onPress={() => router.push("/paywall")}
                  >
                    <Text style={s.link}>View plans</Text>
                  </Touch>
                ) : task.uploadReady === false ? (
                  <>
                    <Text style={s.body}>
                      The photo upload did not finish. Scan again to upload your
                      photos.
                    </Text>
                    <Touch
                      style={s.secondary}
                      accessibilityRole="button"
                      onPress={() => router.push("/scan")}
                    >
                      <Text style={s.link}>Scan again</Text>
                    </Touch>
                  </>
                ) : (
                  <Touch
                    style={s.secondary}
                    accessibilityRole="button"
                    onPress={() => void retry(task)}
                  >
                    <Text style={s.link}>Retry Smart Sift</Text>
                  </Touch>
                )}
                <Touch
                  style={s.secondary}
                  accessibilityRole="button"
                  onPress={() => remove(task)}
                >
                  <Text style={s.note}>Discard draft</Text>
                </Touch>
              </>
            )}
          </View>
        ))}
        <Touch
          style={s.secondary}
          accessibilityRole="button"
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={s.link}>Continue using Sift</Text>
        </Touch>
        <Touch
          style={s.secondary}
          accessibilityRole="button"
          onPress={() => void refresh()}
        >
          <Text style={s.link}>Refresh status</Text>
        </Touch>
      </ScrollView>
      <Toast />
    </Screen>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "Manrope_800ExtraBold",
    color: Colors.textPrimary,
  },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 28,
    padding: 20,
    gap: 12,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  status: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Manrope_700Bold",
    color: Colors.primaryDark,
  },
  vendor: {
    fontSize: 20,
    fontFamily: "Manrope_800ExtraBold",
    color: Colors.textPrimary,
  },
  body: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  note: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
  primary: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    minHeight: 48,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontSize: 15,
    fontFamily: "Manrope_700Bold",
    color: Colors.surface,
  },
  secondary: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  link: {
    fontSize: 14,
    fontFamily: "Manrope_700Bold",
    color: Colors.primaryDark,
  },
});

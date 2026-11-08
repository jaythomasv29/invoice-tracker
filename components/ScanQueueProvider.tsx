import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { useSupabase } from "../lib/supabase";
import { useWorkspace } from "../lib/workspaceContext";
import { useStore } from "../store/useStore";
import { extractInvoice, fetchInvoiceById } from "../lib/invoicePipeline";
import {
  DuplicateInvoiceError,
  ExtractionLimitError,
  ScanInProgressError,
} from "../lib/entitlements";
import { notifyExtractionUsageChanged } from "../hooks/useExtractionUsage";
import {
  duplicateFromOutcome,
  loadScanOutcomes,
  outcomeFromDuplicate,
  pruneScanOutcomes,
  saveScanOutcome,
} from "../lib/scanOutcomes";
import {
  processUploadedInvoice,
  recoveredScanPhase,
  type ScanPhase,
} from "../lib/scanProcessing";
export type ScanTask = {
  id: string;
  vendorName: string;
  phase: ScanPhase;
  step: string;
  error?: string;
  duplicate?: DuplicateInvoiceError;
  uploadReady?: boolean;
};
type Queue = {
  error: string;
  tasks: ScanTask[];
  start: (id: string, skipDuplicateCheck?: boolean) => void;
  refresh: () => Promise<void>;
};
const Context = createContext<Queue>({
  error: "",
  tasks: [],
  start: () => {},
  refresh: async () => {},
});
export const useScanQueue = () => useContext(Context);
export function ScanQueueProvider({ children }: { children: ReactNode }) {
  const db = useSupabase();
  const { organization, isPersonal } = useWorkspace();
  const noun = isPersonal ? "receipt" : "invoice";
  const scope = useStore((s) => s.activeScope),
    demo = useStore((s) => s.demoMode);
  const [tasks, setTasks] = useState<ScanTask[]>([]);
  const [error, setError] = useState("");
  const live = useRef({ scope, org: organization?.id });
  live.current = { scope, org: organization?.id };
  const running = useRef(new Set<string>()),
    refreshing = useRef(false);
  useEffect(() => {
    setTasks([]);
    setError("");
    running.current = new Set();
  }, [scope]);
  const refresh = useCallback(async () => {
    if (!organization?.id || demo || refreshing.current) return;
    refreshing.current = true;
    const org = organization.id;
    try {
      const incoming: ScanTask[] = [];
      // Duplicate / limit outcomes saved before a relaunch (the server keeps
      // only "failed"), so the scan still offers its real choices.
      const stored = await loadScanOutcomes(org);
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await db.rpc("invoice_scan_inbox", {
          p_limit: 100,
          p_offset: offset,
        });
        if (error) throw error;
        for (const row of data ?? []) {
          const phase = recoveredScanPhase(row.status, row.job_status);
          const saved = phase === "retry" ? stored[row.id] : undefined;
          if (saved) {
            incoming.push({
              id: row.id,
              vendorName: row.vendor_name || "New scan",
              uploadReady: row.upload_ready,
              phase: saved.kind,
              step:
                saved.kind === "duplicate"
                  ? "Possible duplicate"
                  : "Plan limit reached",
              error: saved.message,
              duplicate:
                saved.kind === "duplicate"
                  ? duplicateFromOutcome(saved)
                  : undefined,
            });
            continue;
          }
          incoming.push({
            id: row.id,
            vendorName: row.vendor_name || "New scan",
            uploadReady: row.upload_ready,
            phase,
            step:
              phase === "ready"
                ? "Ready to review"
                : row.phase === "reading" && phase === "processing"
                  ? `Reading ${noun} details`
                  : row.phase === "saving" && phase === "processing"
                    ? "Preparing your review"
                    : phase === "processing"
                      ? `Checking ${noun}`
                      : "Scan needs attention",
          });
        }
        if ((data?.length ?? 0) < 100) break;
      }
      if (
        live.current.scope !== scope ||
        useStore.getState().activeScope !== scope
      )
        return;
      // Forget outcomes for scans that finished, were retried elsewhere, or
      // left the inbox (saved/discarded).
      const actionable = new Set(
        incoming.filter((t) => t.phase !== "ready" && t.phase !== "processing").map((t) => t.id),
      );
      void pruneScanOutcomes(
        org,
        (id) => actionable.has(id) || running.current.has(id),
      );
      setError("");
      setTasks((previous) => [
        ...incoming.map((task) => {
          const old = previous.find((p) => p.id === task.id);
          // Server completion always wins. Keep actionable local errors/duplicate choices.
          return task.phase === "ready"
            ? task
            : task.phase === "processing" &&
                old?.phase === "retry" &&
                !running.current.has(task.id)
              ? task
              : old &&
                  (running.current.has(task.id) ||
                    ["ready", "duplicate", "limit", "retry"].includes(
                      old.phase,
                    ))
                ? {
                    ...old,
                    ...(task.vendorName !== "New scan"
                      ? { vendorName: task.vendorName }
                      : {}),
                  }
                : task;
        }),
        ...previous.filter(
          (old) =>
            running.current.has(old.id) &&
            !incoming.some((t) => t.id === old.id),
        ),
      ]);
    } catch {
      if (useStore.getState().activeScope === scope)
        setError("Could not refresh scans. Check your connection and retry.");
    } finally {
      refreshing.current = false;
    }
  }, [db, organization?.id, scope, demo, noun]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 5000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [refresh]);
  const start = (id: string, skipDuplicateCheck = false) => {
    if (
      !organization?.id ||
      demo ||
      live.current.scope !== scope ||
      useStore.getState().activeScope !== scope ||
      running.current.has(id)
    )
      return;
    const org = organization.id,
      captured = scope,
      currentRunning = running.current;
    currentRunning.add(id);
    // A fresh attempt supersedes any saved duplicate/limit outcome.
    void pruneScanOutcomes(org, (other) => other !== id);
    setTasks((old) => [
      {
        id,
        vendorName: old.find((t) => t.id === id)?.vendorName ?? "New scan",
        phase: "processing",
        step: `Checking ${noun}`,
      },
      ...old.filter((t) => t.id !== id),
    ]);
    void processUploadedInvoice(
      async () => {
        const { data: allowed, error } = await db.rpc("prepare_invoice_retry", {
          p_invoice: id,
        });
        if (error) throw new Error("Could not start this scan. Please retry.");
        // Already running (or already finished): not a failure. The
        // recover step below picks up a finished scan; otherwise the inbox
        // shows "Still reading this one…" until the refresh resolves it.
        if (!allowed) throw new ScanInProgressError();
        return extractInvoice(db, id, { skipDuplicateCheck });
      },
      async () => {
        const invoice = await fetchInvoiceById(db, org, id);
        return invoice.status === "scanned" || invoice.status === "saved"
          ? invoice
          : null;
      },
    )
      .then((invoice) => {
        if (
          live.current.scope !== captured ||
          useStore.getState().activeScope !== captured
        )
          return;
        setTasks((old) =>
          old.map((t) =>
            t.id === id
              ? {
                  id,
                  vendorName: invoice.vendorName,
                  phase: "ready",
                  step: "Ready to review",
                }
              : t,
          ),
        );
        useStore.getState().showToast("Your scan is ready to review");
        notifyExtractionUsageChanged();
      })
      .catch((error: unknown) => {
        if (
          live.current.scope !== captured ||
          useStore.getState().activeScope !== captured
        )
          return;
        if (error instanceof ScanInProgressError) {
          setTasks((old) =>
            old.map((t) =>
              t.id === id
                ? {
                    ...t,
                    phase: "processing",
                    step: "Still reading this one…",
                    error: undefined,
                    duplicate: undefined,
                  }
                : t,
            ),
          );
          return;
        }
        const duplicate =
          error instanceof DuplicateInvoiceError ? error : undefined;
        if (duplicate) void saveScanOutcome(org, id, outcomeFromDuplicate(duplicate));
        else if (error instanceof ExtractionLimitError) {
          void saveScanOutcome(org, id, { kind: "limit", message: error.message });
          notifyExtractionUsageChanged();
        }
        const phase = duplicate
          ? "duplicate"
          : error instanceof ExtractionLimitError
            ? "limit"
            : "retry";
        setTasks((old) =>
          old.map((t) =>
            t.id === id
              ? {
                  ...t,
                  phase,
                  step: duplicate
                    ? "Possible duplicate"
                    : phase === "limit"
                      ? "Plan limit reached"
                      : "Scan needs attention",
                  error: (error as Error).message,
                  duplicate,
                }
              : t,
          ),
        );
      })
      .finally(() => {
        currentRunning.delete(id);
        if (live.current.scope === captured) void refresh();
      });
  };
  return (
    <Context.Provider value={{ tasks, start, refresh, error }}>
      {children}
    </Context.Provider>
  );
}

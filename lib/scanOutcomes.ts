import * as SecureStore from 'expo-secure-store';
import { DuplicateInvoiceError } from './entitlements';

// Actionable scan outcomes the server doesn't keep (a duplicate warning with
// its "View existing / Process anyway" choice, or a plan-limit stop). Without
// this, a relaunch turns them into a generic "Scan needs attention" + Retry,
// which spends another duplicate check. SecureStore is the app's only
// persistence (see lib/tourFlag.ts); values are kept small (iOS warns past
// 2 KB) by storing only the newest few outcomes per workspace.
export type StoredOutcome =
  | { kind: 'duplicate'; message: string; existingInvoiceId: string; vendorName: string | null; invoiceDate: string | null; total: number | null; canOverride: boolean }
  | { kind: 'limit'; message: string };

type OutcomeMap = Record<string, StoredOutcome & { at: number }>;
const MAX_OUTCOMES = 8;
const keyFor = (workspaceId: string) => `sift.scanOutcomes.${workspaceId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export async function loadScanOutcomes(workspaceId: string): Promise<OutcomeMap> {
  try {
    const raw = await SecureStore.getItemAsync(keyFor(workspaceId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as OutcomeMap) : {};
  } catch {
    return {};
  }
}

async function write(workspaceId: string, map: OutcomeMap) {
  try {
    const newest = Object.entries(map).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_OUTCOMES);
    if (!newest.length) await SecureStore.deleteItemAsync(keyFor(workspaceId));
    else await SecureStore.setItemAsync(keyFor(workspaceId), JSON.stringify(Object.fromEntries(newest)));
  } catch {
    // Non-fatal: worst case the scan shows "needs attention" after a relaunch.
  }
}

// Read-modify-write updates run one at a time so a save and a prune racing
// each other can't drop an entry.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => {});
  return next;
}

export function saveScanOutcome(workspaceId: string, invoiceId: string, outcome: StoredOutcome) {
  return serial(async () => {
    const map = await loadScanOutcomes(workspaceId);
    map[invoiceId] = { ...outcome, at: Date.now() };
    await write(workspaceId, map);
  });
}

// Drop outcomes for scans that were retried, finished, or left the inbox.
export function pruneScanOutcomes(workspaceId: string, keep: (invoiceId: string) => boolean) {
  return serial(async () => {
    const map = await loadScanOutcomes(workspaceId);
    const ids = Object.keys(map);
    const kept = ids.filter(keep);
    if (kept.length === ids.length) return;
    await write(workspaceId, Object.fromEntries(kept.map((id) => [id, map[id]])));
  });
}

export function outcomeFromDuplicate(error: DuplicateInvoiceError): StoredOutcome {
  return {
    kind: 'duplicate',
    message: error.message,
    existingInvoiceId: error.existingInvoiceId,
    vendorName: error.vendorName,
    invoiceDate: error.invoiceDate,
    total: error.total,
    canOverride: error.canOverride,
  };
}

export function duplicateFromOutcome(outcome: Extract<StoredOutcome, { kind: 'duplicate' }>): DuplicateInvoiceError {
  return new DuplicateInvoiceError(
    outcome.message,
    outcome.existingInvoiceId,
    outcome.vendorName,
    outcome.invoiceDate,
    outcome.total,
    outcome.canOverride,
  );
}

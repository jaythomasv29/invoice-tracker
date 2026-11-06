/** Resolve a lost response from committed server state, without deleting a draft. */
export async function processUploadedInvoice<T>(
  extract: () => Promise<T>,
  recover: () => Promise<T | null>,
): Promise<T> {
  try {
    return await extract();
  } catch (error) {
    try {
      const committed = await recover();
      if (committed) return committed;
    } catch {
      /* Preserve the original failure. */
    }
    throw error;
  }
}
export type ScanPhase =
  "processing" | "ready" | "retry" | "duplicate" | "limit";
export function recoveredScanPhase(
  invoiceStatus: string,
  jobStatus?: string | null,
): ScanPhase {
  if (invoiceStatus === "scanned") return "ready";
  return jobStatus === "running" ? "processing" : "retry";
}

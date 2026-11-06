/** Stable server ordering is required. Offset uses raw page size, never the deduplicated count. */
export async function collectInvoicePages<T extends { id: string }>(
  fetchPage: (
    offset: number,
    limit: number,
  ) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = 500,
): Promise<T[]> {
  const rows = new Map<string, T>();
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await fetchPage(offset, pageSize);
    if (error) throw new Error("Could not load invoice history. Please retry.");
    for (const row of data ?? []) rows.set(row.id, row);
    if ((data?.length ?? 0) < pageSize) break;
  }
  return [...rows.values()];
}

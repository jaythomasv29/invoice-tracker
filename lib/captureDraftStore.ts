export type CaptureDraft = { pages: string[]; invoiceId?: string };
export type CaptureStorage = {
  read: (path: string) => Promise<string | null>;
  write: (path: string, contents: string) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
  copy: (source: string, destination: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  remove: (path: string) => Promise<void>;
  releaseSource?: (path: string) => Promise<void>;
};

// Copy before publishing the manifest. A failed copy never replaces the last
// recoverable batch. Queue mutations so removing a page cannot race an upload.
export function createCaptureDraftStore(storage: CaptureStorage) {
  let chain: Promise<unknown> = Promise.resolve();
  let sequence = 0;
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  };
  const read = async (folder: string): Promise<CaptureDraft> => {
    const text = await storage.read(folder + 'draft.json');
    if (!text) return { pages: [] };
    const data = JSON.parse(text);
    if (!Array.isArray(data.pages) || data.pages.length > 5 || data.pages.some((p: unknown) => typeof p !== 'string' || !/^page-[a-z0-9-]+\.jpg$/.test(p))) {
      throw new Error('Invalid capture draft');
    }
    const paths = data.pages.map((p: string) => folder + p);
    // Never silently drop a missing page and upload an incomplete document.
    if (!(await Promise.all(paths.map((p: string) => storage.exists(p)))).every(Boolean)) throw new Error('A saved capture page is unavailable');
    return { pages: paths, invoiceId: typeof data.invoiceId === 'string' ? data.invoiceId : undefined };
  };
  return {
    load: (folder: string) => serial(() => read(folder)),
    save: (folder: string, pages: string[], invoiceId?: string) => serial(async () => {
      if (pages.length > 5) throw new Error('Up to five pages per document');
      await storage.mkdir(folder);
      const previous = await read(folder);
      const added: string[] = [];
      const owned: string[] = [];
      try {
        for (const uri of pages) {
          if (uri.startsWith(folder) && /^page-[a-z0-9-]+\.jpg$/.test(uri.slice(folder.length)) && await storage.exists(uri)) {
            owned.push(uri);
          } else {
            const dest = folder + `page-${Date.now().toString(36)}-${(++sequence).toString(36)}.jpg`;
            added.push(dest);
            await storage.copy(uri, dest);
            owned.push(dest);
          }
        }
        await storage.write(folder + 'draft.json', JSON.stringify({ pages: owned.map(p => p.slice(folder.length)), invoiceId }));
      } catch (error) {
        await Promise.all(added.map(p => storage.remove(p).catch(() => {})));
        throw error;
      }
      await Promise.all(previous.pages.filter(p => !owned.includes(p)).map(p => storage.remove(p).catch(() => {})));
      await Promise.all(pages.filter(p => !owned.includes(p)).map(p => storage.releaseSource?.(p).catch(() => {})));
      return { pages: owned, invoiceId };
    }),
    clear: (folder: string) => serial(() => storage.remove(folder)),
  };
}

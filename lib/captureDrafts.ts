import * as Files from 'expo-file-system/legacy';
import { createCaptureDraftStore } from './captureDraftStore';

const root = () => {
  if (!Files.documentDirectory) throw new Error('Local photo storage is unavailable');
  return Files.documentDirectory + 'scan-captures/';
};
const segment = (value: string) => encodeURIComponent(value).replace(/\./g, '%2E');
const ownerFolder = (userId: string) => root() + segment(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? 'unconfigured') + '/' + segment(userId) + '/';
export const captureDraftFolder = (userId: string, workspaceId: string) => ownerFolder(userId) + segment(workspaceId) + '/';

// Only app-owned temporary files are removed, never Photos-library originals.
export async function releaseTemporaryCapture(uri: string): Promise<void> {
  if (Files.cacheDirectory && uri.startsWith(Files.cacheDirectory)) await Files.deleteAsync(uri, { idempotent: true });
}

export const captureDrafts = createCaptureDraftStore({
  read: async (path) => (await Files.getInfoAsync(path)).exists ? Files.readAsStringAsync(path) : null,
  // Expo's iOS legacy writer uses Data.write(options: .atomic).
  write: (path, contents) => Files.writeAsStringAsync(path, contents),
  mkdir: (path) => Files.makeDirectoryAsync(path, { intermediates: true }),
  copy: (from, to) => Files.copyAsync({ from, to }),
  releaseSource: releaseTemporaryCapture,
  exists: async (path) => (await Files.getInfoAsync(path)).exists,
  remove: (path) => Files.deleteAsync(path, { idempotent: true }),
});
export const clearOwnerCaptureDrafts = (userId: string) => captureDrafts.clear(ownerFolder(userId));

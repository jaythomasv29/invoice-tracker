import * as SecureStore from 'expo-secure-store';

// First-run flag for the product tour. SecureStore is the only persistence in
// this app (no AsyncStorage) — same store the Clerk token cache uses. Reads are
// wrapped in try/catch and a failure is treated as "not seen yet", mirroring
// lib/clerkTokenCache.ts's tolerance of passcode-less simulators.
const KEY = 'sift.hasSeenTour.v1';

export async function hasSeenTour(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markTourSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, '1');
  } catch {
    // Non-fatal: worst case the tour offers to run again next launch.
  }
}

import { Linking } from 'react-native';

// Filled in once the pages in /legal are hosted somewhere (GitHub Pages,
// Notion, etc.) — see SETUP.md's "Legal pages" section. Left blank until
// then so the app falls back to a toast instead of opening a dead link.
export const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || '';

export function openLegalUrl(url: string, onMissing: () => void) {
  if (!url) {
    onMissing();
    return;
  }
  Linking.openURL(url).catch(onMissing);
}

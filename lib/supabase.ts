import { useMemo, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Per-session Supabase client authenticated as the current Clerk user.
 *
 * Supabase validates the Clerk session token directly (Clerk configured as a
 * Third-Party Auth provider in the Supabase dashboard — no Supabase-side user
 * record, no JWT template required). RLS policies read the active org id off
 * that token via `private.current_org_id()` (see supabase/migrations) —
 * Clerk nests it as `o.id`, not a flat `org_id` claim, confirmed from a live
 * decoded token during end-to-end testing.
 *
 * Must be called from a component under <ClerkProvider>. `getToken` from
 * Clerk's useAuth() is a new function reference on every render, so the
 * client is kept stable via a ref instead of depending on it directly —
 * depending on `getToken` in the useMemo caused the memoized client (and
 * anything built from it, like a useFocusEffect callback) to be recreated
 * every render, which combined with useFocusEffect's own internals (it
 * re-fires whenever the passed-in callback's identity changes) produced a
 * real infinite render loop on any screen that both used this hook and
 * called setState inside that effect. The ref always calls the latest
 * getToken without the client itself needing to change identity.
 */
export function useSupabase() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  return useMemo(
    () =>
      createClient(supabaseUrl, supabaseAnonKey, {
        accessToken: async () => (await getTokenRef.current()) ?? null,
      }),
    []
  );
}

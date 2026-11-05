import { useAuth, useOrganizationList } from '@clerk/clerk-expo';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { useSupabaseForWorkspace } from '../lib/supabase';
import { WorkspaceContext, type Workspace } from '../lib/workspaceContext';
/** Selection never grants access: Postgres verifies ownership from the signed JWT. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { userId, sessionId, orgId, isLoaded } = useAuth({
    treatPendingAsSignedOut: false,
  });
  const { setActive } = useOrganizationList();
  const [selected, setSelected] = useState<string | null>(null);
  const [personalId, setPersonalId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Omit<Workspace, 'reload'> | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identity = `${userId ?? ''}:${sessionId ?? ''}`;
  const generation = useRef(0);
  const latestSelection = useRef<string | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState('');
  const raw = useSupabaseForWorkspace();
  const scoped = useSupabaseForWorkspace(selected);
  useEffect(() => {
    if (loadedIdentity === identity) return;
    const run = ++generation.current;
    setReady(false);
    setProfile(null);
    setSelected(null);
    setPersonalId(null);
    setError(null);
    if (!isLoaded) return;
    if (!userId) {
      setLoadedIdentity(identity);
      setReady(true);
      return;
    }
    void (async () => {
      try {
        const [{ data, error: queryError }, saved] = await Promise.all([
          raw.from('personal_workspaces').select('id').maybeSingle(),
          SecureStore.getItemAsync(`sift_workspace_${userId}`),
        ]);
        if (queryError)
          throw new Error(
            'Could not load workspaces. Check your connection and retry.',
          );
        if (run !== generation.current) return;
        const personal = data?.id ?? null;
        setPersonalId(personal);
        const initial =
          saved === personal && personal ? personal : (orgId ?? personal);
        latestSelection.current = initial;
        setSelected(initial);
        setLoadedIdentity(identity);
        if (!orgId && !personal) setReady(true);
      } catch (e) {
        if (run === generation.current) {
          setError((e as Error).message);
          setLoadedIdentity(identity);
          setReady(true);
        }
      }
    })();
    // The client is deliberately captured for this identity only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, isLoaded, userId, loadedIdentity]); // org changes are handled separately without losing a Personal selection
  useEffect(() => {
    if (orgId && loadedIdentity === identity && !selected) {
      latestSelection.current = orgId;
      setSelected(orgId);
    }
  }, [orgId, loadedIdentity, identity, selected]);
  const refresh = useCallback(async () => {
    if (!selected) return;
    const run = generation.current;
    const { data, error: invokeError } = await scoped.functions.invoke(
      'workspace-profile',
      { body: {} },
    );
    if (run !== generation.current || latestSelection.current !== selected)
      return;
    if (invokeError || !data?.id)
      throw new Error(
        'Could not load your workspace. Check your connection and retry.',
      );
    setProfile(data);
    setError(null);
    setReady(true);
  }, [selected, scoped]);
  useEffect(() => {
    if (!selected || loadedIdentity !== identity) return;
    let active = true;
    setReady(false);
    setProfile(null);
    void refresh().catch((e) => {
      if (active) {
        setError(e.message);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [selected, refresh, loadedIdentity, identity]);
  const select = useCallback(
    async (id: string) => {
      if (!userId) return;
      if (id === selected && profile) return;
      latestSelection.current = id;
      ++generation.current;
      setReady(false);
      setProfile(null);
      setError(null);
      try {
        if (id.startsWith('pws_')) {
          // RPC/RLS still validates this ID; never authorize from a saved preference.
          const { data, error: lookupError } = await raw
            .from('personal_workspaces')
            .select('id')
            .eq('id', id)
            .single();
          if (lookupError || !data) {
            setReady(true);
            throw new Error('Household workspace was not found.');
          }
          setPersonalId(id);
        } else {
          await setActive?.({ organization: id });
        }
        // A keychain preference failure must not undo an already activated business.
        await SecureStore.setItemAsync(`sift_workspace_${userId}`, id).catch(
          () => {},
        );
        setSelected(id);
      } catch (e) {
        latestSelection.current = selected;
        setProfile(profile);
        setReady(true);
        if (!profile) setError((e as Error).message);
        throw e;
      }
    },
    [userId, raw, setActive, selected, profile],
  );
  const organization = useMemo(
    () => (profile ? { ...profile, reload: refresh } : null),
    [profile, refresh],
  );
  const retry = useCallback(async () => {
    if (selected) await refresh();
    else {
      setLoadedIdentity('');
      setError(null);
    }
  }, [selected, refresh]);
  return (
    <WorkspaceContext.Provider
      value={{
        organization: loadedIdentity === identity ? organization : null,
        ready: loadedIdentity === identity && ready,
        error,
        isPersonal: profile?.type === 'personal',
        accountType: profile?.type ?? 'business',
        refresh: retry,
        select,
        personalId,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

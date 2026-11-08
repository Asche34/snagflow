import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from './supabase';
import { retainedResource } from './online';
import { offlineFor } from './offline/runtime';
import { useOfflineState } from '../providers/offline';
/** Reconcile current authorized reads, including removals that cannot safely use DELETE payloads. */
export function useResource<T>(
  loader: () => Promise<T>,
  scope: string,
  tables: string[] = ['snags'],
) {
  const [client] = useState(() => supabase);
  const offlineState = useOfflineState();
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const load = useCallback(async (synchronize: boolean) => {
    const current = ++generation.current;
    setLoading(true);
    try {
      if (synchronize) {
        const offline = offlineFor(client);
        if (offline && Object.keys(offline.engine.state.mirrors).length) void offline.sync();
        else await offline?.sync();
      }
      const next = await loaderRef.current();
      if (current === generation.current) {
        setData(next);
        setError(null);
      }
    } catch (failure) {
      if (current === generation.current) {
        setData((previous) => retainedResource(previous, failure));
        setError(
          'Could not load current data. Check your connection and access, then retry. Your open drafts are retained during temporary connection failures.',
        );
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [client]);
  const refresh = useCallback(() => load(true), [load]);
  useEffect(() => {
    if (offlineState) void load(false);
  }, [offlineState, scope, load]);
  useFocusEffect(
    useCallback(() => {
      // A changed resource identity must not expose the previous route/filter's records.
      void scope;
      setData(null);
      void refresh();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void refresh();
      }, 15000);
      const state = AppState.addEventListener('change', (next) => {
        if (next === 'active') void refresh();
      });
      return () => {
        generation.current++;
        clearInterval(timer);
        state.remove();
      };
    }, [scope, refresh]),
  );
  const tableKey = tables.join(',');
  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<typeof client.channel> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const { data: auth } = await client.auth.getSession();
      if (!auth.session || disposed) return;
      await client.realtime.setAuth(auth.session.access_token);
      if (disposed) return;
      channel = client.channel(`mobile:${scope}:${Math.random()}`);
      for (const table of tableKey.split(','))
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          clearTimeout(timer);
          timer = setTimeout(() => void refresh(), 300);
        });
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') void refresh();
      });
    })().catch(() => {
      /* Periodic/focus reconciliation remains available. */
    });
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (channel) void client.removeChannel(channel);
    };
  }, [scope, tableKey, refresh, client]);
  return { data, error, loading, refresh };
}

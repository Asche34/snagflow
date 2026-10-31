'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from './supabase/browser';

export type LiveFilter = { table: string; filter: string };
export type LiveEvent = RealtimePostgresChangesPayload<Record<string, unknown>>;

/** Events are hints only. Always reconcile through authenticated reads, including
 * after reconnect. DELETE cannot safely use Postgres Changes RLS/filters, so the
 * visible-page interval also reconciles removals and membership revocations. */
export function useLiveUpdates(filters: LiveFilter[], reconcile: (event?: LiveEvent) => void) {
  const callback = useRef(reconcile);
  useEffect(() => {
    callback.current = reconcile;
  }, [reconcile]);
  const [status, setStatus] = useState('Connecting live updates…');
  const key = JSON.stringify(filters);
  useEffect(() => {
    const supabase = createClient();
    let stopped = false;
    let connected = false;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest: LiveEvent | undefined;
    const refresh = (event?: LiveEvent) => {
      if (stopped) return;
      if (event) latest = event;
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (!stopped && navigator.onLine && document.visibilityState === 'visible') {
          callback.current(latest);
          latest = undefined;
        }
      }, 250);
    };
    const channel = supabase.channel(`live-${crypto.randomUUID()}`, {
      config: { postgres_changes_options: { wait: true } },
    });
    for (const scope of JSON.parse(key) as LiveFilter[]) {
      for (const event of ['INSERT', 'UPDATE'] as const) {
        channel.on('postgres_changes', { event, schema: 'public', ...scope }, refresh);
      }
    }
    const subscribe = () =>
      channel.subscribe((state) => {
        if (stopped) return;
        if (state === 'SUBSCRIBED') {
          connected = true;
          setStatus(
            navigator.onLine
              ? 'Live updates connected'
              : 'Offline · updates will resume when connected',
          );
          refresh();
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          connected = false;
          setStatus(
            navigator.onLine
              ? 'Live updates reconnecting…'
              : 'Offline · updates will resume when connected',
          );
        }
      });
    // The installed SDK may join before its async initial token lookup finishes.
    // Authenticate first so RLS evaluates subscriptions as the signed-in user.
    const start = async () => {
      if (started || stopped) return;
      started = true;
      try {
        await supabase.realtime.setAuth();
        if (!stopped) subscribe();
      } catch {
        started = false;
        if (!stopped) setStatus('Live updates reconnecting…');
      }
    };
    void start();
    const offline = () => setStatus('Offline · updates will resume when connected');
    const recover = () => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        void start();
        setStatus(connected ? 'Live updates connected' : 'Live updates reconnecting…');
        refresh();
      }
    };
    const interval = setInterval(recover, 15_000);
    window.addEventListener('online', recover);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('online', recover);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recover);
      void supabase.removeChannel(channel);
    };
  }, [key]);
  return status;
}

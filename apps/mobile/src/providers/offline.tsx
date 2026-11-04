import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Text, View } from 'react-native';
import { useAuth } from './auth';
import { bindOffline, revokeOffline, type OfflineRuntime } from '../lib/offline/runtime';
import type { OfflineState } from '../lib/offline/engine';
import { styles } from '../components/ui';
const Context = createContext<{
  runtime: OfflineRuntime | null;
  revision: number;
  state: OfflineState | null;
}>({ runtime: null, revision: 0, state: null });
export function OfflineProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return <OfflineScope key={session?.user.id ?? 'anonymous'}>{children}</OfflineScope>;
}
function OfflineScope({ children }: { children: ReactNode }) {
  const { client, session } = useAuth();
  const userId = session?.user.id;
  const [runtime, setRuntime] = useState<OfflineRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, redraw] = useState(0);
  useEffect(() => {
    let alive = true;
    let current: OfflineRuntime | undefined;
    let network: { remove: () => void } | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    if (userId)
      void (async () => {
        try {
          current = await bindOffline(client, userId);
          if (!alive) {
            current.active = false;
            return;
          }
          const update = () => {
            if (alive) redraw((x) => x + 1);
          };
          current.onChange = update;
          current.engine.onChange = update;
          setRuntime(current);
          void current.sync();
          timer = setInterval(() => {
            if (AppState.currentState === 'active') void current?.sync();
          }, 15000);
          const { addNetworkStateListener } = await import('expo-network');
          if (!alive) return;
          network = addNetworkStateListener((state) => {
            if (!alive || !current?.active) return;
            if (state.isConnected === false || state.isInternetReachable === false) {
              current.online = false;
              current.onChange();
            } else if (state.isConnected) void current.sync();
          });
        } catch {
          if (alive)
            setError(
              'Offline storage could not open. Your retained work is untouched. Restart the app or free device storage.',
            );
        }
      })();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void current?.sync();
    });
    return () => {
      alive = false;
      if (current) current.active = false;
      revokeOffline();
      clearInterval(timer);
      network?.remove();
      listener.remove();
    };
  }, [client, userId]);
  if (error)
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="alert" style={styles.text}>
          {error}
        </Text>
      </View>
    );
  if (userId && !runtime)
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Opening offline workspace…</Text>
      </View>
    );
  return (
    <Context.Provider value={{ runtime, revision, state: runtime?.engine.state ?? null }}>
      {children}
    </Context.Provider>
  );
}
export function useOffline() {
  const runtime = useContext(Context).runtime;
  return runtime?.capability === 'unsupported' ? null : runtime;
}
export function useOfflineRuntime() {
  return useContext(Context).runtime;
}
export function useOfflineState() {
  return useContext(Context).state;
}

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MobileConnectionSchema, type MobileConnection } from '@snagflow/shared';
import { discoverConnection } from '../lib/connection';
import {
  connectionPreferencesStorage,
  defaultConnection,
  installConnection,
} from '../lib/supabase';
import { clearAuthCallbackState } from '../lib/auth-callback';

const PREFERENCE_KEY = 'snagflow.connection.v1';
type ConnectionContextValue = {
  connection: MobileConnection | null;
  identity: string;
  ready: boolean;
  busy: boolean;
  error: string | null;
  connect: (url: string) => Promise<void>;
  resetSession: () => Promise<boolean>;
};
const Context = createContext<ConnectionContextValue | null>(null);
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<MobileConnection | null>(null),
    [identity, setIdentity] = useState('unconfigured'),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  const resets = useRef(0);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const saved = await connectionPreferencesStorage.getItem(PREFERENCE_KEY);
        const next = saved ? MobileConnectionSchema.parse(JSON.parse(saved)) : defaultConnection();
        if (next) {
          const key = await installConnection(next);
          if (mounted) {
            setConnection(next);
            setIdentity(key);
          }
        }
      } catch {
        if (mounted)
          setError('Saved connection could not be restored. Enter the app URL and connect again.');
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const connect = async (url: string) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await discoverConnection(url);
      const previous = await connectionPreferencesStorage.getItem(PREFERENCE_KEY);
      await connectionPreferencesStorage.setItem(PREFERENCE_KEY, JSON.stringify(next));
      try {
        const key = await installConnection(next);
        clearAuthCallbackState();
        setConnection(next);
        setIdentity(key);
      } catch (failure) {
        setConnection(null);
        setIdentity('unconfigured');
        if (previous) await connectionPreferencesStorage.setItem(PREFERENCE_KEY, previous);
        else await connectionPreferencesStorage.removeItem(PREFERENCE_KEY);
        throw failure;
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not connect. Check the app address and retry.',
      );
      throw Error('Connection was not changed.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const resetSession = async () => {
    if (working.current || !connection) return false;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const key = await installConnection(connection, true);
      clearAuthCallbackState();
      resets.current++;
      setIdentity(`${key}.local.${resets.current}`);
      return true;
    } catch {
      setError('Could not clear this device session. Unlock the device and retry.');
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return (
    <Context.Provider value={{ connection, identity, ready, busy, error, connect, resetSession }}>
      {children}
    </Context.Provider>
  );
}
export function useConnection(): ConnectionContextValue {
  const value = useContext(Context);
  if (!value) throw Error('Missing connection provider.');
  return value;
}

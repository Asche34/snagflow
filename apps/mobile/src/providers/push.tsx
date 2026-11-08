import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from './auth';
import { useConnection } from './connection';
import { connectionPreferencesStorage, isCurrentClient } from '../lib/supabase';
import { createRegistrationLifecycle, resolvePushTarget } from '../lib/push-core';
import { attachPushRegistration } from '../lib/push-registration';

type ContextValue = {
  enabled: boolean;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};
const Context = createContext<ContextValue | null>(null);
export function PushProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const { identity } = useConnection();
  return (
    <PushScope key={`${identity}:${session?.user.id ?? ''}:${profile?.is_active ?? false}`}>
      {children}
    </PushScope>
  );
}
function PushScope({ children }: { children: ReactNode }) {
  const { client, session, profile } = useAuth();
  const { identity } = useConnection();
  const deploymentKey = identity.split('.local.')[0]!;
  const userId = session?.user.id;
  const preferenceKey = `${deploymentKey}.push.${userId ?? 'anonymous'}`;
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const lifecycle = useRef<ReturnType<typeof createRegistrationLifecycle> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const valid = useCallback(() => isCurrentClient(client) && mounted.current, [client]);
  const refresh = useCallback(
    async (ask: boolean) => {
      if (Platform.OS === 'web' || !userId || !profile?.is_active || !valid()) return;
      const notifications = await import('expo-notifications');
      const device = await import('expo-device');
      if (!device.isDevice) throw Error('Push notifications require a physical device.');
      if (Platform.OS === 'android')
        await notifications.setNotificationChannelAsync('snagflow-updates', {
          name: 'SnagFlow updates',
          importance: notifications.AndroidImportance.DEFAULT,
        });
      let permission = await notifications.getPermissionsAsync();
      if (!permission.granted && ask) permission = await notifications.requestPermissionsAsync();
      if (!permission.granted) {
        await lifecycle.current?.clear();
        if (valid()) setEnabled(false);
        throw Error(
          'Notifications are disabled in phone Settings. In-app Updates remain available.',
        );
      }
      const { default: Constants } = await import('expo-constants');
      const projectId =
        Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (typeof projectId !== 'string')
        throw Error('This build has no Expo project configuration.');
      const token = await notifications.getExpoPushTokenAsync({ projectId });
      if (!valid()) return;
      await lifecycle.current?.update(token.data);
      if (!valid()) return;
      await connectionPreferencesStorage.setItem(preferenceKey, 'enabled');
      if (valid()) setEnabled(true);
    },
    [userId, profile?.is_active, valid, preferenceKey],
  );
  useEffect(() => {
    if (Platform.OS === 'web' || !userId || !profile?.is_active) return;
    let disposed = false;
    const current = () => !disposed && valid();
    const instance = createRegistrationLifecycle({
      register: async (token) => {
        if (!current()) throw Error('The app connection changed.');
        const key = `${deploymentKey}.push.installation`;
        let installation = await connectionPreferencesStorage.getItem(key);
        if (!installation) {
          const crypto = await import('expo-crypto');
          installation = crypto.randomUUID();
          await connectionPreferencesStorage.setItem(key, installation);
        }
        if (!current()) throw Error('The app connection changed.');
        const r = await client.rpc('register_push_token', {
          p_token: token,
          p_platform: Platform.OS,
          p_deployment_key: deploymentKey,
          p_installation_id: installation,
        });
        if (r.error)
          throw Error(
            'Push registration is unavailable. Check the connection and server/native push configuration, then retry.',
          );
      },
      unregister: async (token) => {
        const r = await client.rpc('unregister_push_token', { p_token: token });
        if (r.error) throw Error('Push removal is waiting for a connection.');
      },
    });
    lifecycle.current = instance;
    const detach = attachPushRegistration(client, instance);
    const retry = () => {
      void connectionPreferencesStorage
        .getItem(preferenceKey)
        .then((saved) => {
          if (current() && saved === 'enabled') return refresh(false);
        })
        .catch((failure: unknown) => {
          if (current())
            setError(
              failure instanceof Error ? failure.message : 'Push registration could not refresh.',
            );
        });
    };
    retry();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') retry();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') retry();
    }, 15 * 60000);
    let connectivity: { remove: () => void } | undefined;
    void import('expo-network')
      .then((network) => {
        if (!current()) return;
        connectivity = network.addNetworkStateListener((state) => {
          if (state.isConnected && state.isInternetReachable !== false) retry();
        });
      })
      .catch(() => {
        /* Foreground and periodic recovery remain available. */
      });
    let tokenListener: { remove: () => void } | undefined;
    let tapListener: { remove: () => void } | undefined;
    void import('expo-notifications')
      .then((notifications) => {
        if (!current()) return;
        tokenListener = notifications.addPushTokenListener(retry);
        const open = async (
          response: ReturnType<typeof notifications.getLastNotificationResponse>,
        ) => {
          if (!response || !current()) return;
          try {
            const id = await resolvePushTarget(response.notification.request.content.data, {
              userId,
              deploymentKey,
              isCurrent: current,
              notification: async (id) => {
                const r = await client
                  .from('notifications')
                  .select('user_id,snag_id,project_id')
                  .eq('id', id)
                  .maybeSingle();
                if (r.error) throw r.error;
                return r.data;
              },
              snag: async (id) => {
                const r = await client
                  .from('snags')
                  .select('id,project_id,deleted_at')
                  .eq('id', id)
                  .is('deleted_at', null)
                  .maybeSingle();
                if (r.error) throw r.error;
                return r.data;
              },
            });
            if (!current()) return;
            notifications.clearLastNotificationResponse();
            if (id) router.push({ pathname: '/snags/[id]', params: { id } });
            else setError('This update is unavailable in the current account or app connection.');
          } catch {
            if (current()) setError('Connect to verify this update, then tap it again.');
          }
        };
        void open(notifications.getLastNotificationResponse());
        tapListener = notifications.addNotificationResponseReceivedListener(
          (response) => void open(response),
        );
      })
      .catch(() => {
        if (current()) setError('Push support is unavailable in this build.');
      });
    return () => {
      disposed = true;
      detach();
      foreground.remove();
      clearInterval(timer);
      connectivity?.remove();
      tokenListener?.remove();
      tapListener?.remove();
      void instance.deactivate().catch(() => {});
      if (lifecycle.current === instance) lifecycle.current = null;
    };
  }, [client, userId, profile?.is_active, deploymentKey, preferenceKey, valid, refresh]);
  const enable = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await refresh(true);
    } catch (failure) {
      if (valid())
        setError(failure instanceof Error ? failure.message : 'Push registration failed.');
    } finally {
      if (valid()) setBusy(false);
    }
  };
  const disable = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await connectionPreferencesStorage.removeItem(preferenceKey);
      await lifecycle.current?.clear();
      if (valid()) setEnabled(false);
    } catch {
      if (valid()) setError('Push removal is waiting for a connection. Retry before signing out.');
    } finally {
      if (valid()) setBusy(false);
    }
  };
  return (
    <Context.Provider value={{ enabled, busy, error, enable, disable }}>
      {children}
    </Context.Provider>
  );
}
export function usePush() {
  const value = useContext(Context);
  if (!value) throw Error('Missing push provider.');
  return value;
}

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
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@snagflow/shared/db-types';
import {
  getDeploymentKey,
  isCurrentClient,
  readRetainedSession,
  supabase,
  supabaseSetupError,
} from '../lib/supabase';
import { clearAuthCallbackState, retainedAuthProfile } from '../lib/auth-callback';
import { AccessUnavailableError } from '../lib/online';
import { accountEngine, revokeOffline } from '../lib/offline/runtime';
import { transientFailure } from '../lib/offline/engine';
import {
  OfflineSessionRecovery,
  localSessionFor,
  recoverLocalSession,
  registerOfflineSession,
  retryableRefreshFailure,
  revokeLocalSession,
} from '../lib/offline-session';
import { useConnection } from './connection';

type Profile = Database['public']['Tables']['profiles']['Row'];
type AuthContextValue = {
  client: typeof supabase;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const connection = useConnection();
  const [client] = useState(() => supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(!supabaseSetupError);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(supabaseSetupError);
  const currentUser = useRef<string | null>(null);
  const profileRequest = useRef(0);
  const signingOut = useRef(false);

  const refreshProfile = useCallback(async () => {
    const userId = currentUser.current;
    const request = ++profileRequest.current;
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      // Restore the verified local profile before a network refresh can stall.
      // This permits local work only; every replay still rechecks server access.
      try {
        const retained = (await accountEngine(client, userId)).state.profile;
        if (request !== profileRequest.current || currentUser.current !== userId) return;
        if (retained?.id === userId && retained.is_active)
          setProfile((previous) => previous?.id === userId ? previous : retained);
      } catch {
        // An unavailable cache must not prevent an online account refresh.
      }
      // A recovered local identity is never sent as anonymous/expired backend authorization.
      if (localSessionFor(client, userId)) {
        const local = await accountEngine(client, userId);
        if (request !== profileRequest.current || currentUser.current !== userId) return;
        const cached = local.state.profile;
        setProfile(cached?.id === userId && cached.is_active ? cached : null);
        setError(
          'Working offline with this device’s retained account. Reconnect to refresh access.',
        );
        return;
      }
      const auth = await client.auth.getSession();
      if (auth.error) {
        if (retryableRefreshFailure(auth.error)) {
          await recoverLocalSession(client, auth.error, userId);
          throw auth.error;
        }
        throw new AccessUnavailableError();
      }
      if (
        auth.data.session?.user.id !== userId ||
        (auth.data.session.expires_at && auth.data.session.expires_at * 1000 <= Date.now())
      )
        throw new AccessUnavailableError();
      const { data, error: readError } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (request !== profileRequest.current || currentUser.current !== userId) return;
      if (readError) throw readError;
      if (!data) throw new AccessUnavailableError();
      setProfile(data.is_active ? data : null);
      const local = await accountEngine(client, userId);
      if (request !== profileRequest.current || currentUser.current !== userId) return;
      await local.change((s) => {
        s.profile = data.is_active ? data : null;
        if (!data.is_active) {
          s.mirrors = {};
          s.drafts = {};
          s.files = {};
        }
      });
      setError(data.is_active ? null : 'Your account is inactive. Contact your administrator.');
    } catch (failure) {
      if (request !== profileRequest.current || currentUser.current !== userId) return;
      if (transientFailure(failure) || retryableRefreshFailure(failure)) {
        try {
          const local = await accountEngine(client, userId);
          if (request !== profileRequest.current || currentUser.current !== userId) return;
          if (local.state.profile?.id === userId && local.state.profile.is_active)
            setProfile(local.state.profile);
          else setProfile((previous) => retainedAuthProfile(previous, userId, failure));
        } catch {
          setProfile((previous) => retainedAuthProfile(previous, userId, failure));
        }
      } else {
        setProfile((previous) => retainedAuthProfile(previous, userId, failure));
        if (
          failure instanceof AccessUnavailableError ||
          (failure as { code?: string })?.code === '42501'
        ) {
          try {
            const local = await accountEngine(client, userId);
            await local.change((s) => {
              s.profile = null;
              s.mirrors = {};
              s.drafts = {};
              s.files = {};
            });
          } catch {
            /* Retain the failed storage operation for explicit recovery. */
          }
        }
      }
      setError('Unable to refresh your account. Check your connection and retry.');
    } finally {
      if (request === profileRequest.current) setProfileLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (supabaseSetupError) return;
    let mounted = true;
    let eventVersion = 0;
    const recovery = new OfflineSessionRecovery(getDeploymentKey() ?? 'unconfigured', {
      namespace: getDeploymentKey,
      active: () => mounted && !signingOut.current && isCurrentClient(client),
      readStored: () => readRetainedSession(client),
      profile: async (id) => (await accountEngine(client, id)).state.profile,
    });
    registerOfflineSession(client, recovery);
    const applySession = (next: Session | null) => {
      if (!mounted || signingOut.current) return;
      const userId = next?.user.id ?? null;
      if (currentUser.current !== userId) {
        revokeOffline();
        if (!userId) clearAuthCallbackState();
        ++profileRequest.current;
        currentUser.current = userId;
        setProfile(null);
        setProfileLoading(!!userId);
        setError(null);
      }
      setSession(next);
      setInitializing(false);
    };
    const restore = async (version: number) => {
      try {
        const result = await client.auth.getSession();
        if (!mounted || signingOut.current || eventVersion !== version) return;
        const restored =
          result.data.session ?? (result.error ? await recovery.recover(result.error) : null);
        if (!mounted || signingOut.current || eventVersion !== version) return;
        if (result.data.session) recovery.accept(result.data.session);
        if (!restored && result.error) throw result.error;
        applySession(restored);
      } catch {
        if (!mounted || signingOut.current || eventVersion !== version) return;
        applySession(null);
        setError(
          'Unable to restore your session. Reconnect and sign in again. Retained drafts remain on this device.',
        );
      }
    };
    // Remain synchronous. INITIAL_SESSION(null) may mean an expired offline session;
    // inspect the SDK failure/storage only after its callback and Auth lock return.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      const version = ++eventVersion;
      if (signingOut.current) {
        recovery.revoke();
        return;
      }
      if (next) {
        recovery.accept(next);
        applySession(next);
      } else if (event === 'INITIAL_SESSION') {
        void Promise.resolve().then(() => restore(version));
      } else {
        recovery.revoke();
        applySession(null);
      }
    });
    const startedAt = eventVersion;
    void restore(startedAt);
    const invalidateProfileRequest = () => {
      ++profileRequest.current;
    };
    return () => {
      mounted = false;
      recovery.revoke();
      invalidateProfileRequest();
      subscription.unsubscribe();
    };
  }, [client]);

  // Profile requests run after React commits, outside onAuthStateChange's lock.
  const userId = session?.user.id;
  useEffect(() => {
    void refreshProfile();
  }, [userId, session?.access_token, refreshProfile]);

  useEffect(() => {
    if (supabaseSetupError) return;
    if (Platform.OS === 'web') return;
    const update = (state: string | null | undefined) => {
      if (state === 'active') {
        void client.auth.startAutoRefresh();
        void refreshProfile();
      } else void client.auth.stopAutoRefresh();
    };
    update(AppState.currentState);
    const listener = AppState.addEventListener('change', update);
    return () => {
      listener.remove();
      void client.auth.stopAutoRefresh();
    };
  }, [refreshProfile, client]);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    revokeLocalSession(client);
    revokeOffline();
    ++profileRequest.current;
    setError(null);
    // Revoke local storage even when an expired token cannot refresh offline.
    // The connection reset fences old in-flight refresh writes before deleting
    // its secure namespace; it preserves the selected App URL and local drafts.
    const reset = await connection.resetSession();
    if (!reset || isCurrentClient(client)) {
      setError('Unable to clear this device session. Unlock the device and retry.');
      throw Error('Unable to clear this device session.');
    }
    clearAuthCallbackState();
  }, [client, connection]);

  return (
    <AuthContext.Provider
      value={{
        client,
        session,
        profile,
        loading: initializing || profileLoading,
        error,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}

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
import { supabase, supabaseSetupError } from '../lib/supabase';
import { clearAuthCallbackState, retainedAuthProfile } from '../lib/auth-callback';
import { AccessUnavailableError } from '../lib/online';

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
  const [client] = useState(() => supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(!supabaseSetupError);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(supabaseSetupError);
  const currentUser = useRef<string | null>(null);
  const profileRequest = useRef(0);

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
      const { data, error: readError } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (request !== profileRequest.current || currentUser.current !== userId) return;
      if (readError) throw readError;
      if (!data) throw new AccessUnavailableError();
      setProfile(data.is_active ? data : null);
      setError(data.is_active ? null : 'Your account is inactive. Contact your administrator.');
    } catch (failure) {
      if (request !== profileRequest.current || currentUser.current !== userId) return;
      setProfile((previous) => retainedAuthProfile(previous, userId, failure));
      setError('Unable to refresh your account. Check your connection and retry.');
    } finally {
      if (request === profileRequest.current) setProfileLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (supabaseSetupError) return;
    let mounted = true;
    let eventVersion = 0;
    const applySession = (next: Session | null) => {
      if (!mounted) return;
      const userId = next?.user.id ?? null;
      if (currentUser.current !== userId) {
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
    // This callback must remain synchronous: SDK calls here can deadlock Auth's lock.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      ++eventVersion;
      applySession(next);
    });
    const startedAt = eventVersion;
    void client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!mounted || eventVersion !== startedAt) return;
        if (sessionError) throw sessionError;
        applySession(data.session);
      })
      .catch(() => {
        if (!mounted || eventVersion !== startedAt) return;
        setError(
          'Unable to restore your session. Sign in again, or unlock this device and restart the app.',
        );
        setInitializing(false);
      });
    const invalidateProfileRequest = () => {
      ++profileRequest.current;
    };
    return () => {
      mounted = false;
      invalidateProfileRequest();
      subscription.unsubscribe();
    };
  }, [client]);

  // Profile requests run after React commits, outside onAuthStateChange's lock.
  const userId = session?.user.id;
  useEffect(() => {
    void refreshProfile();
  }, [userId, refreshProfile]);

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
    const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
    if (signOutError) {
      setError('Unable to sign out. Please retry.');
      throw new Error('Unable to sign out. Please retry.');
    }
    ++profileRequest.current;
    clearAuthCallbackState();
    currentUser.current = null;
    setSession(null);
    setProfile(null);
    setProfileLoading(false);
    setError(null);
  }, [client]);

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

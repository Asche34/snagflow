import type { Session } from '@supabase/supabase-js';

type RecoveryDependencies = {
  namespace: () => string | null;
  active: () => boolean;
  readStored: () => Promise<unknown>;
  profile: (userId: string) => Promise<{ id: string; is_active: boolean } | null>;
};
export function retryableRefreshFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; status?: number };
  return (
    e.name === 'AuthRetryableFetchError' &&
    (e.status === undefined || e.status === 0 || e.status === 429 || e.status >= 500)
  );
}
function retainedSession(value: unknown): Session | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as Partial<Session>;
  if (
    typeof s.access_token !== 'string' ||
    !s.access_token ||
    typeof s.refresh_token !== 'string' ||
    !s.refresh_token ||
    typeof s.expires_at !== 'number' ||
    !Number.isFinite(s.expires_at) ||
    !s.user ||
    typeof s.user.id !== 'string' ||
    !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(s.user.id)
  )
    return null;
  return s as Session;
}

/** Retains an identity for local data only. It never refreshes, saves or authorizes a JWT. */
export class OfflineSessionRecovery {
  private generation = 0;
  private revoked = false;
  private session: Session | null = null;
  constructor(
    readonly namespace: string,
    private dependencies: RecoveryDependencies,
  ) {}
  private active() {
    return (
      !this.revoked &&
      this.dependencies.active() &&
      this.dependencies.namespace() === this.namespace
    );
  }
  accept(_session: Session) {
    this.generation++;
    this.revoked = false;
    this.session = null;
  }
  revoke() {
    this.generation++;
    this.revoked = true;
    this.session = null;
  }
  local(userId?: string): Session | null {
    return this.active() && this.session && (!userId || this.session.user.id === userId)
      ? this.session
      : null;
  }
  async recover(error: unknown, expectedUser?: string): Promise<Session | null> {
    if (!retryableRefreshFailure(error)) {
      this.revoke();
      return null;
    }
    if (!this.active()) return null;
    const generation = this.generation;
    const stored = retainedSession(await this.dependencies.readStored());
    if (
      !stored ||
      (expectedUser && stored.user.id !== expectedUser) ||
      !this.active() ||
      generation !== this.generation
    )
      return null;
    const profile = await this.dependencies.profile(stored.user.id);
    if (
      !this.active() ||
      generation !== this.generation ||
      profile?.id !== stored.user.id ||
      !profile.is_active
    )
      return null;
    this.session = stored;
    return stored;
  }
}

const recoveries = new WeakMap<object, OfflineSessionRecovery>();
export function registerOfflineSession(client: object, recovery: OfflineSessionRecovery) {
  recoveries.get(client)?.revoke();
  recoveries.set(client, recovery);
}
export function localSessionFor(client: object, userId?: string) {
  return recoveries.get(client)?.local(userId) ?? null;
}
export function revokeLocalSession(client: object) {
  recoveries.get(client)?.revoke();
}
export function acceptOnlineSession(client: object, session: Session) {
  recoveries.get(client)?.accept(session);
}
export async function recoverLocalSession(client: object, error: unknown, userId?: string) {
  return (await recoveries.get(client)?.recover(error, userId)) ?? null;
}

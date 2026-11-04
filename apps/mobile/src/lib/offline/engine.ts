import type { Row } from '../data';
import type { Persistence } from './store';
import type { QueuedPhoto } from '../photos';

export type Mirror = {
  synced_at: string;
  project: Row<'projects'>;
  members: (Row<'project_members'> & {
    profiles: Pick<Row<'profiles'>, 'id' | 'full_name' | 'email' | 'is_active'> | null;
  })[];
  locations: Row<'locations'>[];
  categories: Row<'categories'>[];
  snags: Row<'snags'>[];
  photos: Row<'snag_photos'>[];
  comments: Row<'comments'>[];
  activity: Row<'activity_log'>[];
};
export type OfflineOperation = {
  id: string;
  projectId: string;
  snagId: string;
  kind: 'create' | 'edit' | 'comment' | 'transition' | 'assign' | 'photos' | 'annotation';
  payload: Record<string, unknown>;
  expectedUpdatedAt: string | null;
  photos?: QueuedPhoto[];
  state: 'queued' | 'attention';
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  error?: string;
};
export type OfflineState = {
  version: 1;
  mirrors: Record<string, Mirror>;
  drafts: Record<string, unknown>;
  queue: OfflineOperation[];
  profile: Row<'profiles'> | null;
  lastSynced: string | null;
  files?: Record<
    string,
    { originalUri: string; flattenedUri?: string; annotatedPath?: string | null }
  >;
};
export function transientFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const e = error as { code?: string; message?: string; status?: number } | null;
  if (!e) return false;
  if (e.status === 429 || (e.status ?? 0) >= 500 || /^(429|5\d\d)$/.test(e.code ?? '')) return true;
  if (
    /conflict|forbidden|different.*bytes|identity|incomplete|already has 8|SNAG_PHOTO_LIMIT/i.test(
      e.message ?? '',
    )
  )
    return false;
  return /network|failed to fetch|fetch failed|timeout|timed out|connection|interrupted|gateway|internal server|unexpected.*(json|token)|invalid json|503|502|429/i.test(
    e.message ?? '',
  );
}
export function definitiveConflict(message: string | undefined): boolean {
  return /OFFLINE_CONFLICT|OFFLINE_FIELD_CONFLICT|Newer server values kept|ANNOTATION_CONFLICT|Someone saved newer markup/i.test(
    message ?? '',
  );
}
export function failureMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'This change needs review. Retry or discard it.';
}
export class OfflineEngine {
  state: OfflineState = {
    version: 1,
    mirrors: {},
    drafts: {},
    queue: [],
    profile: null,
    lastSynced: null,
  };
  private pending: Promise<unknown> = Promise.resolve();
  private flushing = false;
  onChange: () => void = () => {};
  constructor(
    private persistence: Persistence,
    readonly scope: string,
  ) {}
  async load() {
    const saved = await this.persistence.read(this.scope);
    if (saved) {
      if (saved.version !== 1)
        throw Error('Offline data needs a compatible SnagFlow version. Your data is retained.');
      this.state = saved;
    }
    this.onChange();
  }
  change(update: (state: OfflineState) => void): Promise<void> {
    const task = this.pending.then(async () => {
      const next = JSON.parse(JSON.stringify(this.state)) as OfflineState;
      update(next);
      await this.persistence.write(this.scope, next);
      this.state = next;
      this.onChange();
    });
    this.pending = task.catch(() => {});
    return task;
  }
  setDraft(key: string, value: unknown) {
    return this.change((s) => {
      if (value === undefined) delete s.drafts[key];
      else s.drafts[key] = value;
    });
  }
  enqueue(op: OfflineOperation) {
    return this.change((s) => {
      const previous = s.queue.find((q) => q.id === op.id);
      if (previous) {
        if (JSON.stringify(previous.payload) !== JSON.stringify(op.payload))
          throw Error(
            'This retry identity belongs to different details. Review queued work first.',
          );
      } else s.queue.push(op);
    });
  }
  discard(id: string) {
    return this.change((s) => {
      s.queue = s.queue.filter((q) => q.id !== id);
    });
  }
  retry(id: string, expectedUpdatedAt?: string) {
    return this.change((s) => {
      const q = s.queue.find((q) => q.id === id);
      if (q) {
        q.state = 'queued';
        q.error = undefined;
        q.nextAttemptAt = 0;
        if (expectedUpdatedAt) q.expectedUpdatedAt = expectedUpdatedAt;
      }
    });
  }
  async flush(
    execute: (op: OfflineOperation) => Promise<void>,
    active: () => boolean,
    now = Date.now(),
  ) {
    if (this.flushing) return;
    this.flushing = true;
    const blocked = new Set<string>();
    try {
      for (const queued of [...this.state.queue]) {
        if (!active()) return;
        const op = this.state.queue.find((q) => q.id === queued.id);
        if (!op) continue;
        if (blocked.has(op.snagId)) continue;
        if (op.state === 'attention' || op.nextAttemptAt > now) {
          blocked.add(op.snagId);
          continue;
        }
        try {
          await execute(op);
          if (!active()) return;
          await this.discard(op.id);
        } catch (error) {
          if (!active()) return;
          blocked.add(op.snagId);
          await this.change((s) => {
            const q = s.queue.find((q) => q.id === op.id);
            if (!q) return;
            q.attempts++;
            q.error = failureMessage(error);
            q.state = transientFailure(error) ? 'queued' : 'attention';
            q.nextAttemptAt = now + Math.min(300000, 2000 * 2 ** Math.min(8, q.attempts - 1));
          });
        }
      }
    } finally {
      this.flushing = false;
    }
  }
}

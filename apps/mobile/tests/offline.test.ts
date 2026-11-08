import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OfflineEngine, type OfflineOperation } from '../src/lib/offline/engine';
import { SqlitePersistence, type SqlDatabase } from '../src/lib/offline/store';

const require = createRequire(import.meta.url);
// Node24 supplies real SQLite; this structural type matches the small production SQL boundary.
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      run: (...params: (string | number | null)[]) => unknown;
      all: (...params: (string | number | null)[]) => unknown[];
      get: (...params: (string | number | null)[]) => unknown;
    };
    close: () => void;
  };
};
function database(path: string) {
  const db = new DatabaseSync(path);
  const adapter: SqlDatabase = {
    execAsync: async (sql) => db.exec(sql),
    runAsync: async (sql, ...args) => {
      db.prepare(sql).run(...args);
    },
    getFirstAsync: async <T>(sql: string, ...args: (string | number | null)[]) =>
      (db.prepare(sql).get(...args) ?? null) as T | null,
    getAllAsync: async <T>(sql: string, ...args: (string | number | null)[]) =>
      db.prepare(sql).all(...args) as T[],
  };
  return { adapter, close: () => db.close() };
}
const operation = (id = 'operation'): OfflineOperation => ({
  id,
  projectId: 'project',
  snagId: 'snag',
  kind: 'comment',
  payload: { body: 'Retain me' },
  expectedUpdatedAt: null,
  state: 'queued',
  attempts: 0,
  nextAttemptAt: 0,
  createdAt: 1,
});
describe('durable offline outbox', () => {
  it('reopens actual SQLite with draft, photo identity and pending operation intact, isolated by scope', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'snagflow-offline-'));
    const path = join(dir, 'offline.sqlite');
    let db = database(path);
    try {
      const first = new OfflineEngine(new SqlitePersistence(db.adapter), 'deploy-A:user-A');
      await first.load();
      await first.setDraft('capture:project', {
        clientId: 'stable',
        photos: [
          {
            id: 'photo',
            originalUri: 'documents/original.jpg',
            flattenedUri: 'documents/marked.jpg',
          },
        ],
      });
      await first.enqueue(operation());
      db.close();
      db = database(path);
      const restarted = new OfflineEngine(new SqlitePersistence(db.adapter), 'deploy-A:user-A');
      await restarted.load();
      expect(restarted.state.queue[0]).toEqual(operation());
      expect(restarted.state.drafts['capture:project']).toMatchObject({ clientId: 'stable' });
      for (const scope of ['deploy-B:user-A', 'deploy-A:user-B']) {
        const other = new OfflineEngine(new SqlitePersistence(db.adapter), scope);
        await other.load();
        expect(other.state.queue).toEqual([]);
        expect(other.state.drafts).toEqual({});
      }
    } finally {
      db.close();
      rmSync(dir, { recursive: true });
    }
  });
  it('retries the same identity after an interrupted upload, backing off and never duplicating queued work', async () => {
    const db = database(':memory:');
    try {
      const engine = new OfflineEngine(new SqlitePersistence(db.adapter), 'scope');
      await engine.load();
      await engine.enqueue(operation());
      await engine.enqueue(operation());
      let attempts = 0;
      const run = async (op: OfflineOperation) => {
        expect(op.id).toBe('operation');
        if (++attempts === 1) throw new TypeError('Network request failed');
      };
      await engine.flush(run, () => true, 1000);
      expect(engine.state.queue).toHaveLength(1);
      expect(engine.state.queue[0]!.attempts).toBe(1);
      await engine.flush(run, () => true, 1001);
      expect(attempts).toBe(1);
      await engine.flush(run, () => true, 999999);
      expect(engine.state.queue).toEqual([]);
    } finally {
      db.close();
    }
  });
  it('retains conflict intent for attention and blocks dependent operations until retry/discard', async () => {
    const db = database(':memory:');
    try {
      const engine = new OfflineEngine(new SqlitePersistence(db.adapter), 'scope');
      await engine.load();
      await engine.enqueue(operation('first'));
      await engine.enqueue(operation('second'));
      const seen: string[] = [];
      await engine.flush(
        async (op) => {
          seen.push(op.id);
          throw { code: 'P0001', message: 'OFFLINE_CONFLICT: status changed' };
        },
        () => true,
      );
      expect(seen).toEqual(['first']);
      expect(engine.state.queue[0]!.state).toBe('attention');
      expect(engine.state.queue[0]!.error).toContain('OFFLINE_CONFLICT');
      await engine.discard('first');
      await engine.flush(
        async (op) => {
          seen.push(op.id);
        },
        () => true,
      );
      expect(seen).toEqual(['first', 'second']);
      expect(engine.state.queue).toEqual([]);
    } finally {
      db.close();
    }
  });
  it('stops subsequent requests and ignores completion after account/deployment revocation', async () => {
    const db = database(':memory:');
    try {
      const engine = new OfflineEngine(new SqlitePersistence(db.adapter), 'scope');
      await engine.load();
      await engine.enqueue(operation('first'));
      await engine.enqueue(operation('second'));
      let active = true;
      const seen: string[] = [];
      await engine.flush(
        async (op) => {
          seen.push(op.id);
          active = false;
        },
        () => active,
      );
      expect(seen).toEqual(['first']);
      expect(engine.state.queue).toHaveLength(2);
      await engine.flush(
        async (op) => {
          seen.push(op.id);
        },
        () => true,
      );
      expect(engine.state.queue).toEqual([]);
    } finally {
      db.close();
    }
  });
});

import type { OfflineOperation, OfflineState } from './engine';

export interface Persistence {
  read(scope: string): Promise<OfflineState | null>;
  write(scope: string, state: OfflineState): Promise<void>;
}
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
}
/** SQL parameters bind every account/deployment value. A crash commits both mirror and outbox or neither. */
export class SqlitePersistence implements Persistence {
  private ready: Promise<void>;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private db: SqlDatabase) {
    this.ready = db.execAsync(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS offline_state(scope TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outbox(scope TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(scope,id));`);
  }
  async read(scope: string): Promise<OfflineState | null> {
    await this.ready;
    await this.pending;
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM offline_state WHERE scope=?',
      scope,
    );
    if (!row) return null;
    const queue = await this.db.getAllAsync<{ value: string }>(
      'SELECT value FROM outbox WHERE scope=? ORDER BY rowid',
      scope,
    );
    return {
      ...(JSON.parse(row.value) as OfflineState),
      queue: queue.map((r) => JSON.parse(r.value) as OfflineOperation),
    };
  }
  write(scope: string, state: OfflineState): Promise<void> {
    const task = this.pending.then(async () => {
      await this.ready;
      await this.db.execAsync('BEGIN IMMEDIATE');
      try {
        await this.db.runAsync(
          'INSERT OR REPLACE INTO offline_state(scope,value) VALUES(?,?)',
          scope,
          JSON.stringify({ ...state, queue: [] }),
        );
        await this.db.runAsync('DELETE FROM outbox WHERE scope=?', scope);
        for (const op of state.queue)
          await this.db.runAsync(
            'INSERT INTO outbox(scope,id,value) VALUES(?,?,?)',
            scope,
            op.id,
            JSON.stringify(op),
          );
        await this.db.execAsync('COMMIT');
      } catch (error) {
        await this.db.execAsync('ROLLBACK');
        throw error;
      }
    });
    this.pending = task.catch(() => {});
    return task;
  }
}

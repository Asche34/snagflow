import type { Persistence } from './store';
import type { OfflineState } from './engine';
/** The native build resolves persistence.native.ts (SQLite). Browser previews use IndexedDB. */
let instance: Promise<Persistence> | undefined;
export function persistence(): Promise<Persistence> {
  return (instance ??= new Promise((resolve, reject) => {
    const open = indexedDB.open('snagflow-offline-v1', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('scopes');
    open.onerror = () =>
      reject(Error('Local storage is unavailable. Enable device storage and retry.'));
    open.onsuccess = () => {
      const db = open.result;
      resolve({
        read: (scope) =>
          new Promise((done, fail) => {
            const tx = db.transaction('scopes', 'readonly');
            const read = tx.objectStore('scopes').get(scope);
            tx.oncomplete = () => done((read.result as OfflineState | undefined) ?? null);
            tx.onerror = () => fail(tx.error);
          }),
        write: (scope, state) =>
          new Promise((done, fail) => {
            const tx = db.transaction('scopes', 'readwrite');
            tx.objectStore('scopes').put(state, scope);
            tx.oncomplete = () => done();
            tx.onerror = () => fail(tx.error);
            tx.onabort = () => fail(tx.error ?? Error('Local save interrupted.'));
          }),
      });
    };
  }));
}

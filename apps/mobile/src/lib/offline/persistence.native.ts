import { openDatabaseAsync } from 'expo-sqlite';
import { SqlitePersistence } from './store';
let instance: Promise<SqlitePersistence> | undefined;
export function persistence() {
  return (instance ??= openDatabaseAsync('snagflow-offline-v1.db').then(
    (db) => new SqlitePersistence(db),
  ));
}

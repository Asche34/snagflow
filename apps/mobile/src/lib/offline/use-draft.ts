import { useCallback, useState } from 'react';
import { useOffline } from '../../providers/offline';
/** Mount under a route/account key so a restored field cannot carry to another record. */
export function useDurableDraft<T>(key: string, fallback: T) {
  const offline = useOffline();
  const [value, update] = useState<T>(
    () => (offline?.engine.state.drafts[key] as T | undefined) ?? fallback,
  );
  const [error, setError] = useState<string | null>(null);
  const set = useCallback(
    (next: T) => {
      update(next);
      void offline?.engine
        .setDraft(key, next)
        .then(() => setError(null))
        .catch(() => setError('Draft could not be retained on this device. Retry before leaving.'));
    },
    [offline, key],
  );
  return [value, set, error] as const;
}

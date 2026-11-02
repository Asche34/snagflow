export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type Manifest = { version: 1; generation: string; count: number };

function readManifest(value: string | null): Manifest | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Partial<Manifest>;
    return candidate.version === 1 &&
      typeof candidate.generation === 'string' &&
      /^[a-z0-9]+$/.test(candidate.generation) &&
      Number.isInteger(candidate.count) &&
      candidate.count! > 0 &&
      candidate.count! <= 1000
      ? (candidate as Manifest)
      : null;
  } catch {
    return null;
  }
}

/** Every native value stays below 2KB, including non-ASCII profile metadata. */
export function createChunkedStorage(backend: SessionStorage): SessionStorage {
  let pending: Promise<unknown> = Promise.resolve();
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation, operation);
    pending = result.catch(() => {});
    return result;
  }
  const fragmentKey = (key: string, manifest: Manifest, index: number) =>
    `${key}.v1.${manifest.generation}.${index}`;
  async function clearFragments(key: string, manifest: Manifest | null) {
    if (!manifest) return;
    await Promise.all(
      Array.from({ length: manifest.count }, (_, index) =>
        backend.removeItem(fragmentKey(key, manifest, index)),
      ),
    );
  }
  return {
    getItem: (key) =>
      serial(async () => {
        const raw = await backend.getItem(key);
        const manifest = readManifest(raw);
        if (!manifest) return null;
        const fragments = await Promise.all(
          Array.from({ length: manifest.count }, (_, index) =>
            backend.getItem(fragmentKey(key, manifest, index)),
          ),
        );
        return fragments.some((value) => value === null) ? null : fragments.join('');
      }),
    setItem: (key, value) =>
      serial(async () => {
        // Keep Unicode code points whole across native UTF-8 storage boundaries.
        const chunks: string[] = [];
        let chunk = '';
        for (const character of value) {
          if (chunk.length + character.length > 400) {
            chunks.push(chunk);
            chunk = '';
          }
          chunk += character;
        }
        chunks.push(chunk);
        const count = chunks.length;
        if (count > 1000) throw new Error('Session exceeds secure storage capacity.');
        const previous = readManifest(await backend.getItem(key));
        const next: Manifest = {
          version: 1,
          generation: `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
          count,
        };
        try {
          for (let index = 0; index < count; index++) {
            await backend.setItem(fragmentKey(key, next, index), chunks[index]);
          }
          // Publish last: failed writes never replace the last complete session.
          await backend.setItem(key, JSON.stringify(next));
        } catch (error) {
          await clearFragments(key, next).catch(() => {});
          throw error;
        }
        await clearFragments(key, previous);
      }),
    removeItem: (key) =>
      serial(async () => {
        const previous = readManifest(await backend.getItem(key));
        await backend.removeItem(key);
        await clearFragments(key, previous);
      }),
  };
}

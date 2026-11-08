import type { QueuedPhoto } from '../photos';
export async function retainRemote(_scope: string, uri: string, _id: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const r = await fetch(uri);
  if (!r.ok) throw Error('Photo could not be retained. Retry before leaving capture.');
  const blob = await r.blob();
  if (blob.size > 20 * 1024 * 1024) throw Error('This photo is too large to retain.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
/** Persist browser blob URLs as durable data URLs; native builds copy into Paths.document. */
export async function persistPhotos(_scope: string, photos: QueuedPhoto[]): Promise<QueuedPhoto[]> {
  async function durable(uri: string) {
    return retainRemote(_scope, uri, '');
  }
  return Promise.all(
    photos.map(async (p) => ({
      ...p,
      originalUri: await durable(p.originalUri),
      thumbnailUri: await durable(p.thumbnailUri),
      ...(p.flattenedUri ? { flattenedUri: await durable(p.flattenedUri) } : {}),
    })),
  );
}

import { Directory, File, Paths } from 'expo-file-system';
import type { QueuedPhoto } from '../photos';
function directory(scope: string) {
  if (!/^[a-zA-Z0-9.:-]+$/.test(scope)) throw Error('Invalid offline account identity.');
  const dir = new Directory(Paths.document, 'offline', scope.replace(/:/g, '_'));
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}
export async function retainRemote(scope: string, uri: string, id: string): Promise<string> {
  if (!/^https?:/.test(uri)) return uri;
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Error('Invalid photo identity.');
  const dir = directory(scope);
  const dest = new File(dir, `${id}.jpg`);
  if (dest.exists && dest.size) return dest.uri;
  const temp = new File(dir, `${id}.download`);
  if (temp.exists) temp.delete();
  const downloaded = await File.downloadFileAsync(uri, temp);
  if (!downloaded.size || downloaded.size > 20 * 1024 * 1024) {
    downloaded.delete();
    throw Error('Private photo is unavailable or too large.');
  }
  downloaded.move(dest);
  return dest.uri;
}
export async function persistPhotos(scope: string, photos: QueuedPhoto[]): Promise<QueuedPhoto[]> {
  const dir = directory(scope);
  function copy(uri: string, id: string) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Error('Invalid photo identity.');
    const source = new File(uri);
    const dest = new File(dir, `${id}.jpg`);
    if (source.uri === dest.uri) return uri;
    if (!source.exists || !source.size)
      throw Error('The photo file is unavailable. Keep this draft and choose the photo again.');
    if (dest.exists) {
      if (dest.size !== source.size)
        throw Error('A retained photo is incomplete. Choose the photo again.');
      return dest.uri;
    }
    const temp = new File(dir, `${id}.partial`);
    if (temp.exists) temp.delete();
    source.copy(temp);
    if (temp.size !== source.size) {
      temp.delete();
      throw Error('Photo copy interrupted. Retry before leaving capture.');
    }
    temp.move(dest);
    return dest.uri;
  }
  return photos.map((p) => ({
    ...p,
    originalUri: copy(p.originalUri, p.id),
    thumbnailUri: copy(p.thumbnailUri, p.thumbnailId),
    ...(p.flattenedUri && p.annotationId
      ? { flattenedUri: copy(p.flattenedUri, p.annotationId) }
      : {}),
  }));
}

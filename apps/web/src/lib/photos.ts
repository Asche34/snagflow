'use client';
import type { PhotoKind } from '@snagflow/shared';
import { registerSnagPhoto } from '@/app/(app)/snags/photo-actions';
import { createClient } from './supabase/browser';

export type PhotoStatus = 'queued' | 'preparing' | 'uploading' | 'saving' | 'done' | 'error';
export type QueuedPhoto = {
  id: string;
  thumbnailId: string;
  file: File;
  kind: PhotoKind;
  status: PhotoStatus;
  error?: string;
};
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function preparePhoto(file: File) {
  if (!PHOTO_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_PHOTO_BYTES)
    throw new Error('Choose a JPEG, PNG or WebP image up to 20 MiB.');
  // The browser applies EXIF orientation during decoding; preserve its aspect ratio.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  async function resized(longest: number) {
    const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('This image could not be resized.'))),
        'image/jpeg',
        0.8,
      ),
    );
    return { blob, width: canvas.width, height: canvas.height };
  }
  try {
    const original = await resized(1600);
    const thumbnail = await resized(400);
    const modified = new Date(file.lastModified || Date.now());
    return {
      original: original.blob,
      thumbnail: thumbnail.blob,
      width: original.width,
      height: original.height,
      takenAt: modified.toISOString(),
    };
  } finally {
    bitmap.close();
  }
}

export async function uploadPhotos(
  projectId: string,
  snagId: string,
  items: QueuedPhoto[],
  onChange: (items: QueuedPhoto[]) => void,
  sortOffset = 0,
): Promise<QueuedPhoto[]> {
  const updated = items.map((item) => ({ ...item }));
  const supabase = createClient();
  for (let index = 0; index < updated.length; index++) {
    const item = updated[index]!;
    if (item.status === 'done') continue;
    const status = (next: PhotoStatus, error?: string) => {
      updated[index] = { ...item, status: next, ...(error ? { error } : {}) };
      onChange([...updated]);
    };
    try {
      status('preparing');
      const prepared = await preparePhoto(item.file);
      status('uploading');
      const prefix = `${projectId}/${snagId}`;
      for (const [id, blob] of [
        [item.id, prepared.original],
        [item.thumbnailId, prepared.thumbnail],
      ] as const) {
        const { error } = await supabase.storage
          .from('snag-photos')
          .upload(`${prefix}/${id}.jpg`, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw new Error('Upload interrupted. Check your connection and retry.');
      }
      status('saving');
      const registered = await registerSnagPhoto({
        id: item.id,
        thumbnailId: item.thumbnailId,
        snagId,
        kind: item.kind,
        width: prepared.width,
        height: prepared.height,
        takenAt: prepared.takenAt,
        sortOrder: Math.min(sortOffset + index, 7),
      });
      if (registered.error) throw new Error(registered.error);
      status('done');
    } catch (error) {
      status(
        'error',
        error instanceof Error ? error.message : 'This photo could not be uploaded. Try again.',
      );
    }
  }
  return updated;
}

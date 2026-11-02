'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AnnotationDocumentSchema } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';

const SaveSchema = z.object({
  photoId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i),
  document: AnnotationDocumentSchema,
}).strict();

export async function refreshPhotoAnnotation(photoId: string) {
  if (!z.string().uuid().safeParse(photoId).success) return { error: 'This photo is unavailable.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in again to view this photo.' };
  const { data: photo } = await supabase.from('snag_photos').select('*').eq('id', photoId).maybeSingle();
  if (!photo) return { error: 'This photo is unavailable or your access has changed.' };
  const [original, annotated] = await Promise.all([
    supabase.storage.from('snag-photos').createSignedUrl(photo.storage_path, 300),
    supabase.storage.from('snag-photos').createSignedUrl(photo.annotated_path ?? photo.storage_path, 300),
  ]);
  if (!original.data || !annotated.data) return { error: 'The photo could not be loaded. Check your connection and retry.' };
  return { photo, originalUrl: original.data.signedUrl, annotatedUrl: annotated.data.signedUrl };
}

export async function savePhotoAnnotation(input: unknown) {
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { error: 'The markup is invalid or too large. Simplify your draft and retry.' };
  const { photoId, expectedUpdatedAt, path, document } = parsed.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in again before saving markup. Your draft is retained.' };
  const { data: photo } = await supabase.from('snag_photos').select('snag_id,width,height').eq('id', photoId).maybeSingle();
  if (!photo) return { error: 'The photo is unavailable or your access has changed. Your draft is retained.' };
  const { data: snag } = await supabase.from('snags').select('project_id').eq('id', photo.snag_id).is('deleted_at', null).maybeSingle();
  if (!snag || !path.startsWith(`${snag.project_id}/${photo.snag_id}/`) || document.width !== photo.width || document.height !== photo.height) {
    return { error: 'The markup does not match this photo. Your draft is retained.' };
  }
  const object = await supabase.storage.from('snag-photos').info(path);
  if (object.error || !object.data || object.data.contentType !== 'image/jpeg' || !object.data.size || object.data.size > 20 * 1024 * 1024) {
    return { error: 'The annotated image is not ready. Retry saving your retained draft.' };
  }
  const { data, error } = await supabase.rpc('save_photo_annotation', {
    p_photo_id: photoId,
    p_expected_updated_at: expectedUpdatedAt,
    p_annotated_path: path,
    p_annotation_json: document,
  });
  if (error) {
    if (error.message.includes('ANNOTATION_CONFLICT')) {
      const latest = await refreshPhotoAnnotation(photoId);
      return { error: 'Someone saved newer markup. Your draft is retained. Review the latest image before replacing its markup.', conflict: latest.photo ? { updatedAt: latest.photo.updated_at, url: latest.annotatedUrl } : undefined };
    }
    return { error: 'Markup was not confirmed saved. Check your access and connection, then retry your retained draft.' };
  }
  revalidatePath(`/snags/${photo.snag_id}`);
  return { updatedAt: data.updated_at };
}

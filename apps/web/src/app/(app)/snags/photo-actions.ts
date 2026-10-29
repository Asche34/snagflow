'use server';
import { revalidatePath } from 'next/cache';
import { SnagPhotoCreateSchema, canAct } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';

export async function registerSnagPhoto(input: unknown): Promise<{ error?: string; ok?: boolean }> {
  const parsed = SnagPhotoCreateSchema.safeParse(input);
  if (!parsed.success) return { error: 'The photo details are invalid. Choose the image again.' };
  const photo = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in again before saving photos.' };
  const [{ data: snag }, { data: profile }] = await Promise.all([
    supabase
      .from('snags')
      .select('id,project_id')
      .eq('id', photo.snagId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase.from('profiles').select('is_admin,is_active').eq('id', user.id).maybeSingle(),
  ]);
  if (!snag || !profile?.is_active) return { error: 'You no longer have access to this snag.' };
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', snag.project_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (
    !canAct({ id: user.id, isAdmin: profile.is_admin }, membership?.role ?? null, 'snag:add-photo')
  )
    return { error: 'You cannot add photos to this project.' };
  const path = `${snag.project_id}/${snag.id}/${photo.id}.jpg`;
  const thumbnail = `${snag.project_id}/${snag.id}/${photo.thumbnailId}.jpg`;
  const same = (row: {
    snag_id: string;
    storage_path: string;
    thumb_path: string | null;
    kind: string;
    uploaded_by: string;
  }) =>
    row.snag_id === snag.id &&
    row.storage_path === path &&
    row.thumb_path === thumbnail &&
    row.kind === photo.kind &&
    row.uploaded_by === user.id;
  const existing = await supabase
    .from('snag_photos')
    .select('snag_id,storage_path,thumb_path,kind,uploaded_by')
    .eq('id', photo.id)
    .maybeSingle();
  if (existing.data)
    return same(existing.data)
      ? { ok: true }
      : { error: 'This photo identity is already in use. Choose the image again.' };
  const objects = await Promise.all(
    [path, thumbnail].map((objectPath) => supabase.storage.from('snag-photos').info(objectPath)),
  );
  if (
    objects.some(
      (object) =>
        object.error ||
        !object.data ||
        object.data.contentType !== 'image/jpeg' ||
        !object.data.size ||
        object.data.size > 20 * 1024 * 1024,
    )
  )
    return { error: 'The uploaded image is not ready. Retry this photo.' };
  const { error } = await supabase
    .from('snag_photos')
    .insert({
      id: photo.id,
      snag_id: snag.id,
      storage_path: path,
      thumb_path: thumbnail,
      kind: photo.kind,
      width: photo.width,
      height: photo.height,
      taken_at: photo.takenAt,
      sort_order: photo.sortOrder,
      uploaded_by: user.id,
    });
  if (error) {
    // Reconcile a committed row before reporting a failed duplicate/concurrent retry.
    const { data: committed } = await supabase
      .from('snag_photos')
      .select('snag_id,storage_path,thumb_path,kind,uploaded_by')
      .eq('id', photo.id)
      .maybeSingle();
    if (committed && same(committed)) return { ok: true };
    return {
      error: error.message.includes('SNAG_PHOTO_LIMIT')
        ? 'This snag already has 8 photos. Refresh before adding more.'
        : 'Photo details were not saved. Check your access and retry.',
    };
  }
  revalidatePath(`/snags/${snag.id}`);
  return { ok: true };
}

import { canAnnotatePhoto } from '@snagflow/shared';
import type { SnagPhoto } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { SnagPhotoUpload } from './snag-photo-upload';
import { PhotoMarkup } from './photo-markup';

export async function SnagPhotos({
  photos,
  projectId,
  snagId,
  canUpload,
}: {
  photos: SnagPhoto[];
  projectId: string;
  snagId: string;
  canUpload: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [profile, membership] = user ? await Promise.all([
    supabase.from('profiles').select('is_admin,is_active').eq('id', user.id).maybeSingle(),
    supabase.from('project_members').select('role').eq('project_id', projectId).eq('user_id', user.id).maybeSingle(),
  ]) : [null, null];
  const signed = await Promise.all(
    photos.map(async (photo) => {
      const [original, displayed, thumbnail] = await Promise.all([
        supabase.storage.from('snag-photos').createSignedUrl(photo.storage_path, 300),
        supabase.storage.from('snag-photos').createSignedUrl(photo.annotated_path ?? photo.storage_path, 300),
        supabase.storage
          .from('snag-photos')
          .createSignedUrl(photo.annotated_path ?? photo.thumb_path ?? photo.storage_path, 300),
      ]);
      return { photo, url: displayed.data?.signedUrl, originalUrl: original.data?.signedUrl, thumbnail: thumbnail.data?.signedUrl };
    }),
  );
  return (
    <div className="space-y-5">
      {photos.length ? (
        <div className="space-y-5">
          {(['issue', 'fix'] as const).map((kind) => {
            const group = signed.filter((item) => item.photo.kind === kind);
            if (!group.length) return null;
            const label = kind === 'issue' ? 'Issue' : 'Fix';
            return (
              <section key={kind} aria-label={`${label} photos`}>
                <h3 className="mb-3 text-sm font-medium">{label} photos</h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {group.map((item, index) => (
                    <li key={item.photo.id}>
                      <PhotoMarkup photo={item.photo} projectId={projectId} label={`${label} photo ${index + 1}`} url={item.url} originalUrl={item.originalUrl} thumbnail={item.thumbnail} canEdit={!!user && !!profile?.data?.is_active && canAnnotatePhoto({ id: user.id, isAdmin: profile.data.is_admin, projectRole: membership?.data?.role ?? null, uploadedBy: item.photo.uploaded_by })} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No photos have been added to this snag.
        </p>
      )}
      {canUpload ? (
        <SnagPhotoUpload projectId={projectId} snagId={snagId} count={photos.length} />
      ) : null}
    </div>
  );
}

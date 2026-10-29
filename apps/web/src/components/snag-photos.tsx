import Image from 'next/image';
import type { SnagPhoto } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { SnagPhotoUpload } from './snag-photo-upload';

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
  const signed = await Promise.all(
    photos.map(async (photo) => {
      const [original, thumbnail] = await Promise.all([
        supabase.storage.from('snag-photos').createSignedUrl(photo.storage_path, 300),
        supabase.storage
          .from('snag-photos')
          .createSignedUrl(photo.thumb_path ?? photo.storage_path, 300),
      ]);
      return { photo, url: original.data?.signedUrl, thumbnail: thumbnail.data?.signedUrl };
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
                      {item.url && item.thumbnail ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Open ${label.toLowerCase()} photo ${index + 1}`}
                        >
                          <Image
                            src={item.thumbnail}
                            alt={`${label} photo ${index + 1}`}
                            width={item.photo.width}
                            height={item.photo.height}
                            unoptimized
                            className="aspect-4/3 h-auto w-full object-cover"
                          />
                        </a>
                      ) : (
                        <p className="flex aspect-4/3 items-center justify-center rounded-lg border bg-muted p-3 text-center text-sm text-muted-foreground">
                          {label} photo {index + 1} is unavailable.
                        </p>
                      )}
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

'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadPhotos, type QueuedPhoto } from '@/lib/photos';
import { PhotoPicker } from './photo-picker';
import { Button } from './ui/button';

export function SnagPhotoUpload({
  projectId,
  snagId,
  count,
}: {
  projectId: string;
  snagId: string;
  count: number;
}) {
  const [items, setItems] = useState<QueuedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const inFlight = useRef(false);
  const router = useRouter();
  const failures = items.some((item) => item.status === 'error');
  const pending = items.some((item) => item.status !== 'done');
  return (
    <div className="space-y-4 border-t pt-5">
      <PhotoPicker
        items={items}
        onChange={setItems}
        existingCount={count}
        disabled={busy || refreshing}
        allowKind
      />
      {pending ? (
        <Button
          type="button"
          disabled={busy || refreshing}
          onClick={async () => {
            if (inFlight.current) return;
            inFlight.current = true;
            setBusy(true);
            try {
              await uploadPhotos(
                projectId,
                snagId,
                items,
                setItems,
                Math.max(0, count - items.filter((item) => item.status === 'done').length),
              );
              startTransition(() => router.refresh());
            } finally {
              inFlight.current = false;
              setBusy(false);
            }
          }}
        >
          {busy ? 'Uploading…' : failures ? 'Retry failed photos' : 'Upload photos'}
        </Button>
      ) : null}
    </div>
  );
}

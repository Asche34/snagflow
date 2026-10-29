'use client';
import { useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { PhotoKind } from '@snagflow/shared';
import { MAX_PHOTO_BYTES, PHOTO_TYPES, type QueuedPhoto } from '@/lib/photos';
import { Button } from './ui/button';
import { useHydrated } from '@/lib/use-hydrated';

const labels = {
  queued: 'Ready to upload',
  preparing: 'Preparing image',
  uploading: 'Uploading image and thumbnail',
  saving: 'Saving photo details',
  done: 'Added',
  error: 'Needs retry',
};
export function PhotoPicker({
  items,
  onChange,
  existingCount = 0,
  disabled = false,
  allowKind = false,
}: {
  items: QueuedPhoto[];
  onChange: (items: QueuedPhoto[]) => void;
  existingCount?: number;
  disabled?: boolean;
  allowKind?: boolean;
}) {
  const id = `${useId()}-${usePathname()}`;
  const hydrated = useHydrated();
  const [kind, setKind] = useState<PhotoKind>('issue');
  const [error, setError] = useState('');
  const remaining = 8 - existingCount - items.filter((item) => item.status !== 'done').length;
  return (
    <div className="min-w-0 space-y-3">
      <div>
        <h2 className="text-base font-semibold">{allowKind ? 'Add photos' : 'Issue photos'}</h2>
        <p id={`${id}-help`} className="mt-1 text-sm text-muted-foreground">
          Up to 8 photos per snag. JPEG, PNG or WebP, up to 20 MiB each. {Math.max(0, remaining)}{' '}
          remaining.
        </p>
      </div>
      {allowKind ? (
        <div className="space-y-2">
          <label htmlFor={`${id}-kind`} className="block text-sm font-medium">
            Photo kind
          </label>
          <select
            id={`${id}-kind`}
            value={kind}
            onChange={(event) => setKind(event.target.value as PhotoKind)}
            disabled={disabled || !hydrated}
            className="min-h-11 max-w-full rounded-md border border-input bg-background px-3 text-base"
          >
            <option value="issue">Issue</option>
            <option value="fix">Fix</option>
          </select>
        </div>
      ) : null}
      <label htmlFor={`${id}-files`} className="block text-sm font-medium">
        Photo files
      </label>
      <input
        id={`${id}-files`}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-describedby={`${id}-help`}
        disabled={disabled || !hydrated}
        className="min-h-11 w-full min-w-0 max-w-full rounded-md border border-input bg-background p-2 text-sm file:mr-3 file:min-h-9 file:rounded file:border-0 file:bg-secondary file:px-3 file:font-medium file:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (
            files.some(
              (file) =>
                !PHOTO_TYPES.includes(file.type) || !file.size || file.size > MAX_PHOTO_BYTES,
            )
          ) {
            setError('Choose JPEG, PNG or WebP images up to 20 MiB each.');
            return;
          }
          if (files.length > remaining) {
            setError('A snag can have at most 8 photos, including those already added.');
            return;
          }
          setError('');
          onChange([
            ...items,
            ...files.map((file) => ({
              id: crypto.randomUUID(),
              thumbnailId: crypto.randomUUID(),
              file,
              kind,
              status: 'queued' as const,
            })),
          ]);
        }}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {items.length ? (
        <ul className="space-y-2" aria-live="polite">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-medium">{item.file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.kind === 'fix' ? 'Fix' : 'Issue'} · {labels[item.status]}
                </p>
                {item.status === 'error' ? (
                  <p className="mt-1 text-sm text-destructive">{item.error}</p>
                ) : null}
              </div>
              {item.status !== 'done' ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => onChange(items.filter((candidate) => candidate.id !== item.id))}
                  aria-label={`Remove ${item.file.name}`}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

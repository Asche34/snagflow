'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnnotationDocumentSchema, type AnnotationDocument } from '@snagflow/shared';
import type { SnagPhoto } from '@/lib/data';
import { createClient } from '@/lib/supabase/browser';
import { refreshPhotoAnnotation, savePhotoAnnotation } from '@/app/(app)/snags/annotation-actions';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

const Editor = dynamic(() => import('./photo-markup-editor'), { ssr: false, loading: () => <p role="status">Loading markup tools…</p> });

export function PhotoMarkup({ photo, projectId, label, url, thumbnail, originalUrl, canEdit }: {
  photo: SnagPhoto; projectId: string; label: string; url?: string; thumbnail?: string; originalUrl?: string; canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [refreshedLinks, setRefreshedLinks] = useState<{ source?: string; url?: string; thumbnail?: string; originalUrl?: string }>();
  const links = refreshedLinks && refreshedLinks.source === url ? refreshedLinks : { url, thumbnail, originalUrl };
  const [failedUrl, setFailedUrl] = useState<string>();
  const imageFailed = !!links.thumbnail && failedUrl === links.thumbnail;
  const [refreshing, setRefreshing] = useState(false);
  const blank: AnnotationDocument = { version: 1, width: photo.width, height: photo.height, objects: [] };
  const [initial] = useState(() => {
    if (!photo.annotation_json) return { document: blank, invalid: false };
    const parsed = JSON.stringify(photo.annotation_json).length <= 256000 ? AnnotationDocumentSchema.safeParse(photo.annotation_json) : null;
    return parsed?.success && parsed.data.width === photo.width && parsed.data.height === photo.height
      ? { document: parsed.data, invalid: false } : { document: blank, invalid: true };
  });
  const [draft, setDraft] = useState(initial.document);
  const hasOpened = useRef(false);
  const [invalid, setInvalid] = useState(initial.invalid);
  const [expected, setExpected] = useState(photo.updated_at);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [conflict, setConflict] = useState<{ updatedAt: string; url?: string }>();
  const [reviewed, setReviewed] = useState(false);
  const pending = useRef<{ fingerprint: string; path: string; uploaded: boolean } | null>(null);
  const report = (text: string) => { setError(text); setTimeout(() => errorRef.current?.focus(), 0); };

  async function refreshLinks() {
    setRefreshing(true);
    try {
      const result = await refreshPhotoAnnotation(photo.id);
      if (result.error) { report(result.error); return; }
      setRefreshedLinks({ source: url, url: result.annotatedUrl, thumbnail: result.annotatedUrl, originalUrl: result.originalUrl });
      setFailedUrl(undefined);
      setError('');
    } catch { report('The photo could not be refreshed. Check your connection and retry.'); }
    finally { setRefreshing(false); }
  }

  async function save(blob: Blob, overwrite = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      const parsed = AnnotationDocumentSchema.safeParse(draft);
      if (!parsed.success || invalid) { report('This markup cannot be saved. Simplify the draft and retry.'); return; }
      const fingerprint = JSON.stringify(parsed.data);
      if (!pending.current || pending.current.fingerprint !== fingerprint) {
        pending.current = { fingerprint, path: `${projectId}/${photo.snag_id}/${crypto.randomUUID()}.jpg`, uploaded: false };
      }
      const attempt = pending.current;
      if (!attempt.uploaded) {
        const storage = createClient().storage.from('snag-photos');
        const uploaded = await storage.upload(attempt.path, blob, { contentType: 'image/jpeg', upsert: false });
        if (uploaded.error) {
          // A lost upload response can leave this exact, stable identity already present.
          const found = await storage.info(attempt.path);
          if (found.error || found.data?.contentType !== 'image/jpeg' || found.data.size !== blob.size) throw new Error('Image upload interrupted. Retry saving your retained draft.');
        }
        attempt.uploaded = true;
      }
      const timestamp = overwrite && conflict && reviewed ? conflict.updatedAt : expected;
      const result = await savePhotoAnnotation({ photoId: photo.id, expectedUpdatedAt: timestamp, path: attempt.path, document: parsed.data });
      if (result.error) {
        setConflict(result.conflict); setReviewed(false); report(result.error); return;
      }
      if (result.updatedAt) setExpected(result.updatedAt);
      pending.current = null;
      setConflict(undefined); setReviewed(false); setMessage('Markup saved. Original photo preserved.');
      await refreshLinks();
      router.refresh();
    } catch (failure) { report(failure instanceof Error ? failure.message : 'Saving was interrupted. Your draft is retained; retry saving.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <div className="space-y-2">
      {links.url && links.thumbnail && !imageFailed ? (
        <a href={links.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${label.toLowerCase()}`}>
          <Image src={links.thumbnail} alt={label} width={photo.width} height={photo.height} unoptimized className="aspect-4/3 h-auto w-full object-cover" onError={() => setFailedUrl(links.thumbnail)} />
        </a>
      ) : <p className="flex aspect-4/3 items-center justify-center rounded-lg border bg-muted p-3 text-center text-sm text-muted-foreground">{label} is unavailable. Its signed link may have expired.</p>}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {links.originalUrl ? <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={links.originalUrl} target="_blank" rel="noreferrer">Original photo</a> : null}
        <Button variant="ghost" size="sm" disabled={refreshing} onClick={refreshLinks}>{refreshing ? 'Refreshing…' : 'Refresh photo links'}</Button>
        {canEdit ? <Button variant="outline" size="sm" onClick={() => {
          if (!hasOpened.current) {
            const parsed = photo.annotation_json && JSON.stringify(photo.annotation_json).length <= 256000 ? AnnotationDocumentSchema.safeParse(photo.annotation_json) : null;
            const valid = parsed?.success && parsed.data.width === photo.width && parsed.data.height === photo.height;
            setDraft(valid ? parsed.data : blank); setInvalid(!!photo.annotation_json && !valid); setExpected(photo.updated_at);
            hasOpened.current = true;
          }
          setOpen(true); setMessage('');
        }}>Edit markup</Button> : null}
      </div>
      {!open && error ? <p role="alert" ref={errorRef} tabIndex={-1} className="text-sm text-destructive">{error}</p> : null}
      <Dialog open={open && canEdit} onOpenChange={(value) => { if (!busyRef.current) setOpen(value); }}>
        <DialogContent className="max-h-[95dvh] overflow-y-auto p-4 sm:max-w-6xl sm:p-6" onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader className="pr-10"><DialogTitle>Photo markup</DialogTitle><DialogDescription>{label}. Add notes and measurements; your original photo is preserved. Closing keeps your draft while this page stays open.</DialogDescription></DialogHeader>
          {error ? <p ref={errorRef} role="alert" tabIndex={-1} className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p> : null}
          {invalid ? <div className="space-y-3 rounded-md border p-4"><p>Saved markup uses an unsupported format or exceeds the editing limit. The saved image and original remain available.</p><Button variant="outline" onClick={() => setInvalid(false)}>Start a new markup draft</Button></div> : null}
          {conflict ? <div className="space-y-3 rounded-md border p-4">
            {conflict.url ? <a href={conflict.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">Review latest saved image</a> : null}
            <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1 size-5 shrink-0" />I reviewed the latest saved image and want to replace its markup with my draft.</label>
          </div> : null}
          {links.originalUrl && !invalid ? <Editor document={draft} onChange={(value) => { setDraft(value); setMessage(''); }} imageUrl={links.originalUrl} busy={busy} onSave={(blob) => save(blob, !!conflict && reviewed)} saveDisabled={!!conflict && !reviewed} saveLabel={conflict ? 'Replace latest markup with draft' : 'Save markup'} onImageError={() => report('The original image could not be loaded. Refresh photo links below; your draft is retained.')} /> : null}
          <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy || refreshing} onClick={refreshLinks}>Refresh photo links</Button><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Close editor</Button><p role="status" className="text-sm text-muted-foreground">{busy ? 'Saving markup…' : message}</p></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

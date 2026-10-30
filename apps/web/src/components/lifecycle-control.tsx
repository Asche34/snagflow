'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteSnag, setProjectArchived } from '@/app/(app)/lifecycle-actions';
import { useHydrated } from '@/lib/use-hydrated';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Props =
  | { kind: 'project'; id: string; name: string; archived: boolean }
  | { kind: 'snag'; id: string; name: string; projectId: string };

export function LifecycleControl(props: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const summary = useRef<HTMLParagraphElement>(null);
  const restoring = props.kind === 'project' && props.archived;
  const verb = props.kind === 'snag' ? 'delete' : restoring ? 'restore' : 'archive';
  const label = props.kind === 'snag' ? 'Delete snag' : restoring ? 'Restore project' : 'Archive project';
  useEffect(() => { if (error) summary.current?.focus(); }, [error]);
  async function submit() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const result = props.kind === 'snag'
        ? await deleteSnag(props.id)
        : await setProjectArchived(props.id, !props.archived);
      if (result.error) setError(result.error);
      else if (result.destination) {
        setOpen(false);
        router.replace(result.destination);
        router.refresh();
      }
    } catch {
      setError('The result could not be confirmed. Check your connection and retry, or refresh the list.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={value => { if (!busy.current) { setOpen(value); setError(''); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!hydrated} className={restoring ? '' : 'text-destructive'}>{label}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto break-words" onOpenAutoFocus={event => { event.preventDefault(); cancel.current?.focus(); }}
        onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
        <DialogTitle className="pr-10">{label}?</DialogTitle>
        <DialogDescription>
          <strong className="font-semibold text-foreground">{props.name}</strong>
          {props.kind === 'snag'
            ? ' will be removed from lists and dashboard counts. Its history and photos are retained. You cannot restore it from this app.'
            : restoring
              ? ' will return to active navigation and dashboard work. Existing records and team access are kept.'
              : ' will leave active navigation and dashboard work. Its snags, photos and team access are kept. You can find and restore it under Archived projects on the dashboard.'}
        </DialogDescription>
        {error ? <p ref={summary} role="alert" tabIndex={-1} className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive focus-visible:ring-2 focus-visible:ring-ring">{error}</p> : null}
        <p role="status" className="text-sm text-muted-foreground">{pending ? 'Saving…' : ''}</p>
        {/* A fresh document clears route caches even when a committed response lost its invalidation header. */}
        {props.kind === 'snag' && error ? <a className="inline-flex min-h-11 items-center text-sm underline" href={`/projects/${props.projectId}`}>Return to project</a> : null}
        <DialogFooter>
          <Button ref={cancel} variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant={restoring ? 'default' : 'destructive'} loading={pending} disabled={pending} onClick={submit}>Confirm {verb}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

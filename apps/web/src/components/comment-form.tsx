'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addComment } from '@/app/(app)/snags/[snagId]/actions';
import { useHydrated } from '@/lib/use-hydrated';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function CommentForm({ snagId }: { snagId: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const identity = useRef<string | null>(null);
  const busy = useRef(false);
  const summary = useRef<HTMLParagraphElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (error) summary.current?.focus();
  }, [error]);
  useEffect(() => {
    if (ok && !pending) textarea.current?.focus();
  }, [ok, pending]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setOk(false);
    identity.current ??= crypto.randomUUID();
    try {
      const result = await addComment({ id: identity.current, snagId, body });
      if (result.error) setError(result.error);
      else {
        setBody('');
        identity.current = null;
        setOk(true);
        router.refresh();
      }
    } catch {
      setError(
        'The result could not be confirmed. Retry this draft to check the earlier post, or refresh the thread before changing it.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 border-t pt-4" aria-label="Post a comment">
      <label htmlFor={`body-${snagId}`} className="block text-sm font-medium">
        Add a comment
      </label>
      <Textarea
        ref={textarea}
        id={`body-${snagId}`}
        name="body"
        required
        maxLength={5000}
        disabled={pending}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setOk(false);
        }}
        aria-describedby={`comment-hint-${snagId}`}
        className="min-h-28 text-base"
        placeholder="Share an update with the team…"
      />
      <p id={`comment-hint-${snagId}`} className="text-xs text-muted-foreground">
        {body.length.toLocaleString()} / 5,000 characters · Visible to the project team.
      </p>
      {error ? (
        <>
          <p
            ref={summary}
            role="alert"
            tabIndex={-1}
            className="rounded-md border border-destructive/30 p-3 text-sm text-destructive focus-visible:ring-2 focus-visible:ring-ring"
          >
            {error}
          </p>
          <a
            href={`/snags/${snagId}`}
            className="inline-flex min-h-11 items-center text-sm underline"
          >
            Refresh thread
          </a>
        </>
      ) : null}
      <p role="status" className="text-sm text-success">
        {pending ? 'Posting comment…' : ok ? 'Comment posted.' : ''}
      </p>
      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={!hydrated || pending || !body.trim()}
      >
        Post comment
      </Button>
    </form>
  );
}

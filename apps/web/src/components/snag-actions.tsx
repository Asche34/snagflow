'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { TransitionRule } from '@snagflow/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { transitionSnag } from '@/app/(app)/snags/[snagId]/actions';

type SnagActionsProps = {
  snagId: string;
  transitions: TransitionRule[];
};

export function SnagActions({ snagId, transitions }: SnagActionsProps) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      {transitions.length > 0 ? (
        <div className="space-y-3">
          {transitions.map((rule) => (
            <TransitionForm
              key={`${rule.from}-${rule.to}`}
              snagId={snagId}
              rule={rule}
              busy={busy}
              setBusy={setBusy}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No status actions are available to you in this state.
        </p>
      )}
    </div>
  );
}

function TransitionForm({
  snagId,
  rule,
  busy,
  setBusy,
}: {
  snagId: string;
  rule: TransitionRule;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const [comment, setComment] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: Awaited<ReturnType<typeof transitionSnag>>, data: FormData) => {
      setBusy(true);
      try {
        return await transitionSnag(previous, data);
      } catch {
        return {
          error:
            'The result could not be confirmed. Refresh to check the current status before retrying.',
        };
      } finally {
        setBusy(false);
      }
    },
    {},
  );
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);
  const reasonLabel = rule.action === 'reject' ? 'Rejection reason' : 'Reopen reason';

  return (
    <form action={formAction} className="space-y-2" aria-label={rule.label}>
      <input type="hidden" name="snagId" value={snagId} />
      <input type="hidden" name="toStatus" value={rule.to} />

      {rule.commentRequired ? (
        <div className="space-y-2">
          <label htmlFor={`comment-${snagId}-${rule.to}`} className="text-sm font-medium">
            {reasonLabel} <span className="text-muted-foreground">(required)</span>
          </label>
          <Textarea
            id={`comment-${snagId}-${rule.to}`}
            name="comment"
            required
            maxLength={5000}
            value={comment}
            disabled={busy}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Comment (required)"
            className="min-h-24 text-base"
          />
        </div>
      ) : null}

      {state.error ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          Status updated.
        </p>
      ) : null}

      <Button
        type="submit"
        variant="outline"
        className="w-full"
        loading={pending}
        disabled={busy || pending}
      >
        {rule.label}
      </Button>
    </form>
  );
}

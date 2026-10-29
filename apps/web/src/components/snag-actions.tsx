"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { TransitionRule } from "@snagflow/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment, transitionSnag } from "@/app/(app)/snags/[snagId]/actions";

type SnagActionsProps = {
  snagId: string;
  transitions: TransitionRule[];
  canComment: boolean;
};

export function SnagActions({ snagId, transitions, canComment }: SnagActionsProps) {
  return (
    <div className="space-y-4">
      {transitions.length > 0 ? (
        <div className="space-y-3">
          {transitions.map((rule) => (
            <TransitionForm key={`${rule.from}-${rule.to}`} snagId={snagId} rule={rule} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No status actions are available to you in this state.
        </p>
      )}

      {canComment ? <CommentForm snagId={snagId} /> : null}
    </div>
  );
}

function TransitionForm({ snagId, rule }: { snagId: string; rule: TransitionRule }) {
  const [state, formAction] = useActionState(transitionSnag, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="snagId" value={snagId} />
      <input type="hidden" name="toStatus" value={rule.to} />

      {rule.commentRequired ? (
        <div className="space-y-2"><label htmlFor={`comment-${snagId}-${rule.to}`} className="text-sm font-medium">Reason <span className="text-muted-foreground">(required)</span></label><Textarea
          id={`comment-${snagId}-${rule.to}`}
          name="comment"
          required
          placeholder="Comment (required)"
          className="min-h-24 text-base"
        /></div>
      ) : null}

      {state.error ? <ActionError message={state.error} /> : null}

      <SubmitButton label={rule.label} />
    </form>
  );
}

function CommentForm({ snagId }: { snagId: string }) {
  const [state, formAction] = useActionState(addComment, {});

  return (
    <form action={formAction} className="space-y-2 border-t pt-4">
      <input type="hidden" name="snagId" value={snagId} />
      <label htmlFor={`body-${snagId}`} className="block text-sm font-medium">Add a comment</label>
      <Textarea id={`body-${snagId}`} name="body" required placeholder="Share an update with the team…" className="min-h-24 text-base" />
      {state.error ? <ActionError message={state.error} /> : null}
      {state.ok ? <p role="status" className="text-sm text-success">Comment posted.</p> : null}
      <SubmitButton label="Post comment" variant="secondary" />
    </form>
  );
}

function SubmitButton({
  label,
  variant = "outline",
}: {
  label: string;
  variant?: "outline" | "secondary";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} className="w-full" loading={pending} disabled={pending}>
      {label}
    </Button>
  );
}

function ActionError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      {message}
    </p>
  );
}

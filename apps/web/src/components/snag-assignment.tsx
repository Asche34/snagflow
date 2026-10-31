'use client';
import { useActionState, useId, useState } from 'react';
import { assignSnag } from '@/app/(app)/snags/actions';
import { Button } from './ui/button';
import { nativeSelectClass, type FormOption } from './snag-form';

export function SnagAssignment({
  snagId,
  assigneeId,
  options,
}: {
  snagId: string;
  assigneeId: string | null;
  options: FormOption[];
}) {
  const [draft, setDraft] = useState<{ value: string; base: string | null } | null>(null);
  const [state, action, pending] = useActionState(
    async (previous: Awaited<ReturnType<typeof assignSnag>>, data: FormData) => {
      const result = await assignSnag(previous, data);
      if (result.ok) setDraft(null);
      return result;
    },
    {},
  );
  const selectId = `${useId()}-${snagId}-assignment`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="snagId" value={snagId} />
      <label htmlFor={selectId} className="block text-sm font-medium">
        Assign to
      </label>
      <select
        id={selectId}
        name="assigneeId"
        className={nativeSelectClass}
        value={draft?.value ?? assigneeId ?? ''}
        onChange={(event) =>
          setDraft(
            event.target.value === (assigneeId ?? '')
              ? null
              : { value: event.target.value, base: assigneeId },
          )
        }
        disabled={pending}
      >
        <option value="">Unassigned</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {draft && draft.base !== assigneeId ? (
        <p role="status" className="text-sm text-muted-foreground">
          Assignment changed remotely. Your selection has been kept; saving will replace the current
          assignment.
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          Assignment updated.
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Updating…' : 'Update assignment'}
      </Button>
    </form>
  );
}

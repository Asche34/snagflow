'use client';
import { useActionState } from 'react';
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
  const [state, action, pending] = useActionState(assignSnag, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="snagId" value={snagId} />
      <label htmlFor="assignment" className="block text-sm font-medium">
        Assign to
      </label>
      <select
        id="assignment"
        name="assigneeId"
        className={nativeSelectClass}
        defaultValue={assigneeId ?? ''}
        disabled={pending}
      >
        <option value="">Unassigned</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
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

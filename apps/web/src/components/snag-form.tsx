'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveSnag, type SaveSnagResult } from '@/app/(app)/snags/actions';
import type { Snag } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PhotoPicker } from './photo-picker';
import { uploadPhotos, type QueuedPhoto } from '@/lib/photos';
import { useHydrated } from '@/lib/use-hydrated';

export type FormOption = { id: string; name: string };
export type SnagFormProps = {
  projectId: string;
  initial?: Snag;
  locations: FormOption[];
  categories: FormOption[];
  assignees: FormOption[];
  canAssign: boolean;
};
export const nativeSelectClass =
  'min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function SnagForm({
  projectId,
  initial,
  locations,
  categories,
  assignees,
  canAssign,
}: SnagFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const prefix = `${useId()}-${projectId}-${initial?.id ?? 'new'}`;
  const fieldId = (name: string) => `${prefix}-${name}`;
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState(() => initial?.client_id ?? crypto.randomUUID());
  const [result, setResult] = useState<SaveSnagResult>({});
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(initial?.id);
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const inFlight = useRef(false);
  useEffect(() => {
    if (result.error) summary.current?.focus();
  }, [result]);
  const errorFor = (field: string) => result.fieldErrors?.[field]?.[0];
  async function submit(data: FormData) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setNotice('');
    setResult({});
    try {
      const nullable = (name: string) => String(data.get(name) ?? '').trim() || null;
      const saved = await saveSnag({
        projectId,
        clientId,
        snagId: savedId,
        title: data.get('title'),
        description: nullable('description'),
        priority: data.get('priority'),
        locationId: nullable('locationId'),
        categoryId: nullable('categoryId'),
        dueDate: nullable('dueDate'),
        assigneeId: initial ? null : nullable('assigneeId'),
      });
      setResult(saved);
      if (!saved.snagId) return;
      setSavedId(saved.snagId);
      if (photos.some((photo) => photo.status !== 'done')) {
        const uploaded = await uploadPhotos(projectId, saved.snagId, photos, setPhotos);
        if (uploaded.some((photo) => photo.status === 'error')) {
          setResult({
            snagId: saved.snagId,
            error:
              'Snag saved. Some photos need a retry. Your details and completed uploads are safe.',
          });
          return;
        }
      }
      if (data.get('intent') === 'another') {
        form.current?.reset();
        setClientId(crypto.randomUUID());
        setSavedId(undefined);
        setPhotos([]);
        setNotice('Snag saved. Ready to add another.');
        form.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
      } else {
        router.push(`/snags/${saved.snagId}`);
        router.refresh();
      }
    } catch {
      setResult({ error: 'Your snag could not be saved. Check your connection and try again.' });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  const field = (name: string) => ({
    'aria-invalid': !!errorFor(name),
    'aria-describedby': errorFor(name) ? `${fieldId(name)}-error` : undefined,
  });
  const fieldError = (name: string) =>
    errorFor(name) ? (
      <p id={`${fieldId(name)}-error`} className="text-sm text-destructive">
        {errorFor(name)}
      </p>
    ) : null;
  return (
    <form
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        void submit(new FormData(event.currentTarget, submitter));
      }}
      className="space-y-6"
    >
      {result.error ? (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="font-medium">{result.error}</p>
          {result.fieldErrors ? (
            <ul className="mt-2 space-y-1">
              {Object.entries(result.fieldErrors).map(([name, errors]) => (
                <li key={name}>
                  <a className="underline" href={`#${fieldId(name)}`}>
                    {errors[0]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-lg border bg-secondary p-4 text-sm">
          {notice}
        </p>
      ) : null}
      <fieldset disabled={pending || !hydrated} className="min-w-0 space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={fieldId('title')}>
            Title
          </label>
          <Input
            id={fieldId('title')}
            name="title"
            required
            maxLength={200}
            defaultValue={initial?.title}
            {...field('title')}
          />
          {fieldError('title')}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={fieldId('description')}>
            Description
          </label>
          <Textarea
            id={fieldId('description')}
            name="description"
            maxLength={5000}
            rows={4}
            defaultValue={initial?.description ?? ''}
            {...field('description')}
          />
          {fieldError('description')}
        </div>
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label className="text-sm font-medium" htmlFor={fieldId('priority')}>
              Priority
            </label>
            <select
              id={fieldId('priority')}
              name="priority"
              className={nativeSelectClass}
              defaultValue={initial?.priority ?? 'medium'}
              {...field('priority')}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            {fieldError('priority')}
          </div>
          <div className="min-w-0 space-y-2">
            <label className="text-sm font-medium" htmlFor={fieldId('dueDate')}>
              Due date
            </label>
            <Input
              id={fieldId('dueDate')}
              name="dueDate"
              type="date"
              defaultValue={initial?.due_date ?? ''}
              {...field('dueDate')}
            />
            {fieldError('dueDate')}
          </div>
          {(
            [
              ['locationId', 'Location', locations, initial?.location_id],
              ['categoryId', 'Category', categories, initial?.category_id],
            ] as const
          ).map(([name, label, options, value]) => (
            <div key={name} className="min-w-0 space-y-2">
              <label className="text-sm font-medium" htmlFor={fieldId(name)}>
                {label}
              </label>
              <select
                id={fieldId(name)}
                name={name}
                className={nativeSelectClass}
                defaultValue={value ?? ''}
                {...field(name)}
              >
                <option value="">Not specified</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              {fieldError(name)}
            </div>
          ))}
          {canAssign && !initial ? (
            <div className="min-w-0 space-y-2 sm:col-span-2">
              <label className="text-sm font-medium" htmlFor={fieldId('assigneeId')}>
                Assignee
              </label>
              <select
                id={fieldId('assigneeId')}
                name="assigneeId"
                disabled={!!savedId}
                className={nativeSelectClass}
                {...field('assigneeId')}
              >
                <option value="">Unassigned</option>
                {assignees.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              {fieldError('assigneeId')}
            </div>
          ) : null}
        </div>
      </fieldset>
      {!initial ? (
        <PhotoPicker
          items={photos}
          onChange={setPhotos}
          disabled={pending}
          existingCount={photos.filter((photo) => photo.status === 'done').length}
        />
      ) : null}
      {savedId && !initial && result.error ? (
        <Link
          className="inline-flex min-h-11 items-center text-sm text-primary underline"
          href={`/snags/${savedId}`}
        >
          Open saved snag
        </Link>
      ) : null}
      <div className="flex flex-wrap gap-3 border-t pt-5">
        <Button type="submit" name="intent" value="view" disabled={pending || !hydrated}>
          {pending
            ? 'Saving…'
            : initial
              ? 'Save changes'
              : photos.some((photo) => photo.status === 'error')
                ? 'Retry failed photos'
                : 'Save snag'}
        </Button>
        {!initial ? (
          <Button
            type="submit"
            variant="outline"
            name="intent"
            value="another"
            disabled={pending || !hydrated}
          >
            Save &amp; add another
          </Button>
        ) : null}
        <Button variant="ghost" asChild>
          <Link href={initial ? `/snags/${initial.id}` : `/projects/${projectId}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

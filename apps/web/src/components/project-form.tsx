'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProject, type SaveProjectResult } from '@/app/(app)/projects/actions';
import { useHydrated } from '@/lib/use-hydrated';
import type { Project } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function ProjectForm({ initial }: { initial?: Project }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const prefix = `${useId()}-project-${initial?.id ?? 'new'}`;
  const fieldId = (name: string) => `${prefix}-${name}`;
  const [clientId] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState<SaveProjectResult>({});
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result.error) summary.current?.focus();
  }, [result]);
  const fields = [
    { name: 'name', label: 'Project name', maxLength: 120, value: initial?.name },
    { name: 'code', label: 'Project code', maxLength: 12, value: initial?.code },
    { name: 'clientName', label: 'Client name', maxLength: 120, value: initial?.client_name },
    { name: 'address', label: 'Address', maxLength: 300, value: initial?.address },
  ] as const;
  const errorProps = (name: string) => ({
    'aria-invalid': !!result.fieldErrors?.[name],
    'aria-describedby': result.fieldErrors?.[name]
      ? fieldId(`${name}-error`)
      : name === 'code'
        ? fieldId('code-help')
        : undefined,
  });
  const error = (name: string) =>
    result.fieldErrors?.[name]?.[0] ? (
      <p id={fieldId(`${name}-error`)} className="text-sm text-destructive">
        {result.fieldErrors[name][0]}
      </p>
    ) : null;
  async function submit(form: HTMLFormElement) {
    if (inFlight.current) return;
    inFlight.current = true;
    const data = new FormData(form);
    setPending(true);
    try {
      const saved = await saveProject({
        clientId,
        projectId: initial?.id,
        name: data.get('name'),
        code: data.get('code'),
        description: data.get('description'),
        clientName: data.get('clientName'),
        address: data.get('address'),
        requireFixPhoto: data.get('requireFixPhoto') === 'on',
      });
      setResult(saved);
      if (saved.projectId) {
        router.push(`/projects/${saved.projectId}`);
        router.refresh();
      }
    } catch {
      setResult({ error: 'Your project could not be saved. Check your connection and try again.' });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <form
      aria-label={initial ? 'Edit project details' : 'New project details'}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
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
                  <a href={`#${fieldId(name)}`} className="underline">
                    {errors[0]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <fieldset disabled={!hydrated || pending} className="min-w-0 space-y-6">
        <legend className="sr-only">Project details</legend>
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          {fields.map(({ name, label, maxLength, value }) => (
            <div key={name} className="min-w-0 space-y-2">
              <label htmlFor={fieldId(name)} className="text-sm font-medium">
                {label}
              </label>
              <Input
                id={fieldId(name)}
                name={name}
                defaultValue={value ?? ''}
                maxLength={maxLength}
                required={name === 'name' || name === 'code'}
                {...errorProps(name)}
              />
              {name === 'code' ? (
                <p id={fieldId('code-help')} className="text-xs text-muted-foreground">
                  Unique code, up to 12 letters, numbers, dashes or underscores.
                </p>
              ) : null}
              {error(name)}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <label htmlFor={fieldId('description')} className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id={fieldId('description')}
            name="description"
            defaultValue={initial?.description ?? ''}
            rows={4}
            maxLength={2000}
            {...errorProps('description')}
          />
          {error('description')}
        </div>
        <div className="rounded-lg border p-4">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-medium">
            <input
              name="requireFixPhoto"
              type="checkbox"
              defaultChecked={initial?.require_fix_photo ?? true}
              className="mt-1 size-4 shrink-0 accent-primary"
              aria-describedby={fieldId('photo-help')}
            />
            Require a fix photo before review
          </label>
          <p id={fieldId('photo-help')} className="mt-1 text-sm text-muted-foreground">
            When enabled, your team must add fix evidence before requesting review.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">
            {pending ? 'Saving project…' : initial ? 'Save project' : 'Create project'}
          </Button>
          <Button asChild variant="outline">
            <Link href={initial ? `/projects/${initial.id}` : '/dashboard'}>Cancel</Link>
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveMetadata } from '@/app/(app)/projects/metadata-actions';
import type { Location, Category } from '@/lib/data';
import { useHydrated } from '@/lib/use-hydrated';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type Draft = {
  kind: 'location' | 'category';
  id: string;
  name: string;
  parentId: string;
  sortOrder: number;
  creating: boolean;
  remove: boolean;
};
export function ProjectMetadata({
  projectId,
  locations,
  categories,
  editable,
}: {
  projectId: string;
  locations: Location[];
  categories: Category[];
  editable: boolean;
}) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const summary = useRef<HTMLParagraphElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (error) summary.current?.focus();
  }, [error]);
  const byId = new Map(locations.map((location) => [location.id, location]));
  const rows = (kind: Draft['kind']) =>
    kind === 'location'
      ? locations.map((row) => ({ row, location: row }))
      : categories.map((row) => ({ row, location: undefined }));
  function path(location: Location) {
    const names = [location.name];
    const seen = new Set([location.id]);
    let parent = location.parent_id;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const row = byId.get(parent);
      if (!row) break;
      names.unshift(row.name);
      parent = row.parent_id;
    }
    return names.join(' / ');
  }
  function open(kind: Draft['kind'], row?: Location | Category, remove = false) {
    setError('');
    setNotice('');
    setDraft({
      kind,
      id: row?.id ?? crypto.randomUUID(),
      name: row?.name ?? '',
      parentId: row && 'parent_id' in row ? (row.parent_id ?? '') : '',
      sortOrder: row && 'sort_order' in row ? row.sort_order : 0,
      creating: !row,
      remove,
    });
  }
  function forbiddenParent(id: string) {
    const seen = new Set<string>();
    let current: string | null = id;
    while (current && !seen.has(current)) {
      if (current === draft?.id) return true;
      seen.add(current);
      current = byId.get(current)?.parent_id ?? null;
    }
    return false;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const result = await saveMetadata(
        { ...draft, projectId, parentId: draft.parentId || null },
        draft.kind,
        draft.remove,
      );
      if (result.error) setError(result.error);
      else {
        setNotice(
          `${draft.kind === 'location' ? 'Location' : 'Category'} ${draft.remove ? 'deleted' : 'saved'}.`,
        );
        setDraft(null);
        router.refresh();
      }
    } catch {
      setError(
        'The result could not be confirmed. Retry the same draft, or refresh the list to check whether it was saved.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="space-y-8">
      {notice ? (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      ) : null}
      {(['location', 'category'] as const).map((kind) => (
        <section
          key={kind}
          aria-label={kind === 'location' ? 'Project locations' : 'Project categories'}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{kind === 'location' ? 'Locations' : 'Categories'}</h2>
            {editable ? (
              <Button variant="outline" disabled={!hydrated} onClick={() => open(kind)}>
                Add {kind}
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {kind === 'location'
              ? 'Organize buildings, floors and rooms. Lower order values appear first.'
              : 'Trades and types of work for this project.'}
          </p>
          {(kind === 'location' ? locations : categories).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No {kind === 'location' ? 'locations' : 'categories'} recorded yet.
            </p>
          ) : (
            <ul className="divide-y">
              {rows(kind).map(({ row, location }) => (
                <li
                  key={row.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1 basis-40 break-words text-sm">
                    <p className="font-medium">{location ? path(location) : row.name}</p>
                    {location ? (
                      <p className="text-xs text-muted-foreground">
                        Order {location.sort_order}
                        {location.plan_path ? ' · Plan attached' : ''}
                      </p>
                    ) : null}
                  </div>
                  {editable ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={!hydrated}
                        aria-label={`Edit ${kind} ${row.name}`}
                        onClick={() => open(kind, row)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        className="text-destructive"
                        disabled={!hydrated}
                        aria-label={`Delete ${kind} ${row.name}`}
                        onClick={() => open(kind, row, true)}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="text-sm text-muted-foreground">
        Renaming keeps existing snag references. Only unused records without child locations can be
        deleted; historical snags count as usage.
      </p>
      <Dialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!busy.current && !open) {
            setDraft(null);
            setError('');
          }
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto break-words"
          onOpenAutoFocus={(event) => {
            if (draft?.remove) {
              event.preventDefault();
              cancel.current?.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <DialogTitle className="pr-10">
            {draft?.remove ? 'Delete' : draft?.creating ? 'Add' : 'Edit'} {draft?.kind}
            {draft?.remove ? '?' : ''}
          </DialogTitle>
          <DialogDescription>
            {draft?.remove
              ? `Delete “${draft.name}”? Only unused records can be removed. Snag history and child locations are protected.`
              : 'Changes apply to this project. Existing snags keep their references when you rename or move a location.'}
          </DialogDescription>
          {draft ? (
            <form onSubmit={submit} className="space-y-4">
              <fieldset disabled={pending} className="space-y-4">
                {!draft.remove ? (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="metadata-name" className="text-sm font-medium">
                        Name
                      </label>
                      <Input
                        id="metadata-name"
                        required
                        maxLength={draft.kind === 'location' ? 120 : 60}
                        value={draft.name}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      />
                    </div>
                    {draft.kind === 'location' ? (
                      <>
                        <div className="space-y-2">
                          <label htmlFor="metadata-parent" className="text-sm font-medium">
                            Parent location
                          </label>
                          <select
                            id="metadata-parent"
                            className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base"
                            value={draft.parentId}
                            onChange={(event) =>
                              setDraft({ ...draft, parentId: event.target.value })
                            }
                          >
                            <option value="">Top level</option>
                            {locations
                              .filter((row) => !forbiddenParent(row.id))
                              .map((row) => (
                                <option key={row.id} value={row.id}>
                                  {path(row)}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="metadata-order" className="text-sm font-medium">
                            Order
                          </label>
                          <Input
                            id="metadata-order"
                            type="number"
                            min={0}
                            max={2147483647}
                            step={1}
                            required
                            value={draft.sortOrder}
                            onChange={(event) =>
                              setDraft({ ...draft, sortOrder: event.target.valueAsNumber })
                            }
                          />
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </fieldset>
              {error ? (
                <p
                  ref={summary}
                  role="alert"
                  tabIndex={-1}
                  className="rounded-md border border-destructive/30 p-3 text-sm text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {error}
                </p>
              ) : null}
              {error ? (
                <a
                  href={`/projects/${projectId}?tab=locations`}
                  className="inline-flex min-h-11 items-center text-sm underline"
                >
                  Refresh list
                </a>
              ) : null}
              <p role="status" className="text-sm text-muted-foreground">
                {pending ? 'Saving…' : ''}
              </p>
              <DialogFooter>
                <Button
                  ref={cancel}
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={draft.remove ? 'destructive' : 'default'}
                  loading={pending}
                  disabled={pending}
                >
                  {draft.remove ? 'Confirm delete' : `Save ${draft.kind}`}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

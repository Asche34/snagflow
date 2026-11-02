'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReportRequestSchema,
  SNAG_PRIORITIES,
  SNAG_STATUSES,
  type Database,
  type ReportRequest,
} from '@snagflow/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Category, Location, Person } from '@/lib/data';
type Report = Database['public']['Tables']['reports']['Row'];
type Draft = Omit<ReportRequest, 'requestId'>;
const selectClass = 'min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm';
const themes = { classic: 'Classic', compact: 'Compact', photo_first: 'Photo-first' };
async function responseJson(response: Response) {
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || 'The report request could not be completed. Try again.');
  return body;
}
export function ProjectReports({
  projectId,
  people,
  locations,
  categories,
}: {
  projectId: string;
  people: Person[];
  locations: Location[];
  categories: Category[];
}) {
  const [draft, setDraft] = useState<Draft>(() => {
    const { requestId: _, ...value } = ReportRequestSchema.parse({
      requestId: '70000000-0000-4000-8000-000000000001',
      projectId,
      format: 'pdf',
    });
    void _;
    return value;
  });
  const [history, setHistory] = useState<Report[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [historyError, setHistoryError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [download, setDownload] = useState<{ url: string; label: string } | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const touched = useRef(false);
  const defaultLoaded = useRef(false);
  const loadHistory = useCallback(
    async (next: number) => {
      setLoading(true);
      setHistoryError('');
      try {
        const result = await responseJson(
          await fetch(`/api/reports?projectId=${projectId}&page=${next}`, { cache: 'no-store' }),
        );
        setHistory(result.reports);
        setPage(result.page);
        setPages(result.pages);
        if (!defaultLoaded.current) {
          defaultLoaded.current = true;
          if (!touched.current && Object.hasOwn(themes, result.defaultTheme))
            setDraft((value) => ({ ...value, theme: result.defaultTheme }));
        }
      } catch (cause) {
        setHistoryError(
          cause instanceof Error ? cause.message : 'Report history could not be loaded.',
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );
  useEffect(() => {
    void Promise.resolve().then(() => loadHistory(1));
  }, [loadHistory]);
  const change = (next: Draft) => {
    touched.current = true;
    setDraft(next);
    setDownload(null);
  };
  const option = <K extends keyof Draft['options']>(key: K, value: Draft['options'][K]) =>
    change({ ...draft, options: { ...draft.options, [key]: value } });
  async function generate(value: Draft = draft) {
    setBusy(true);
    setError('');
    setDownload(null);
    const key = JSON.stringify(value);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      const parsed = ReportRequestSchema.safeParse({ ...value, requestId: retry.current!.id });
      if (!parsed.success)
        throw new Error(parsed.error.issues[0]?.message ?? 'Check report filters.');
      const result = await responseJson(
        await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        }),
      );
      setDownload({
        url: result.url,
        label: `Download revision ${result.report.revision} (${value.format.toUpperCase()})`,
      });
      retry.current = null;
      await loadHistory(1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Report generation failed. Retry with the same options.',
      );
      requestAnimationFrame(() => feedback.current?.focus());
    } finally {
      setBusy(false);
    }
  }
  async function downloadSaved(report: Report) {
    setBusy(true);
    setError('');
    try {
      const result = await responseJson(
        await fetch(`/api/reports/${report.id}`, { cache: 'no-store' }),
      );
      setDownload({
        url: result.url,
        label: `Download revision ${report.revision} (${report.format.toUpperCase()})`,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Download is unavailable. Try again.');
      requestAnimationFrame(() => feedback.current?.focus());
    } finally {
      setBusy(false);
    }
  }
  function regenerate(report: Report) {
    const parsed = ReportRequestSchema.safeParse({
      requestId: crypto.randomUUID(),
      projectId,
      format: report.format,
      theme: report.theme,
      filters: report.filters,
      options: report.options,
    });
    if (!parsed.success) {
      setError(
        'The saved options are no longer supported. Choose new options to generate a report.',
      );
      return;
    }
    const { requestId: _, ...next } = parsed.data;
    void _;
    change(next);
    void generate(next);
  }
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Generate a report</CardTitle>
          <CardDescription>
            Export project records with your company branding. Saved reports receive a new revision.
            Downloads expire after two minutes; request another from history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
            className="space-y-6"
          >
            <fieldset disabled={busy} className="space-y-5">
              <legend className="sr-only">Report configuration</legend>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-2 text-sm font-medium">
                  Format
                  <select
                    className={selectClass}
                    aria-label="Format"
                    value={draft.format}
                    onChange={(event) =>
                      change({ ...draft, format: event.target.value as Draft['format'] })
                    }
                  >
                    <option value="pdf">PDF document</option>
                    <option value="xlsx">Excel workbook</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Theme
                  <select
                    className={selectClass}
                    aria-label="Theme"
                    value={draft.theme}
                    onChange={(event) =>
                      change({ ...draft, theme: event.target.value as Draft['theme'] })
                    }
                  >
                    {Object.entries(themes).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Group by
                  <select
                    className={selectClass}
                    aria-label="Group by"
                    value={draft.options.groupBy}
                    onChange={(event) =>
                      option('groupBy', event.target.value as Draft['options']['groupBy'])
                    }
                  >
                    {['location', 'assignee', 'status', 'category'].map((value) => (
                      <option key={value} value={value}>
                        {value[0]!.toUpperCase() + value.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Sort by
                  <select
                    className={selectClass}
                    aria-label="Sort by"
                    value={draft.options.sortBy}
                    onChange={(event) =>
                      option('sortBy', event.target.value as Draft['options']['sortBy'])
                    }
                  >
                    <option value="number">Number</option>
                    <option value="priority">Highest priority</option>
                    <option value="due_date">Earliest due date</option>
                  </select>
                </label>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Content</legend>
                <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      ['cover', 'Cover page'],
                      ['photos', 'Include photos'],
                      ['annotated', 'Use annotated photos'],
                      ['comments', 'Include comments'],
                      ['timestamps', 'Include timestamps'],
                      ['fixPhotos', 'Include fix photos'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={draft.options[key]}
                        onChange={(event) => option(key, event.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label className="mt-3 block max-w-sm space-y-2 text-sm font-medium">
                  Photo size
                  <select
                    className={selectClass}
                    aria-label="Photo size"
                    value={draft.options.photoSize}
                    onChange={(event) =>
                      option('photoSize', event.target.value as Draft['options']['photoSize'])
                    }
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="one_per_page">One per page</option>
                  </select>
                </label>
              </fieldset>
              <details className="rounded-lg border p-4">
                <summary className="min-h-8 cursor-pointer text-sm font-semibold">
                  Filter report items
                </summary>
                <div className="mt-4 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {(
                      [
                        ['statuses', 'Status', SNAG_STATUSES],
                        ['priorities', 'Priority', SNAG_PRIORITIES],
                      ] as const
                    ).map(([key, label, values]) => (
                      <fieldset key={key}>
                        <legend className="mb-2 text-sm font-medium">
                          {label} · all when none selected
                        </legend>
                        <div className="flex flex-wrap gap-x-4">
                          {values.map((value) => (
                            <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={(draft.filters[key] as string[]).includes(value)}
                                onChange={(event) => {
                                  const current = draft.filters[key] as string[];
                                  change({
                                    ...draft,
                                    filters: {
                                      ...draft.filters,
                                      [key]: event.target.checked
                                        ? [...current, value]
                                        : current.filter((item) => item !== value),
                                    },
                                  });
                                }}
                              />
                              {value.replaceAll('_', ' ')}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {(
                      [
                        [
                          'assigneeIds',
                          'Assignees',
                          people.map((person) => ({
                            id: person.id,
                            name: person.full_name || person.email,
                          })),
                        ],
                        ['locationIds', 'Locations', locations],
                        ['categoryIds', 'Categories', categories],
                      ] as const
                    ).map(([key, label, choices]) => (
                      <label key={key} className="space-y-2 text-sm font-medium">
                        {label}
                        <select
                          aria-label={label}
                          multiple
                          size={4}
                          className={selectClass}
                          value={draft.filters[key]}
                          onChange={(event) =>
                            change({
                              ...draft,
                              filters: {
                                ...draft.filters,
                                [key]: [...event.target.selectedOptions].map(
                                  (option) => option.value,
                                ),
                              },
                            })
                          }
                        >
                          {choices.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.name}
                            </option>
                          ))}
                        </select>
                        <span className="block text-xs font-normal text-muted-foreground">
                          Select several with Ctrl or Command. No selection includes all.
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {(
                      [
                        ['createdFrom', 'Created from'],
                        ['createdTo', 'Created through'],
                        ['excludeClosedBefore', 'Exclude closed before'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="space-y-2 text-sm font-medium">
                        {label}
                        <Input
                          type="date"
                          value={draft.filters[key] ?? ''}
                          onChange={(event) =>
                            change({
                              ...draft,
                              filters: { ...draft.filters, [key]: event.target.value || undefined },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      change({
                        ...draft,
                        filters: ReportRequestSchema.parse({
                          requestId: crypto.randomUUID(),
                          projectId,
                          format: 'pdf',
                        }).filters,
                      })
                    }
                  >
                    Clear report filters
                  </Button>
                </div>
              </details>
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? 'Preparing report…' : 'Generate report'}
              </Button>
              <span className="text-sm text-muted-foreground" role="status">
                {busy ? 'Large photo reports may take a few minutes. Keep this page open.' : ''}
              </span>
            </div>
          </form>
          {error ? (
            <p
              ref={feedback}
              role="alert"
              tabIndex={-1}
              className="mt-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          {download ? (
            <p className="mt-4" role="status">
              <a
                className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
                href={download.url}
                target="_blank"
                rel="noreferrer"
              >
                {download.label}
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Report history</CardTitle>
          <CardDescription>
            Download a saved revision or regenerate its options against the latest project records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {historyError ? (
            <div role="alert" className="space-y-3 text-sm">
              <p>{historyError}</p>
              <Button variant="outline" disabled={loading} onClick={() => void loadHistory(page)}>
                Retry history
              </Button>
            </div>
          ) : loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Loading report history…
            </p>
          ) : history.length ? (
            <ul className="divide-y">
              {history.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-medium">
                      Revision {report.revision} · {report.format.toUpperCase()} ·{' '}
                      {themes[report.theme as keyof typeof themes] ?? report.theme}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void downloadSaved(report)}
                      aria-label={`Download revision ${report.revision}`}
                    >
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => regenerate(report)}
                      aria-label={`Regenerate revision ${report.revision}`}
                    >
                      Regenerate
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No reports have been generated yet.</p>
          )}
          {pages > 1 ? (
            <nav
              aria-label="Report history pages"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <Button
                variant="outline"
                disabled={loading || page === 1}
                onClick={() => void loadHistory(page - 1)}
              >
                Previous reports
              </Button>
              <span className="text-sm">
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                disabled={loading || page === pages}
                onClick={() => void loadHistory(page + 1)}
              >
                Next reports
              </Button>
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

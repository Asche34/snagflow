import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { canAct } from '@snagflow/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SnagList } from '@/components/snag-list';
import { SnagFilters } from '@/components/snag-filters';
import { loadProjectSnags, SNAG_PAGE_SIZE } from '@/lib/project-snags';
import { parseSnagFilters, snagFiltersHref, type QueryParams } from '@/lib/snag-filters';
import { loadWorkspace } from '@/lib/data';
import { loadProjectMetadata } from '@/lib/project-metadata';
import { ProjectMetadata } from '@/components/project-metadata';
import { TeamView } from '@/components/team-view';
import { LifecycleControl } from '@/components/lifecycle-control';
import { PROJECT_ROLE_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

type Tab = 'snags' | 'locations' | 'team';

const TABS: { id: Tab; label: string }[] = [
  { id: 'snags', label: 'Snags' },
  { id: 'locations', label: 'Locations' },
  { id: 'team', label: 'Team' },
];

export async function ProjectView({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<QueryParams>;
}) {
  const [{ projectId }, queryParams] = await Promise.all([params, searchParams]);
  const { tab } = queryParams;
  const filters = parseSnagFilters(queryParams);
  const workspace = await loadWorkspace({ includeSnags: false });
  if (!workspace) redirect('/login');

  const project = workspace.projects.find((candidate) => candidate.id === projectId);
  if (!project) notFound();

  const { people, members, roles } = workspace;
  const { locations, categories } = await loadProjectMetadata(project.id);
  const role = roles.get(project.id) ?? (workspace.profile?.is_admin ? 'manager' : null);
  const activeTab: Tab = tab === 'locations' || tab === 'team' ? tab : 'snags';

  const projectLocations = locations.filter((location) => location.project_id === project.id);
  const projectMembers = members.filter((member) => member.project_id === project.id);
  const projectById = new Map(workspace.projects.map((candidate) => [candidate.id, candidate]));

  let results: Awaited<ReturnType<typeof loadProjectSnags>> | null = null;
  try {
    results = await loadProjectSnags(project.id, workspace.user.id, filters);
  } catch {
    // Keep a failed backend read distinct from a successful zero-match query.
  }
  const stats = results?.stats;
  const percent = stats?.total ? Math.round((stats.closed / stats.total) * 100) : 0;

  const tabHref = (next: Tab) => snagFiltersHref(project.id, filters, { tab: next });

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="space-y-2">
        {project.status === 'archived' ? (
          <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
            Archived project · Records and team access are retained.
          </p>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
          Project workspace
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {project.name}
          </h1>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {project.code}
          </span>
          {role ? (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {PROJECT_ROLE_LABELS[role]}
            </span>
          ) : null}
          {workspace.profile?.is_active &&
          canAct(
            { id: workspace.user.id, isAdmin: workspace.profile.is_admin },
            role,
            'project:edit',
          ) ? (
            <Button asChild variant="outline" className="sm:ml-auto">
              <Link href={`/projects/${project.id}/edit`}>Edit project</Link>
            </Button>
          ) : null}
          {canAct(
            { id: workspace.user.id, isAdmin: workspace.profile?.is_admin ?? false },
            role,
            'snag:create',
          ) ? (
            <Button asChild>
              <Link href={`/projects/${project.id}/snags/new`}>New snag</Link>
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {[project.client_name, project.address].filter(Boolean).join(' · ') ||
            'No client or address recorded.'}
        </p>
      </div>

      {workspace.profile?.is_active &&
      canAct(
        { id: workspace.user.id, isAdmin: workspace.profile.is_admin },
        role,
        'project:archive',
      ) ? (
        <div className="flex justify-end border-t pt-3">
          <LifecycleControl
            kind="project"
            id={project.id}
            name={project.name}
            archived={project.status === 'archived'}
          />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-2xl font-semibold tabular-nums">{stats?.total ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Total snags</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-2xl font-semibold tabular-nums">
              {stats ? stats.total - stats.closed : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Still open</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-2xl font-semibold tabular-nums">{stats?.review ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="px-4">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums">{stats ? `${percent}%` : '—'}</p>
              <p className="text-xs text-muted-foreground">closed</p>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <nav aria-label="Project sections" className="flex flex-wrap gap-2 border-b">
        {TABS.map((entry) => (
          <Link
            key={entry.id}
            href={tabHref(entry.id)}
            aria-current={activeTab === entry.id ? 'page' : undefined}
            className={cn(
              '-mb-px flex min-h-11 items-center border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === entry.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'snags' ? (
        <Card className="gap-0 py-0">
          <CardHeader className="pb-3 pt-5">
            <CardTitle>Snags</CardTitle>
            <CardDescription>Find and prioritize work across this project.</CardDescription>
            <SnagFilters
              projectId={project.id}
              filters={filters}
              people={people.filter((person) =>
                projectMembers.some((member) => member.user_id === person.id),
              )}
              locations={projectLocations}
              categories={categories.filter((category) => category.project_id === project.id)}
            />
          </CardHeader>
          <CardContent className="px-0">
            {results ? (
              <>
                <div className="border-y px-6 py-3 text-sm text-muted-foreground" role="status">
                  <span>
                    {results.count} {results.count === 1 ? 'result' : 'results'}
                  </span>
                  {results.count > 0 ? (
                    <span>
                      {' '}
                      · Showing {(results.page - 1) * SNAG_PAGE_SIZE + 1}–
                      {Math.min(results.page * SNAG_PAGE_SIZE, results.count)}
                    </span>
                  ) : null}
                </div>
                <SnagList
                  snags={results.snags}
                  people={people}
                  projects={projectById}
                  emptyLabel="No snags match these filters."
                />
                {results.pages > 1 ? (
                  <nav
                    aria-label="Snag pages"
                    className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4"
                  >
                    {results.page > 1 ? (
                      <Button asChild variant="outline">
                        <Link
                          href={snagFiltersHref(project.id, filters, { page: results.page - 1 })}
                        >
                          Previous page
                        </Link>
                      </Button>
                    ) : (
                      <span />
                    )}
                    <span className="text-sm text-muted-foreground">
                      Page {results.page} of {results.pages}
                    </span>
                    {results.page < results.pages ? (
                      <Button asChild variant="outline">
                        <Link
                          href={snagFiltersHref(project.id, filters, { page: results.page + 1 })}
                        >
                          Next page
                        </Link>
                      </Button>
                    ) : (
                      <span />
                    )}
                  </nav>
                ) : null}
              </>
            ) : (
              <p role="alert" className="px-6 py-8 text-sm text-destructive">
                Snags could not be loaded. Please refresh to try again.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'locations' ? (
        <Card className="gap-0 py-0">
          <CardHeader className="pb-3 pt-5">
            <CardTitle>Locations</CardTitle>
            <CardDescription>
              {projectLocations.length} locations ·{' '}
              {categories.filter((category) => category.project_id === project.id).length}{' '}
              categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectMetadata
              projectId={project.id}
              locations={projectLocations}
              categories={categories}
              editable={canAct(
                { id: workspace.user.id, isAdmin: workspace.profile?.is_admin ?? false },
                role,
                'project:edit',
              )}
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'team' ? (
        <Card className="gap-0 py-0">
          <CardHeader className="pb-3 pt-5">
            <CardTitle>Team</CardTitle>
            <CardDescription>Project access and invitations</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <TeamView projectId={project.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

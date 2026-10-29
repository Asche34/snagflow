import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isReviewer } from "@snagflow/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SnagList } from "@/components/snag-list";
import { loadWorkspace, personName, type Location } from "@/lib/data";
import { STATUS_LABELS, STATUS_ORDER, PROJECT_ROLE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Tab = "snags" | "locations" | "team";

const TABS: { id: Tab; label: string }[] = [
  { id: "snags", label: "Snags" },
  { id: "locations", label: "Locations" },
  { id: "team", label: "Team" },
];

type LocationNode = Location & { children: LocationNode[] };

function buildTree(locations: Location[]): LocationNode[] {
  const byParent = new Map<string | null, Location[]>();
  for (const location of locations) {
    const key = location.parent_id;
    byParent.set(key, [...(byParent.get(key) ?? []), location]);
  }

  const toNode = (location: Location): LocationNode => ({
    ...location,
    children: (byParent.get(location.id) ?? []).map(toNode),
  });

  return (byParent.get(null) ?? []).map(toNode);
}

function LocationBranch({ node, depth }: { node: LocationNode; depth: number }) {
  return (
    <li>
      <div className="flex min-w-0 items-center gap-2 py-2" style={{ paddingLeft: `${Math.min(depth, 4) * 0.75}rem` }}>
        <span className="min-w-0 break-words text-sm">{node.name}</span>
        {node.plan_path ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
            plan
          </span>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <LocationBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export async function ProjectView({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const [{ projectId }, { tab, status }] = await Promise.all([params, searchParams]);
  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const project = workspace.projects.find((candidate) => candidate.id === projectId);
  if (!project) notFound();

  const { snags, people, locations, categories, members, roles } = workspace;
  const role = roles.get(project.id) ?? (workspace.profile?.is_admin ? "manager" : null);
  const activeTab: Tab = tab === "locations" || tab === "team" ? tab : "snags";

  const projectSnags = snags.filter((snag) => snag.project_id === project.id);
  const projectLocations = locations.filter((location) => location.project_id === project.id);
  const projectMembers = members.filter((member) => member.project_id === project.id);
  const projectById = new Map(workspace.projects.map((candidate) => [candidate.id, candidate]));

  const visibleSnags = status
    ? projectSnags.filter((snag) => snag.status === status)
    : projectSnags;

  const closed = projectSnags.filter((snag) => snag.status === "closed").length;
  const percent = projectSnags.length ? Math.round((closed / projectSnags.length) * 100) : 0;
  const canReview = isReviewer({ isAdmin: workspace.profile?.is_admin ?? false, projectRole: role });

  const tabHref = (next: Tab, nextStatus?: string) => {
    const params = new URLSearchParams();
    params.set("tab", next);
    if (nextStatus) params.set("status", nextStatus);
    return `/projects/${project.id}?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Project workspace</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {project.code}
          </span>
          {role ? (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {PROJECT_ROLE_LABELS[role]}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {[project.client_name, project.address].filter(Boolean).join(" · ") ||
            "No client or address recorded."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-2xl font-semibold tabular-nums">{projectSnags.length}</p>
            <p className="text-xs text-muted-foreground">Total snags</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-2xl font-semibold tabular-nums">
              {projectSnags.filter((snag) => snag.status !== "closed").length}
            </p>
            <p className="text-xs text-muted-foreground">Still open</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-2xl font-semibold tabular-nums">
              {projectSnags.filter((snag) => snag.status === "ready_for_review").length}
            </p>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="px-4">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums">{percent}%</p>
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
            aria-current={activeTab === entry.id ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 items-center border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === entry.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {activeTab === "snags" ? (
        <Card className="gap-0 py-0">
          <CardHeader className="pb-3 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Snags</CardTitle>
                <CardDescription>
                  {status ? `Filtered by ${STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}` : "All snags in this project"}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-1">
                <FilterChip href={tabHref("snags")} label="All" active={!status} />
                {STATUS_ORDER.map((value) => (
                  <FilterChip
                    key={value}
                    href={tabHref("snags", value)}
                    label={STATUS_LABELS[value]}
                    active={status === value}
                  />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <SnagList
              snags={visibleSnags}
              people={people}
              projects={projectById}
              emptyLabel="No snags match this filter."
            />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "locations" ? (
        <Card className="gap-0 py-0">
          <CardHeader className="pb-3 pt-5">
            <CardTitle>Locations</CardTitle>
            <CardDescription>
              {projectLocations.length} locations ·{" "}
              {categories.filter((category) => category.project_id === project.id).length} categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No locations recorded yet.</p>
            ) : (
              <ul>
                {buildTree(projectLocations).map((node) => (
                  <LocationBranch key={node.id} node={node} depth={0} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "team" ? (
        <Card className="gap-0 py-0">
          <CardHeader className="pb-3 pt-5">
            <CardTitle>Team</CardTitle>
            <CardDescription>
                {projectMembers.length} people{canReview ? " · project team" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {projectMembers.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No members on this project.
              </p>
            ) : (
              <ul className="divide-y">
                {projectMembers.map((member) => (
                  <li key={member.user_id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {personName(people, member.user_id)}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">
                        {people.find((person) => person.id === member.user_id)?.email ?? "—"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {PROJECT_ROLE_LABELS[member.role]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

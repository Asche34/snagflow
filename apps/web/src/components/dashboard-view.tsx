import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ClipboardCheck, Clock3, Flag, UserRound } from "lucide-react";
import { canAct, isReviewer, type ProjectRole } from "@snagflow/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SnagList } from "@/components/snag-list";
import { loadWorkspace } from "@/lib/data";
import { describeDueDate } from "@/lib/dates";
import { PROJECT_ROLE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export async function DashboardView() {
  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const { user, profile, people } = workspace;
  const projects = workspace.projects.filter(project => project.status === 'active');
  const archivedProjects = workspace.projects.filter(project => project.status === 'archived');
  const activeProjectIds = new Set(projects.map(project => project.id));
  const snags = workspace.snags.filter(snag => activeProjectIds.has(snag.project_id));
  const isAdmin = profile?.is_admin ?? false;

  const roleOf = (projectId: string): ProjectRole | null =>
    workspace.roles.get(projectId) ?? (isAdmin ? "manager" : null);

  const projectById = new Map(projects.map((project) => [project.id, project]));

  const active = snags.filter((snag) => snag.status !== "closed");
  const reviewQueue = snags.filter((snag) => snag.status === "ready_for_review" && isReviewer({ isAdmin, projectRole: roleOf(snag.project_id) }));
  const overdue = active.filter((snag) => describeDueDate(snag.due_date).overdue);
  const unassigned = active.filter((snag) => !snag.assignee_id);
  const mine = active.filter((snag) => snag.assignee_id === user.id);

  const canReview = projects.some((project) => isReviewer({ isAdmin, projectRole: roleOf(project.id) }));
  const firstName = (profile?.full_name ?? user.email ?? "there").split(" ")[0];

  const stats = [
    { label: "Open snags", value: active.filter((snag) => snag.status === "open").length, tone: "text-foreground", icon: Building2, note: "Ready to get started" },
    { label: "In progress", value: active.filter((snag) => snag.status === "in_progress").length, tone: "text-foreground", icon: Clock3, note: "Work is underway" },
    { label: "Ready for review", value: snags.filter(snag => snag.status === "ready_for_review").length, tone: "text-primary", icon: ClipboardCheck, note: "Awaiting approval" },
    { label: "Overdue", value: overdue.length, tone: "text-destructive", icon: Flag, note: "Needs a follow-up" },
    { label: "Unassigned", value: unassigned.length, tone: "text-foreground", icon: UserRound, note: "Waiting for an owner" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Your day on site</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Good day, {firstName}.</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {canReview
            ? "Here is what needs a decision across your projects."
            : "Here is what is on your plate across your projects."}
        </p>
      </div>

      <div className="grid grid-cols-6 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className={cn("col-span-2 gap-1 py-4 sm:col-span-1 sm:order-0 sm:py-5", stat.label === "Ready for review" ? "order-first col-span-3 border-t-[3px] border-t-primary" : stat.label === "Overdue" ? "order-first col-span-3" : "order-1")}>
            <CardContent className="px-4 sm:px-5">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <div className="my-3 flex items-center justify-between gap-2"><p className={cn("text-3xl font-semibold leading-none tracking-tight tabular-nums", stat.tone)}>{stat.value}</p><stat.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden /></div>
              <p className="text-xs text-muted-foreground">{stat.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canReview ? (
            <Card role="region" aria-label="Review queue" className="gap-0 overflow-hidden py-0">
              <CardHeader className="pb-3 pt-5">
                <CardTitle className="flex items-center gap-2">Review queue <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{reviewQueue.length}</span></CardTitle>
                <CardDescription>Snags waiting for your approval</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <SnagList
                  snags={reviewQueue}
                  people={people}
                  projects={projectById}
                  emptyLabel="Nothing waiting for review."
                />
              </CardContent>
            </Card>
          ) : null}

          <Card id="my-snags" className="gap-0 overflow-hidden py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>My snags</CardTitle>
              <CardDescription>Assigned to you and still open</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <SnagList
                snags={mine}
                people={people}
                projects={projectById}
                emptyLabel="Nothing assigned to you right now."
              />
            </CardContent>
          </Card>

          {canReview ? (
            <Card className="gap-0 py-0">
              <CardHeader className="pb-3 pt-5">
                <CardTitle>Overdue</CardTitle>
                <CardDescription>Past their due date and not closed</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <SnagList
                  snags={overdue}
                  people={people}
                  projects={projectById}
                  emptyLabel="Nothing overdue."
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="h-fit gap-0 overflow-hidden py-0">
          <CardHeader className="pb-3 pt-5">
            <CardTitle>Projects</CardTitle>
            <CardDescription>Progress by closed snags</CardDescription>
            {profile?.is_active && canAct({ id: user.id, isAdmin }, null, 'project:create') ? <Button asChild className="mt-2 w-fit"><Link href="/projects/new">New project</Link></Button> : null}
          </CardHeader>
          <CardContent className="px-0">
            {projects.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No active projects available.
              </p>
            ) : (
              <ul className="divide-y">
                {projects.map((project) => {
                  const projectSnags = snags.filter((snag) => snag.project_id === project.id);
                  const closed = projectSnags.filter((snag) => snag.status === "closed").length;
                  const percent = projectSnags.length
                    ? Math.round((closed / projectSnags.length) * 100)
                    : 0;
                  const role = roleOf(project.id);

                  return (
                    <li key={project.id}>
                      <Link href={`/projects/${project.id}`} className="block px-6 py-4 hover:bg-muted/50">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 break-words text-sm font-semibold leading-relaxed">{project.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {closed}/{projectSnags.length}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-success"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {project.code}
                          {role ? ` · ${PROJECT_ROLE_LABELS[role]}` : ""}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {archivedProjects.length ? <details className="border-t px-6 py-4">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">Archived projects</summary>
              <ul>{archivedProjects.map(project => <li key={project.id}><Link href={`/projects/${project.id}`} className="inline-flex min-h-11 items-center break-words py-2 text-sm text-muted-foreground hover:text-primary">{project.name}</Link></li>)}</ul>
            </details> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

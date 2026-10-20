import Link from "next/link";
import { redirect } from "next/navigation";
import { isReviewer, type ProjectRole } from "@snagflow/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SnagList } from "@/components/snag-list";
import { loadWorkspace } from "@/lib/data";
import { describeDueDate } from "@/lib/dates";
import { PROJECT_ROLE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export async function DashboardView() {
  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const { user, profile, projects, snags, people } = workspace;
  const isAdmin = profile?.is_admin ?? false;

  const roleOf = (projectId: string): ProjectRole | null =>
    workspace.roles.get(projectId) ?? (isAdmin ? "manager" : null);

  const projectById = new Map(projects.map((project) => [project.id, project]));

  const active = snags.filter((snag) => snag.status !== "closed");
  const reviewQueue = snags.filter((snag) => snag.status === "ready_for_review");
  const overdue = active.filter((snag) => describeDueDate(snag.due_date).overdue);
  const unassigned = active.filter((snag) => !snag.assignee_id);
  const mine = active.filter((snag) => snag.assignee_id === user.id);

  const canReview = projects.some((project) => isReviewer({ isAdmin, projectRole: roleOf(project.id) }));
  const firstName = (profile?.full_name ?? user.email ?? "there").split(" ")[0];

  const stats = [
    { label: "Open", value: active.filter((snag) => snag.status === "open").length, tone: "text-foreground" },
    { label: "In progress", value: active.filter((snag) => snag.status === "in_progress").length, tone: "text-foreground" },
    { label: "Ready for review", value: reviewQueue.length, tone: "text-amber-600" },
    { label: "Overdue", value: overdue.length, tone: "text-destructive" },
    { label: "Unassigned", value: unassigned.length, tone: "text-foreground" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Good day, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          {canReview
            ? "Here is what needs a decision across your projects."
            : "Here is what is on your plate across your projects."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-1 py-4">
            <CardContent className="px-4">
              <p className={cn("text-2xl font-semibold tabular-nums", stat.tone)}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canReview ? (
            <Card className="gap-0 py-0">
              <CardHeader className="pb-3 pt-5">
                <CardTitle>Review queue</CardTitle>
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

          <Card className="gap-0 py-0">
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

        <Card className="gap-0 py-0">
          <CardHeader className="pb-3 pt-5">
            <CardTitle>Projects</CardTitle>
            <CardDescription>Progress by closed snags</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {projects.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                You are not a member of any project yet.
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
                          <span className="truncate text-sm font-medium">{project.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {closed}/{projectSnags.length}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

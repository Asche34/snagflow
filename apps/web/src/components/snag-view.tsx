import Link from "next/link";
import { notFound } from "next/navigation";
import {
  canWorkOnSnag,
  isReviewer,
  transitionsFrom,
  type TransitionRule,
} from "@snagflow/shared";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SnagActions } from "@/components/snag-actions";
import { initialsOf, loadSnagDetail, personName } from "@/lib/data";
import { describeDueDate, formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export async function SnagView({ params }: { params: Promise<{ snagId: string }> }) {
  const { snagId } = await params;
  const detail = await loadSnagDetail(snagId);
  if (!detail) notFound();

  const { snag, project, role, isAdmin, comments, activity, photos, people, userId } = detail;
  const due = describeDueDate(snag.due_date);

  const allowed: TransitionRule[] = transitionsFrom(snag.status).filter((rule) => {
    if (rule.actor === "managerOnly") {
      return isReviewer({ isAdmin, projectRole: role });
    }
    return canWorkOnSnag({
      actorId: userId,
      isAdmin,
      projectRole: role,
      scope: {
        createdById: snag.created_by,
        assigneeId: snag.assignee_id,
        status: snag.status,
      },
    });
  });

  const canComment = role === "member" || role === "manager" || isAdmin;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-3">
        {project ? (
          <Link
            href={`/projects/${project.id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {project.name}
          </Link>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">#{snag.number}</span>
              <StatusBadge status={snag.status} />
              <PriorityBadge priority={snag.priority} />
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{snag.title}</h1>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-foreground/90">
                {snag.description?.trim() || "No description was added."}
              </p>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Photos</CardTitle>
              <CardDescription>Issue and fix photos</CardDescription>
            </CardHeader>
            <CardContent>
              {photos.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No photos yet. Photo capture lands with the Phase 2 upload work.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <li
                      key={photo.id}
                      className="flex aspect-4/3 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground"
                    >
                      {photo.kind} photo
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Comments</CardTitle>
              <CardDescription>{comments.length} in the thread</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="space-y-4">
                  {comments.map((comment) => {
                    const author = people.find((person) => person.id === comment.author_id);
                    const name = author?.full_name ?? "Unknown";
                    return (
                      <li key={comment.id} className="flex gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                          {initialsOf(name)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{name}</span>{" "}
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(comment.created_at)}
                            </span>
                          </p>
                          <p className="mt-0.5 whitespace-pre-line text-sm text-foreground/90">
                            {comment.body}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Activity</CardTitle>
              <CardDescription>Audit trail</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((entry) => (
                    <li key={entry.id} className="flex gap-3 text-sm">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <div>
                        <p>
                          <span className="font-medium">{personName(people, entry.actor_id)}</span>{" "}
                          <span className="text-muted-foreground">{describeAction(entry.action)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Assignee" value={personName(people, snag.assignee_id)} />
              <DetailRow label="Created by" value={personName(people, snag.created_by)} />
              <DetailRow label="Due" value={due.label} tone={due.overdue ? "danger" : undefined} />
              <DetailRow label="Created" value={formatDate(snag.created_at)} />
              {snag.closed_at ? (
                <DetailRow label="Closed" value={formatDate(snag.closed_at)} />
              ) : null}
              {snag.rejection_count > 0 ? (
                <DetailRow label="Rejections" value={String(snag.rejection_count)} />
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Actions</CardTitle>
              <CardDescription>Enforced by the database</CardDescription>
            </CardHeader>
            <CardContent>
              <SnagActions snagId={snag.id} transitions={allowed} canComment={canComment} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-medium", tone === "danger" && "text-destructive")}>
        {value}
      </span>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  assigned: "assigned this snag",
  status_changed: "changed the status",
  rejected: "sent it back",
  approved: "approved it",
  reopened: "reopened it",
  created: "created this snag",
  commented: "commented",
};

function describeAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

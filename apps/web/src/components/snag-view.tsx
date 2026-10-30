import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  canWorkOnSnag,
  canAct,
  canEditSnagDetails,
  isReviewer,
  transitionsFrom,
  type TransitionRule,
} from '@snagflow/shared';
import { PriorityBadge, StatusBadge } from '@/components/badges';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SnagPhotos } from '@/components/snag-photos';
import { SnagActions } from '@/components/snag-actions';
import { CommentForm } from '@/components/comment-form';
import { SnagAssignment } from '@/components/snag-assignment';
import { LifecycleControl } from '@/components/lifecycle-control';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { initialsOf, loadSnagDetail, personName } from '@/lib/data';
import { describeDueDate, formatDate, formatDateTime } from '@/lib/dates';
import { cn } from '@/lib/utils';

export async function SnagView({ params }: { params: Promise<{ snagId: string }> }) {
  const { snagId } = await params;
  const detail = await loadSnagDetail(snagId);
  if (!detail) notFound();

  const {
    snag,
    project,
    role,
    isAdmin,
    comments,
    commentsUnavailable,
    activity,
    photos,
    people,
    userId,
  } = detail;
  const due = describeDueDate(snag.due_date);
  const canEdit = canEditSnagDetails({
    actorId: userId,
    isAdmin,
    projectRole: role,
    scope: { createdById: snag.created_by, assigneeId: snag.assignee_id, status: snag.status },
  });
  const reviewer = isReviewer({ isAdmin, projectRole: role });
  const members = reviewer
    ? ((
        await (
          await createClient()
        )
          .from('project_members')
          .select('user_id,role')
          .eq('project_id', snag.project_id)
          .neq('role', 'viewer')
      ).data ?? [])
    : [];
  const assignees = members.flatMap((member) => {
    const person = people.find((person) => person.id === member.user_id && person.is_active);
    return person ? [{ id: person.id, name: person.full_name || person.email }] : [];
  });

  const allowed: TransitionRule[] = transitionsFrom(snag.status).filter((rule) => {
    if (rule.actor === 'managerOnly') {
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

  const canComment = canAct({ id: userId, isAdmin }, role, 'snag:comment');

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="space-y-3">
        {project ? (
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex min-h-11 items-center break-words text-sm text-muted-foreground hover:text-primary"
          >
            ← {project.name}
          </Link>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">#{snag.number}</span>
              <StatusBadge status={snag.status} />
              <PriorityBadge priority={snag.priority} />
            </div>
            <h1 className="mt-3 break-words text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {snag.title}
            </h1>
          </div>
          {canEdit ? (
            <Button asChild variant="outline">
              <Link href={`/snags/${snag.id}/edit`}>Edit snag</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <p className="whitespace-pre-line text-sm text-foreground/90">
                {snag.description?.trim() || 'No description was added.'}
              </p>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Photos</CardTitle>
              <CardDescription>Issue and fix photos</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <SnagPhotos
                photos={photos}
                projectId={snag.project_id}
                snagId={snag.id}
                canUpload={canComment}
              />
            </CardContent>
          </Card>

          <Card role="region" aria-labelledby="comments-heading" className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle id="comments-heading">Comments</CardTitle>
              <CardDescription>
                {commentsUnavailable
                  ? 'Thread temporarily unavailable'
                  : `${comments.length} in the thread`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              {commentsUnavailable ? (
                <div className="space-y-2">
                  <p role="alert" className="text-sm text-destructive">
                    Comments could not be loaded. Refresh to try again.
                  </p>
                  <a
                    className="inline-flex min-h-11 items-center text-sm underline"
                    href={`/snags/${snag.id}`}
                  >
                    Refresh comments
                  </a>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="space-y-4">
                  {comments.map((comment) => {
                    const author = people.find((person) => person.id === comment.author_id);
                    const name = author?.full_name ?? 'Unknown';
                    return (
                      <li key={comment.id} className="flex gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                          {initialsOf(name)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{name}</span>{' '}
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(comment.created_at)}
                            </span>
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90 [overflow-wrap:anywhere]">
                            {comment.body}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {canComment ? (
                <CommentForm snagId={snag.id} />
              ) : (
                <p className="border-t pt-4 text-sm text-muted-foreground">
                  Your role can read comments. A project member or manager can post updates.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Activity</CardTitle>
              <CardDescription>Audit trail</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((entry) => (
                    <li key={entry.id} className="flex gap-3 text-sm">
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                      <div>
                        <p>
                          <span className="font-medium">{personName(people, entry.actor_id)}</span>{' '}
                          <span className="text-muted-foreground">
                            {describeAction(entry.action)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-6 text-sm">
              <DetailRow label="Assignee" value={personName(people, snag.assignee_id)} />
              <DetailRow label="Created by" value={personName(people, snag.created_by)} />
              <DetailRow label="Due" value={due.label} tone={due.overdue ? 'danger' : undefined} />
              <DetailRow label="Created" value={formatDate(snag.created_at)} />
              {snag.closed_at ? (
                <DetailRow label="Closed" value={formatDate(snag.closed_at)} />
              ) : null}
              {snag.rejection_count > 0 ? (
                <DetailRow label="Rejections" value={String(snag.rejection_count)} />
              ) : null}
            </CardContent>
          </Card>

          {reviewer ? (
            <Card>
              <CardHeader>
                <CardTitle>Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <SnagAssignment
                  snagId={snag.id}
                  assigneeId={snag.assignee_id}
                  options={assignees}
                />
              </CardContent>
            </Card>
          ) : null}
          <Card className="gap-0 py-0">
            <CardHeader className="pb-3 pt-5">
              <CardTitle>Actions</CardTitle>
              <CardDescription>Available actions for your role</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <SnagActions snagId={snag.id} transitions={allowed} />
              {canAct({ id: userId, isAdmin }, role, 'snag:soft-delete') ? (
                <div className="mt-5 border-t pt-4">
                  <LifecycleControl
                    kind="snag"
                    id={snag.id}
                    name={`#${snag.number} · ${snag.title}`}
                    projectId={snag.project_id}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'min-w-0 break-words text-right font-medium',
          tone === 'danger' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  assigned: 'assigned this snag',
  status_changed: 'changed the status',
  rejected: 'sent it back',
  approved: 'approved it',
  reopened: 'reopened it',
  created: 'created this snag',
  commented: 'commented',
};

function describeAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ');
}

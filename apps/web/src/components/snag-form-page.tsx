import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { canAct, canEditSnagDetails } from '@snagflow/shared';
import { loadWorkspace } from '@/lib/data';
import { SnagForm } from './snag-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

export async function SnagFormPage({
  params,
}: {
  params: Promise<{ projectId?: string; snagId?: string }>;
}) {
  const route = await params;
  const workspace = await loadWorkspace();
  if (!workspace) redirect('/login');
  const initial = route.snagId
    ? workspace.snags.find((snag) => snag.id === route.snagId && !snag.deleted_at)
    : undefined;
  if (route.snagId && !initial) notFound();
  const projectId = initial?.project_id ?? route.projectId;
  const project = workspace.projects.find((project) => project.id === projectId);
  if (!project) notFound();
  const role = workspace.roles.get(project.id) ?? null;
  const actor = { id: workspace.user.id, isAdmin: workspace.profile?.is_admin ?? false };
  if (!workspace.profile?.is_active || !canAct(actor, role, 'snag:create')) notFound();
  if (
    initial &&
    !canEditSnagDetails({
      actorId: actor.id,
      isAdmin: actor.isAdmin,
      projectRole: role,
      scope: {
        createdById: initial.created_by,
        assigneeId: initial.assignee_id,
        status: initial.status,
      },
    })
  )
    notFound();
  const assignees = workspace.members
    .filter((member) => member.project_id === project.id && member.role !== 'viewer')
    .flatMap((member) => {
      const person = workspace.people.find(
        (person) => person.id === member.user_id && person.is_active,
      );
      return person ? [{ id: person.id, name: person.full_name || person.email }] : [];
    });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary"
        href={initial ? `/snags/${initial.id}` : `/projects/${project.id}`}
      >
        ← {initial ? 'Back to snag' : project.name}
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {project.name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {initial ? 'Edit snag' : 'New snag'}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{initial ? 'Snag details' : 'What needs fixing?'}</CardTitle>
          <CardDescription>
            {initial
              ? 'Update the details. Workflow and assignment are managed on the snag page.'
              : 'Give the issue a clear title and add the details your team needs.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SnagForm
            projectId={project.id}
            initial={initial}
            locations={workspace.locations
              .filter((item) => item.project_id === project.id)
              .map((item) => ({ id: item.id, name: item.name }))}
            categories={workspace.categories
              .filter((item) => item.project_id === project.id)
              .map((item) => ({ id: item.id, name: item.name }))}
            assignees={assignees}
            canAssign={canAct(actor, role, 'snag:assign')}
          />
        </CardContent>
      </Card>
    </div>
  );
}

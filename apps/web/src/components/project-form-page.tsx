import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { canAct, UUIDSchema } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import { ProjectForm } from '@/components/project-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export async function ProjectFormPage({ params }: { params?: Promise<{ projectId: string }> }) {
  const projectId = params ? (await params).projectId : undefined;
  if (projectId && !UUIDSchema.safeParse(projectId).success) notFound();
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: profile }, { data: project, error: projectError }, { data: membership }] =
    await Promise.all([
      client.from('profiles').select('is_admin,is_active').eq('id', user.id).maybeSingle(),
      projectId
        ? client.from('projects').select('*').eq('id', projectId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      projectId
        ? client
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  if (projectError) throw new Error('Project details could not be loaded. Try again.');
  if (
    (projectId && !project) ||
    !profile?.is_active ||
    !canAct(
      { id: user.id, isAdmin: profile.is_admin },
      membership?.role ?? null,
      projectId ? 'project:edit' : 'project:create',
    )
  )
    notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={project ? `/projects/${project.id}` : '/dashboard'}
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary"
      >
        ← {project ? 'Back to project' : 'Back to overview'}
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Project workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {project ? 'Edit project' : 'New project'}
        </h1>
      </div>
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Project details</CardTitle>
          <CardDescription>
            {project
              ? 'Update site details and the fix-evidence setting.'
              : 'Set up the site your team will work on.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <ProjectForm initial={project ?? undefined} />
        </CardContent>
      </Card>
    </div>
  );
}

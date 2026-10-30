import { redirect } from 'next/navigation';
import { loadWorkspace } from '@/lib/data';
import { PROJECT_ROLE_LABELS } from '@/lib/labels';
import { WorkspaceNavigation } from '@/components/workspace-navigation';
import { canAct } from '@snagflow/shared';

export async function AppSidebar() {
  const workspace = await loadWorkspace();
  if (!workspace) redirect('/login');
  const isAdmin = workspace.profile?.is_admin ?? false;
  return (
    <WorkspaceNavigation
      isAdmin={isAdmin}
      canCreateProject={
        !!workspace.profile?.is_active &&
        canAct({ id: workspace.user.id, isAdmin }, null, 'project:create')
      }
      projects={workspace.projects.filter(project => project.status === 'active').map((project) => ({
        id: project.id,
        name: project.name,
        code: project.code,
        roleLabel: isAdmin
          ? 'Admin'
          : PROJECT_ROLE_LABELS[workspace.roles.get(project.id) ?? 'viewer'],
      }))}
    />
  );
}

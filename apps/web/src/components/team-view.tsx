import { canAct, type ProjectRole } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import { TeamManager } from '@/components/team-manager';
import { PROJECT_ROLE_LABELS } from '@/lib/labels';

export type TeamPerson = {
  id: string;
  full_name: string;
  email: string;
  role: ProjectRole;
  is_active: boolean;
};
export type PendingInvite = {
  id: string;
  email: string;
  role: ProjectRole;
  expires_at: string;
  invited_by: string;
};
export async function TeamView({ projectId }: { projectId: string }) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const [self, role, members] = await Promise.all([
    client.from('profiles').select('is_admin,is_active').eq('id', user.id).maybeSingle(),
    client
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle(),
    client
      .from('project_members')
      .select('user_id,role')
      .eq('project_id', projectId)
      .order('created_at'),
  ]);
  const actor = { id: user.id, isAdmin: self.data?.is_admin ?? false };
  const canManage =
    !!self.data?.is_active && canAct(actor, role.data?.role ?? null, 'project:manage-members');
  const people = members.data?.length
    ? await client
        .from('profiles')
        .select('id,full_name,email,is_active')
        .in(
          'id',
          members.data.map((m) => m.user_id),
        )
    : { data: [], error: null };
  // Never select bearer tokens into roster props, including for administrators.
  const invites = canManage
    ? await client
        .from('invites')
        .select('id,email,role,expires_at,invited_by')
        .eq('project_id', projectId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
    : { data: [], error: null };
  if (self.error || role.error || members.error || people.error || invites.error)
    return (
      <p role="alert" className="p-6 text-sm text-destructive">
        Team could not be loaded. Refresh and try again.
      </p>
    );
  const roster: TeamPerson[] = (members.data ?? []).map((m) => ({
    id: m.user_id,
    role: m.role,
    full_name: people.data?.find((p) => p.id === m.user_id)?.full_name ?? 'Unknown',
    email: people.data?.find((p) => p.id === m.user_id)?.email ?? '',
    is_active: people.data?.find((p) => p.id === m.user_id)?.is_active ?? false,
  }));
  return (
    <section aria-label="Project team" className="space-y-5">
      {canManage ? (
        <TeamManager
          projectId={projectId}
          roster={roster}
          invites={invites.data ?? []}
          userId={user.id}
          canInvite={canAct(actor, null, 'org:manage-users')}
        />
      ) : (
        <ul className="divide-y">
          {roster.map((person) => (
            <li
              key={person.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-6 py-4"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{person.full_name}</p>
                <p className="break-all text-xs text-muted-foreground">{person.email}</p>
              </div>
              <span className="rounded-md bg-secondary px-2 py-1 text-xs">
                {PROJECT_ROLE_LABELS[person.role]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

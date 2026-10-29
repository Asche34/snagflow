'use server';
import { revalidatePath } from 'next/cache';
import { ProjectMemberAddSchema, ProjectMemberChangeSchema, UUIDSchema } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import { teamError } from '@/lib/team-errors';

export type TeamActionResult = { error?: string; leftProject?: boolean };
export async function addProjectMember(input: unknown): Promise<TeamActionResult> {
  const parsed = ProjectMemberAddSchema.safeParse(input);
  if (!parsed.success) return { error: 'Enter a valid account email and project role.' };
  const client = await createClient();
  const { error } = await client.rpc('add_project_member', {
    p_project_id: parsed.data.projectId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return { error: teamError(error.message) };
  revalidatePath('/', 'layout');
  return {};
}
export async function changeProjectMember(input: unknown): Promise<TeamActionResult> {
  const parsed = ProjectMemberChangeSchema.safeParse(input);
  if (!parsed.success) return { error: 'Choose a valid person and project role.' };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const { error } = await client.rpc('set_project_member', {
    p_project_id: parsed.data.projectId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role as 'manager' | 'member' | 'viewer',
  });
  // Supabase's generated RPC types omit SQL nullability; NULL means remove in this RPC.
  if (error) return { error: teamError(error.message) };
  revalidatePath('/', 'layout');
  return { leftProject: parsed.data.userId === user?.id && parsed.data.role === null };
}
export async function cancelProjectInvitation(id: unknown): Promise<TeamActionResult> {
  const parsed = UUIDSchema.safeParse(id);
  if (!parsed.success) return { error: 'Choose a valid pending invitation.' };
  const client = await createClient();
  const { error } = await client.rpc('cancel_project_invite', { p_id: parsed.data });
  if (error) return { error: teamError(error.message) };
  revalidatePath('/', 'layout');
  return {};
}

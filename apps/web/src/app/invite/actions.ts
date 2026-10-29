'use server';
import { revalidatePath } from 'next/cache';
import { ProjectInviteAcceptSchema } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import { teamError } from '@/lib/team-errors';

export async function acceptInvitation(
  input: unknown,
): Promise<{ projectId?: string; error?: string }> {
  const parsed = ProjectInviteAcceptSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Enter your name and a password of at least eight characters.' };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: 'Open the link in your invitation email before joining.' };
  const { data, error } = await client.rpc('get_my_project_invite', { p_token: parsed.data.token });
  const invite = data?.[0];
  if (error || !invite) return { error: teamError('INVITE_INVALID') };
  if (!invite.accepted) {
    const changed = await client.auth.updateUser({ password: parsed.data.password });
    if (changed.error)
      return { error: 'The password could not be saved. Use a longer password and try again.' };
  }
  const accepted = await client.rpc('accept_project_invite', {
    p_token: parsed.data.token,
    p_full_name: parsed.data.fullName,
  });
  if (accepted.error) return { error: teamError(accepted.error.message) };
  revalidatePath('/', 'layout');
  return { projectId: accepted.data };
}

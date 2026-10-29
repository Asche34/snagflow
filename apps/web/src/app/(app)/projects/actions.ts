'use server';

import { revalidatePath } from 'next/cache';
import { ProjectCreateSchema, UUIDSchema, canAct } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';

export type SaveProjectResult = {
  projectId?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function saveProject(input: unknown): Promise<SaveProjectResult> {
  const parsed = ProjectCreateSchema.extend({
    clientId: UUIDSchema,
    projectId: UUIDSchema.optional(),
  }).safeParse(input);
  if (!parsed.success)
    return {
      error: 'Check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  const values = parsed.data;
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: 'Sign in again before saving this project.' };
  const { data: profile } = await client
    .from('profiles')
    .select('is_admin,is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.is_active) return { error: 'You no longer have permission to save this project.' };
  const actor = { id: user.id, isAdmin: profile.is_admin };
  const projectId = values.projectId ?? values.clientId;
  const { data: membership } = values.projectId
    ? await client
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };
  if (
    !canAct(actor, membership?.role ?? null, values.projectId ? 'project:edit' : 'project:create')
  )
    return { error: 'You no longer have permission to save this project.' };

  // Explicit allowlist: counters, creator, state and membership never come from this form.
  const details = {
    name: values.name,
    code: values.code,
    description: values.description || null,
    client_name: values.clientName || null,
    address: values.address || null,
    require_fix_photo: values.requireFixPhoto,
  };
  const failure = (code?: string): SaveProjectResult =>
    code === '23505'
      ? {
          error: 'This project code is already in use. Choose another code.',
          fieldErrors: { code: ['This project code is already in use.'] },
        }
      : { error: 'The project could not be saved. Check your permission and try again.' };
  const finish = (): SaveProjectResult => {
    revalidatePath('/', 'layout');
    return { projectId };
  };
  const update = async (creatorId?: string): Promise<SaveProjectResult> => {
    let query = client.from('projects').update(details).eq('id', projectId);
    if (creatorId) query = query.eq('created_by', creatorId);
    const { data, error } = await query.select('id').maybeSingle();
    return error || !data ? failure(error?.code) : finish();
  };
  if (values.projectId) return update();

  const existing = await client
    .from('projects')
    .select('id,created_by')
    .eq('id', projectId)
    .maybeSingle();
  if (existing.error) return failure(existing.error.code);
  if (existing.data) {
    if (existing.data.created_by !== user.id)
      return { error: 'This draft identity is already in use. Reload to start a new project.' };
    // A committed create response may have been lost. Apply the current draft on retry.
    return update(user.id);
  }
  const { data, error } = await client
    .from('projects')
    .insert({ id: projectId, created_by: user.id, ...details })
    .select('id')
    .maybeSingle();
  if (data && !error) return finish();
  if (error?.code === '23505') {
    // Concurrent replay with the same identity may have committed after our lookup.
    const committed = await client
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .maybeSingle();
    if (committed.data?.created_by === user.id) return update(user.id);
  }
  return failure(error?.code);
}

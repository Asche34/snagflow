'use server';

import { revalidatePath } from 'next/cache';
import { UUIDSchema } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';

export type LifecycleResult = { error?: string; destination?: string };

export async function setProjectArchived(projectId: string, archived: boolean): Promise<LifecycleResult> {
  if (!UUIDSchema.safeParse(projectId).success || typeof archived !== 'boolean')
    return { error: 'Invalid project. Reload this page and try again.' };
  const client = await createClient();
  // User-session UPDATE RLS checks current active admin/project manager authority.
  // Selecting the affected row distinguishes denial/missing project from success.
  const { data, error } = await client.from('projects')
    .update({ status: archived ? 'archived' : 'active' })
    .eq('id', projectId).select('id').maybeSingle();
  if (error || !data)
    return { error: 'The project could not be updated. Check your permission and try again.' };
  revalidatePath('/', 'layout');
  return { destination: archived ? '/dashboard' : `/projects/${data.id}` };
}

export async function deleteSnag(snagId: string): Promise<LifecycleResult> {
  if (!UUIDSchema.safeParse(snagId).success)
    return { error: 'Invalid snag. Reload this page and try again.' };
  const client = await createClient();
  const { data: snag, error: readError } = await client.from('snags')
    .select('project_id').eq('id', snagId).maybeSingle();
  if (readError || !snag)
    return { error: 'This snag is already deleted or you no longer have access. Return to the project to refresh the list.' };
  // The existing RPC locks the row, checks live authority and appends the deletion audit.
  const { error } = await client.rpc('soft_delete_snag', { p_snag_id: snagId });
  if (error)
    return { error: 'The snag could not be deleted. Check your permission and try again, or return to the project to refresh the list.' };
  revalidatePath('/', 'layout');
  return { destination: `/projects/${snag.project_id}` };
}

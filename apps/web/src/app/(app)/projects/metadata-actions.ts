'use server';

import { revalidatePath } from 'next/cache';
import { CategoryCreateSchema, LocationCreateSchema, UUIDSchema, canAct } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export type MetadataResult = { ok?: boolean; error?: string };

export async function saveMetadata(
  input: unknown,
  kind: 'location' | 'category',
  remove = false,
): Promise<MetadataResult> {
  if (kind !== 'location' && kind !== 'category') return { error: 'Unknown record type.' };
  const parsed = LocationCreateSchema.extend({ id: UUIDSchema, creating: z.boolean() }).safeParse(
    input,
  );
  if (!parsed.success)
    return { error: 'Enter a valid name, project, parent and nonnegative whole-number order.' };
  const values = parsed.data;
  if (kind === 'category' && !CategoryCreateSchema.safeParse(values).success)
    return { error: 'Enter a category name between 1 and 60 characters.' };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: 'Sign in again before saving.' };
  const [{ data: profile }, { data: membership }] = await Promise.all([
    client.from('profiles').select('is_admin,is_active').eq('id', user.id).maybeSingle(),
    client
      .from('project_members')
      .select('role')
      .eq('project_id', values.projectId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  if (
    !profile?.is_active ||
    !canAct({ id: user.id, isAdmin: profile.is_admin }, membership?.role ?? null, 'project:edit')
  )
    return { error: 'You no longer have permission to manage this project.' };
  const table = kind === 'location' ? 'locations' : 'categories';
  const details = {
    name: values.name,
    parent_id: values.parentId ?? null,
    sort_order: values.sortOrder,
  };
  const failure = (code?: string): MetadataResult => ({
    error:
      code === '23503'
        ? 'This record is still used by a snag or child location, including historical records. Rename it instead, or move its children first.'
        : code === '23505'
          ? 'This category name is already in use. Choose another name.'
          : code === '23514'
            ? 'Choose a parent in this project outside this location’s own branch, and a valid name and order.'
            : 'The change could not be confirmed. Check your access and refresh the list before retrying.',
  });
  let result;
  if (remove)
    result = await client
      .from(table)
      .delete()
      .eq('id', values.id)
      .eq('project_id', values.projectId)
      .select('id')
      .maybeSingle();
  else if (values.creating) {
    // Stable UUID insert: only exact replays are acknowledged; never overwrite another draft.
    const identity = { id: values.id, project_id: values.projectId };
    result =
      kind === 'location'
        ? await client
            .from('locations')
            .insert({ ...identity, ...details })
            .select('id')
            .maybeSingle()
        : await client
            .from('categories')
            .insert({ ...identity, name: values.name })
            .select('id')
            .maybeSingle();
    if (result.error?.code === '23505') {
      const existing =
        kind === 'location'
          ? await client
              .from('locations')
              .select('*')
              .eq('id', values.id)
              .eq('project_id', values.projectId)
              .maybeSingle()
          : await client
              .from('categories')
              .select('*')
              .eq('id', values.id)
              .eq('project_id', values.projectId)
              .maybeSingle();
      const savedLocation =
        kind === 'location'
          ? await client
              .from('locations')
              .select('parent_id,sort_order')
              .eq('id', values.id)
              .eq('project_id', values.projectId)
              .maybeSingle()
          : null;
      if (
        existing.data &&
        existing.data.name === details.name &&
        (kind === 'category' ||
          (savedLocation?.data?.parent_id === details.parent_id &&
            savedLocation.data.sort_order === details.sort_order))
      )
        result = { data: { id: values.id }, error: null };
      else if (existing.data)
        return {
          error:
            'The earlier draft was saved. Refresh the list and edit that record to apply your changes.',
        };
    }
  } else
    result =
      kind === 'location'
        ? await client
            .from('locations')
            .update(details)
            .eq('id', values.id)
            .eq('project_id', values.projectId)
            .select('id')
            .maybeSingle()
        : await client
            .from('categories')
            .update({ name: values.name })
            .eq('id', values.id)
            .eq('project_id', values.projectId)
            .select('id')
            .maybeSingle();
  if (result.error || !result.data) return failure(result.error?.code);
  revalidatePath('/', 'layout');
  return { ok: true };
}

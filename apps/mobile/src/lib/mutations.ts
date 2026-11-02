import {
  SnagCreateSchema,
  SnagUpdateSchema,
  CommentCreateSchema,
  SnagAssignSchema,
  SnagTransitionSchema,
  type SnagCreate,
} from '@snagflow/shared';
import { supabase } from './supabase';
import { stableWrite } from './online';
import { assertConnectionClient } from './connection';
async function userId(client: typeof supabase) {
  assertConnectionClient(client, supabase);
  const { data, error } = await client.auth.getUser();
  assertConnectionClient(client, supabase);
  if (error || !data.user) throw Error('Sign in again before saving.');
  return data.user.id;
}
export async function saveSnag(input: SnagCreate, client = supabase) {
  const value = SnagCreateSchema.parse(input);
  const actor = await userId(client);
  const details = {
    title: value.title,
    description: value.description ?? null,
    priority: value.priority,
    category_id: value.categoryId ?? null,
    location_id: value.locationId ?? null,
    due_date: value.dueDate ?? null,
  };
  // The BEFORE INSERT trigger replaces this placeholder with its locked project counter.
  const row = await stableWrite(
    async () => {
      const r = await client
        .from('snags')
        .select('*')
        .eq('client_id', value.clientId)
        .maybeSingle();
      if (r.error) throw r.error;
      if (r.data && (r.data.project_id !== value.projectId || r.data.created_by !== actor))
        throw Error('Create identity belongs to another request.');
      return r.data;
    },
    async () => {
      const r = await client
        .from('snags')
        .insert({
          ...details,
          number: 0,
          client_id: value.clientId,
          project_id: value.projectId,
          created_by: actor,
        })
        .select('*')
        .single();
      if (r.error) throw r.error;
      return r.data;
    },
  );
  if (Object.entries(details).some(([key, value]) => row[key as keyof typeof row] !== value))
    await updateSnag(
      row.id,
      {
        title: value.title,
        description: value.description ?? null,
        priority: value.priority,
        categoryId: value.categoryId ?? null,
        locationId: value.locationId ?? null,
        dueDate: value.dueDate ?? null,
      },
      client,
    );
  if (value.assigneeId !== undefined && row.assignee_id !== value.assigneeId)
    await assignSnag(row.id, value.assigneeId, client);
  assertConnectionClient(client, supabase);
  return row;
}
export async function updateSnag(id: string, input: unknown, client = supabase) {
  assertConnectionClient(client, supabase);
  const v = SnagUpdateSchema.parse(input);
  const r = await client
    .from('snags')
    .update({
      title: v.title,
      description: v.description,
      priority: v.priority,
      category_id: v.categoryId,
      location_id: v.locationId,
      due_date: v.dueDate,
    })
    .eq('id', id)
    .select('id')
    .single();
  if (r.error) throw r.error;
  assertConnectionClient(client, supabase);
}
export async function assignSnag(snagId: string, assigneeId: string | null, client = supabase) {
  assertConnectionClient(client, supabase);
  const v = SnagAssignSchema.parse({ snagId, assigneeId });
  // Generated PostgreSQL Args omit nullable parameters; RPC explicitly accepts NULL to unassign.
  const r = await client.rpc('assign_snag', {
    p_snag_id: v.snagId,
    p_assignee_id: v.assigneeId as string,
  });
  if (r.error) throw r.error;
  assertConnectionClient(client, supabase);
}
export async function transitionSnag(
  snagId: string,
  toStatus: string,
  comment: string,
  client = supabase,
) {
  assertConnectionClient(client, supabase);
  const v = SnagTransitionSchema.parse({ snagId, toStatus, comment });
  const r = await client.rpc('transition_snag', {
    p_snag_id: v.snagId,
    p_to_status: v.toStatus,
    p_comment: v.comment,
  });
  if (r.error) throw r.error;
  assertConnectionClient(client, supabase);
}
export async function addComment(id: string, snagId: string, body: string, client = supabase) {
  const v = CommentCreateSchema.parse({ snagId, body });
  const author = await userId(client);
  const row = await stableWrite(
    async () => {
      const r = await client.from('comments').select('*').eq('id', id).maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
    async () => {
      const r = await client
        .from('comments')
        .insert({ id, snag_id: v.snagId, body: v.body, author_id: author })
        .select('*')
        .single();
      if (r.error) throw r.error;
      return r.data;
    },
  );
  if (row.snag_id !== snagId || row.author_id !== author)
    throw Error('This comment identity is already in use.');
  assertConnectionClient(client, supabase);
  return row.body === v.body
    ? { saved: true as const }
    : { saved: false as const, previousBody: row.body };
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The change was not confirmed. Check access and connection, then retry.';
}

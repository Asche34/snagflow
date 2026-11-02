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
async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw Error('Sign in again before saving.');
  return data.user.id;
}
export async function saveSnag(input: SnagCreate) {
  const value = SnagCreateSchema.parse(input);
  const actor = await userId();
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
      const r = await supabase
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
      const r = await supabase
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
    await updateSnag(row.id, {
      title: value.title,
      description: value.description ?? null,
      priority: value.priority,
      categoryId: value.categoryId ?? null,
      locationId: value.locationId ?? null,
      dueDate: value.dueDate ?? null,
    });
  if (value.assigneeId !== undefined && row.assignee_id !== value.assigneeId)
    await assignSnag(row.id, value.assigneeId);
  return row;
}
export async function updateSnag(id: string, input: unknown) {
  const v = SnagUpdateSchema.parse(input);
  const r = await supabase
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
}
export async function assignSnag(snagId: string, assigneeId: string | null) {
  const v = SnagAssignSchema.parse({ snagId, assigneeId });
  // Generated PostgreSQL Args omit nullable parameters; RPC explicitly accepts NULL to unassign.
  const r = await supabase.rpc('assign_snag', {
    p_snag_id: v.snagId,
    p_assignee_id: v.assigneeId as string,
  });
  if (r.error) throw r.error;
}
export async function transitionSnag(snagId: string, toStatus: string, comment: string) {
  const v = SnagTransitionSchema.parse({ snagId, toStatus, comment });
  const r = await supabase.rpc('transition_snag', {
    p_snag_id: v.snagId,
    p_to_status: v.toStatus,
    p_comment: v.comment,
  });
  if (r.error) throw r.error;
}
export async function addComment(id: string, snagId: string, body: string) {
  const v = CommentCreateSchema.parse({ snagId, body });
  const author = await userId();
  const row = await stableWrite(
    async () => {
      const r = await supabase.from('comments').select('*').eq('id', id).maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
    async () => {
      const r = await supabase
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
  return row.body === v.body
    ? { saved: true as const }
    : { saved: false as const, previousBody: row.body };
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The change was not confirmed. Check access and connection, then retry.';
}

import type { Database, ProjectRole, SnagStatus, SnagPriority } from '@snagflow/shared';
import { supabase } from './supabase';
import { AccessUnavailableError, readPages, searchIntent } from './online';
export type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type ProjectContext = Awaited<ReturnType<typeof projectContext>>;
export async function projectContext(id: string, userId: string) {
  const [project, membership, locations, categories, members] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase
      .from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', userId)
      .maybeSingle(),
    readPages(async (from, to) => {
      const r = await supabase
        .from('locations')
        .select('*')
        .eq('project_id', id)
        .order('id')
        .range(from, to);
      if (r.error) throw r.error;
      return r.data;
    }),
    readPages(async (from, to) => {
      const r = await supabase
        .from('categories')
        .select('*')
        .eq('project_id', id)
        .order('id')
        .range(from, to);
      if (r.error) throw r.error;
      return r.data;
    }),
    readPages(async (from, to) => {
      const r = await supabase
        .from('project_members')
        .select('*,profiles!project_members_user_id_fkey(id,full_name,email,is_active)')
        .eq('project_id', id)
        .order('user_id')
        .range(from, to);
      if (r.error) throw r.error;
      return r.data;
    }),
  ]);
  if (project.error) throw project.error;
  if (!project.data) throw new AccessUnavailableError();
  if (membership.error) throw membership.error;
  return {
    project: project.data,
    role: (membership.data?.role ?? null) as ProjectRole | null,
    locations,
    categories,
    members,
  };
}
export type SnagFilters = {
  projectIds?: string[];
  search?: string;
  status?: SnagStatus | '';
  priority?: SnagPriority | '';
  mine?: string;
  review?: boolean;
  location?: string;
  category?: string;
  assignee?: string;
  createdBy?: string;
  dueBefore?: string;
};
export async function listSnags(projectId: string | null, filters: SnagFilters = {}, page = 0) {
  let q = supabase.from('snags').select('*', { count: 'exact' }).is('deleted_at', null);
  if (projectId) q = q.eq('project_id', projectId);
  if (filters.projectIds) q = q.in('project_id', filters.projectIds);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.mine) q = q.eq('assignee_id', filters.mine).neq('status', 'closed');
  if (filters.review) q = q.eq('status', 'ready_for_review');
  if (filters.location) q = q.eq('location_id', filters.location);
  if (filters.category) q = q.eq('category_id', filters.category);
  if (filters.assignee) q = q.eq('assignee_id', filters.assignee);
  if (filters.createdBy) q = q.eq('created_by', filters.createdBy);
  if (filters.dueBefore) q = q.lte('due_date', filters.dueBefore);
  const search = searchIntent(filters.search ?? '');
  if (search.number !== undefined) q = q.eq('number', search.number);
  if (search.text)
    q = q.textSearch('search_document', search.text, { type: 'websearch', config: 'english' });
  const result = await q
    .order('updated_at', { ascending: false })
    .order('id')
    .range(page * 50, page * 50 + 49);
  if (result.error) throw result.error;
  return { rows: result.data, count: result.count ?? 0 };
}
export async function snagDetail(id: string, userId: string) {
  const snag = await supabase
    .from('snags')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (snag.error) throw snag.error;
  if (!snag.data) throw new AccessUnavailableError();
  const [context, photos, comments, activity] = await Promise.all([
    projectContext(snag.data.project_id, userId),
    supabase.from('snag_photos').select('*').eq('snag_id', id).order('sort_order'),
    readPages(async (from, to) => {
      const r = await supabase
        .from('comments')
        .select('*')
        .eq('snag_id', id)
        .order('created_at')
        .order('id')
        .range(from, to);
      if (r.error) throw r.error;
      return r.data;
    }),
    readPages(async (from, to) => {
      const r = await supabase
        .from('activity_log')
        .select('*')
        .eq('snag_id', id)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to);
      if (r.error) throw r.error;
      return r.data;
    }),
  ]);
  if (photos.error) throw photos.error;
  return { snag: snag.data, context, photos: photos.data, comments, activity };
}

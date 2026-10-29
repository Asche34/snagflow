import { format, addDays } from 'date-fns';
import type { SnagStatus } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import type { SnagFilters } from '@/lib/snag-filters';

export const SNAG_PAGE_SIZE = 50;

/** Filter before range selection. Every query carries the caller's session and project scope. */
export async function loadProjectSnags(projectId: string, userId: string, filters: SnagFilters) {
  const client = await createClient();
  const base = () =>
    client
      .from('snags')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .is('deleted_at', null);
  const filtered = () => {
    let query = base();
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.assignee === 'unassigned') query = query.is('assignee_id', null);
    else if (filters.assignee)
      query = query.eq('assignee_id', filters.assignee === 'me' ? userId : filters.assignee);
    if (filters.location) query = query.eq('location_id', filters.location);
    if (filters.category) query = query.eq('category_id', filters.category);
    if (filters.mine) query = query.eq('created_by', userId);
    const today = format(new Date(), 'yyyy-MM-dd');
    if (filters.due === 'none') query = query.is('due_date', null);
    if (filters.due === 'overdue') query = query.lt('due_date', today).neq('status', 'closed');
    if (filters.due === 'today') query = query.eq('due_date', today).neq('status', 'closed');
    if (filters.due === 'week')
      query = query
        .gte('due_date', today)
        .lte('due_date', format(addDays(new Date(), 7), 'yyyy-MM-dd'))
        .neq('status', 'closed');
    if (filters.q) {
      const number = filters.q.match(/^#?(\d+)$/)?.[1];
      if (number) {
        const value = Number(number);
        // PostgreSQL integer bounds; out-of-range searches are valid empty results.
        query = query.eq('number', value > 0 && value <= 2147483647 ? value : 0);
      } else
        query = query.textSearch('search_document', filters.q, {
          type: 'websearch',
          config: 'english',
        });
    }
    return query;
  };
  const count = (status?: SnagStatus) => {
    let query = client
      .from('snags')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('deleted_at', null);
    if (status) query = query.eq('status', status);
    return query;
  };
  const [matching, total, closed, review] = await Promise.all([
    // limit(0) gets the exact filtered count without downloading any snag rows.
    filtered().limit(0),
    count(),
    count('closed'),
    count('ready_for_review'),
  ]);
  for (const result of [matching, total, closed, review]) {
    if (result.error) throw new Error('Could not load project snags');
  }
  const resultCount = matching.count ?? 0;
  const pages = Math.max(1, Math.ceil(resultCount / SNAG_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  let query = filtered();
  if (filters.sort === 'priority') query = query.order('priority', { ascending: false });
  if (filters.sort === 'due')
    query = query.order('due_date', { ascending: true, nullsFirst: false });
  if (filters.sort === 'newest') query = query.order('created_at', { ascending: false });
  const result = await query
    .order('number', { ascending: filters.sort !== 'number_desc' })
    .range((page - 1) * SNAG_PAGE_SIZE, page * SNAG_PAGE_SIZE - 1);
  if (result.error) throw new Error('Could not load project snags');
  return {
    snags: result.data ?? [],
    count: resultCount,
    page,
    pages,
    stats: { total: total.count ?? 0, closed: closed.count ?? 0, review: review.count ?? 0 },
  };
}

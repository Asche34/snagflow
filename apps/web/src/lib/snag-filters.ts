import { PRIORITY_ORDER, STATUS_ORDER } from '@/lib/labels';

export type QueryParams = Record<string, string | string[] | undefined>;
const DUE_OPTIONS = ['overdue', 'today', 'week', 'none'] as const;
export const SORT_LABELS = {
  number: 'Number: oldest first',
  number_desc: 'Number: newest first',
  priority: 'Priority: highest first',
  due: 'Due date: soonest first',
  newest: 'Recently created',
} as const;
const single = (value: QueryParams[string]) => (typeof value === 'string' ? value : '');
const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : '';
function option<T extends string>(value: string, options: readonly T[]): T | '' {
  return options.find((candidate) => candidate === value) ?? '';
}

export function parseSnagFilters(params: QueryParams) {
  const assignee = single(params.assignee);
  const page = Number(single(params.page));
  return {
    q: single(params.q).trim().slice(0, 200),
    status: option(single(params.status), STATUS_ORDER),
    priority: option(single(params.priority), PRIORITY_ORDER),
    assignee: assignee === 'me' || assignee === 'unassigned' ? assignee : uuid(assignee),
    location: uuid(single(params.location)),
    category: uuid(single(params.category)),
    due: option(single(params.due), DUE_OPTIONS),
    mine: single(params.mine) === '1',
    sort:
      option(single(params.sort), Object.keys(SORT_LABELS) as (keyof typeof SORT_LABELS)[]) ||
      'number',
    page: Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1,
  };
}
export type SnagFilters = ReturnType<typeof parseSnagFilters>;

export function snagFiltersHref(
  projectId: string,
  filters: SnagFilters,
  overrides: { tab?: string; page?: number } = {},
) {
  const params = new URLSearchParams();
  params.set('tab', overrides.tab ?? 'snags');
  for (const key of [
    'q',
    'status',
    'priority',
    'assignee',
    'location',
    'category',
    'due',
  ] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.mine) params.set('mine', '1');
  if (filters.sort !== 'number') params.set('sort', filters.sort);
  const page = overrides.page ?? filters.page;
  if (page > 1) params.set('page', String(page));
  return `/projects/${projectId}?${params}`;
}

import {
  compareReportSnags,
  reportMatchesFilters,
  terminologyLabels,
  TERMINOLOGY,
  type Database,
  type ReportRequest,
} from '@snagflow/shared';
import { format } from 'date-fns';
import type { ReportClient, authorizeReport } from './auth';
import { ReportError } from './errors';

type Tables = Database['public']['Tables'];
export type ReportPhoto = Tables['snag_photos']['Row'] & { image?: Buffer };
export type ReportSnag = Tables['snags']['Row'] & {
  location: string;
  assignee: string;
  creator: string;
  closedBy: string;
  category: string;
  comments: (Tables['comments']['Row'] & { author: string })[];
  photos: ReportPhoto[];
  group: string;
};
export type ReportData = {
  project: Tables['projects']['Row'];
  org: Tables['org_settings']['Row'];
  preparedBy: string;
  title: string;
  generatedAt: string;
  snags: ReportSnag[];
  logo?: Buffer;
  request: ReportRequest;
  origin: string;
};
export function checkDeadline(deadline: number) {
  if (Date.now() > deadline)
    throw new ReportError(
      'This report is taking too long. Choose a narrower filter or fewer photos, then try again.',
      422,
    );
}
async function pages<T extends { id: string }>(
  read: (after: string) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  deadline: number,
  limit = 20000,
) {
  const rows: T[] = [];
  let after = '';
  for (;;) {
    checkDeadline(deadline);
    const result = await read(after);
    if (result.error || !result.data)
      throw new ReportError(
        'Some report records could not be loaded. Retry; no partial report was saved.',
        503,
      );
    if (!result.data.length) return rows;
    rows.push(...result.data);
    if (rows.length > limit)
      throw new ReportError('This report is too large. Narrow its filters and try again.', 422);
    after = result.data[result.data.length - 1]!.id;
  }
}
export async function loadReportData(
  client: ReportClient,
  access: Awaited<ReturnType<typeof authorizeReport>>,
  request: ReportRequest,
  origin: string,
  deadline: number,
): Promise<ReportData> {
  const projectId = request.projectId;
  const [allSnags, locations, categories, org] = await Promise.all([
    pages(
      (after) =>
        client
          .from('snags')
          .select('*')
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .gt('id', after || '00000000-0000-0000-0000-000000000000')
          .order('id')
          .limit(500),
      deadline,
    ),
    pages(
      (after) =>
        client
          .from('locations')
          .select('*')
          .eq('project_id', projectId)
          .gt('id', after || '00000000-0000-0000-0000-000000000000')
          .order('id')
          .limit(500),
      deadline,
    ),
    pages(
      (after) =>
        client
          .from('categories')
          .select('*')
          .eq('project_id', projectId)
          .gt('id', after || '00000000-0000-0000-0000-000000000000')
          .order('id')
          .limit(500),
      deadline,
    ),
    client.from('org_settings').select('*').single(),
  ]);
  if (org.error || !org.data)
    throw new ReportError('Company report settings could not be loaded. Try again.', 503);
  const snags = allSnags.filter((snag) => reportMatchesFilters(snag, request.filters));
  const comments: Tables['comments']['Row'][] = [];
  const photos: ReportPhoto[] = [];
  for (let offset = 0; offset < snags.length; offset += 100) {
    const ids = snags.slice(offset, offset + 100).map((snag) => snag.id);
    if (request.options.comments)
      comments.push(
        ...(await pages(
          (after) =>
            client
              .from('comments')
              .select('*')
              .in('snag_id', ids)
              .gt('id', after || '00000000-0000-0000-0000-000000000000')
              .order('id')
              .limit(500),
          deadline,
          100000,
        )),
      );
    if (request.options.photos)
      photos.push(
        ...(await pages((after) => {
          let query = client
            .from('snag_photos')
            .select('*')
            .in('snag_id', ids)
            .gt('id', after || '00000000-0000-0000-0000-000000000000')
            .order('id')
            .limit(500);
          if (!request.options.fixPhotos) query = query.eq('kind', 'issue');
          return query;
        }, deadline)),
      );
  }
  const profileIds = [
    ...new Set(
      [
        ...snags.flatMap((row) => [row.created_by, row.assignee_id, row.closed_by]),
        ...comments.map((row) => row.author_id),
      ].filter((id): id is string => !!id),
    ),
  ];
  const names = new Map<string, string>();
  for (let offset = 0; offset < profileIds.length; offset += 100) {
    for (const profile of await pages(
      (after) =>
        client
          .from('profiles')
          .select('id,full_name,email')
          .in('id', profileIds.slice(offset, offset + 100))
          .gt('id', after || '00000000-0000-0000-0000-000000000000')
          .order('id')
          .limit(500),
      deadline,
    ))
      names.set(profile.id, profile.full_name || profile.email);
  }
  const locationNames = new Map(locations.map((row) => [row.id, row.name]));
  // Include parent names while bounding malformed historical cycles.
  const locationMap = new Map(locations.map((row) => [row.id, row]));
  for (const location of locations) {
    const parts = [location.name];
    const seen = new Set([location.id]);
    let parent = location.parent_id;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const row = locationMap.get(parent);
      if (!row) break;
      parts.unshift(row.name);
      parent = row.parent_id;
    }
    locationNames.set(location.id, parts.join(' / '));
  }
  const categoryNames = new Map(categories.map((row) => [row.id, row.name]));
  const rows: ReportSnag[] = snags
    .map((snag) => {
      const location = locationNames.get(snag.location_id ?? '') ?? 'No location';
      const category = categoryNames.get(snag.category_id ?? '') ?? 'No category';
      const assignee = names.get(snag.assignee_id ?? '') ?? 'Unassigned';
      return {
        ...snag,
        location,
        category,
        assignee,
        creator: names.get(snag.created_by) ?? snag.created_by,
        closedBy: names.get(snag.closed_by ?? '') ?? '',
        comments: comments
          .filter((row) => row.snag_id === snag.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .map((row) => ({ ...row, author: names.get(row.author_id) ?? row.author_id })),
        photos: photos
          .filter((row) => row.snag_id === snag.id)
          .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
        group:
          request.options.groupBy === 'location'
            ? location
            : request.options.groupBy === 'category'
              ? category
              : request.options.groupBy === 'assignee'
                ? assignee
                : snag.status.replaceAll('_', ' '),
      };
    })
    .sort(
      (a, b) => a.group.localeCompare(b.group) || compareReportSnags(a, b, request.options.sortBy),
    );
  const terminology = TERMINOLOGY.find((value) => value === org.data.terminology) ?? 'snag';
  return {
    project: access.project,
    org: org.data,
    preparedBy: access.profile.full_name || access.profile.email,
    title: terminologyLabels(terminology).reportTitle,
    generatedAt: new Date().toISOString(),
    snags: rows,
    request,
    origin,
  };
}
export function reportDate(value: string | null | undefined, data: ReportData, withTime = false) {
  if (!value) return '—';
  try {
    return format(new Date(value), `${data.org.date_format}${withTime ? ' HH:mm' : ''}`);
  } catch {
    return value.slice(0, withTime ? 16 : 10).replace('T', ' ');
  }
}

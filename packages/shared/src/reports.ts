import { z } from 'zod';
import { SNAG_PRIORITIES, SNAG_STATUSES, type SnagPriority, type SnagStatus } from './workflow';

export const REPORT_THEMES = ['classic', 'compact', 'photo_first'] as const;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value &&
      value >= '1900-01-01' &&
      value <= '9999-12-31'
    );
  }, 'Enter a valid calendar date.');
const ids = z.array(z.string().uuid()).max(100).default([]);
export const ReportFiltersSchema = z
  .object({
    statuses: z.array(z.enum(SNAG_STATUSES)).max(4).default([]),
    priorities: z.array(z.enum(SNAG_PRIORITIES)).max(4).default([]),
    assigneeIds: ids,
    locationIds: ids,
    categoryIds: ids,
    createdFrom: date.optional(),
    createdTo: date.optional(),
    excludeClosedBefore: date.optional(),
  })
  .strict()
  .refine(
    (value) => !value.createdFrom || !value.createdTo || value.createdFrom <= value.createdTo,
    { message: 'The end date must follow the start date.', path: ['createdTo'] },
  );
export const ReportOptionsSchema = z
  .object({
    cover: z.boolean().default(true),
    photos: z.boolean().default(true),
    annotated: z.boolean().default(true),
    photoSize: z.enum(['small', 'medium', 'large', 'one_per_page']).default('medium'),
    comments: z.boolean().default(false),
    timestamps: z.boolean().default(true),
    fixPhotos: z.boolean().default(true),
    groupBy: z.enum(['location', 'assignee', 'status', 'category']).default('location'),
    sortBy: z.enum(['number', 'priority', 'due_date']).default('number'),
  })
  .strict();
export const ReportRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    projectId: z.string().uuid(),
    format: z.enum(['pdf', 'xlsx']),
    theme: z.enum(REPORT_THEMES).default('classic'),
    filters: ReportFiltersSchema.default({}),
    options: ReportOptionsSchema.default({}),
  })
  .strict();
export type ReportRequest = z.infer<typeof ReportRequestSchema>;
export type ReportFilters = ReportRequest['filters'];
export type ReportOptions = ReportRequest['options'];
/** PDF point sizes, intentionally distinct within every layout. */
export function reportPhotoDimensions(
  theme: ReportRequest['theme'],
  size: ReportOptions['photoSize'],
): readonly [number, number] {
  if (size === 'one_per_page') return [520, 630];
  const dimensions = {
    classic: { small: [85, 65], medium: [140, 105], large: [220, 165] },
    compact: { small: [65, 45], medium: [100, 75], large: [150, 110] },
    photo_first: { small: [220, 150], medium: [420, 280], large: [500, 340] },
  } as const;
  return dimensions[theme][size];
}
type ReportFilterRow = {
  number: number;
  priority: SnagPriority;
  status: SnagStatus;
  assignee_id: string | null;
  location_id: string | null;
  category_id: string | null;
  created_at: string;
  closed_at: string | null;
  due_date: string | null;
};
export function reportMatchesFilters(row: ReportFilterRow, filters: ReportFilters): boolean {
  return (
    (!filters.statuses.length || filters.statuses.includes(row.status)) &&
    (!filters.priorities.length || filters.priorities.includes(row.priority)) &&
    (!filters.assigneeIds.length || filters.assigneeIds.includes(row.assignee_id ?? '')) &&
    (!filters.locationIds.length || filters.locationIds.includes(row.location_id ?? '')) &&
    (!filters.categoryIds.length || filters.categoryIds.includes(row.category_id ?? '')) &&
    (!filters.createdFrom || row.created_at.slice(0, 10) >= filters.createdFrom) &&
    (!filters.createdTo || row.created_at.slice(0, 10) <= filters.createdTo) &&
    (!filters.excludeClosedBefore ||
      row.status !== 'closed' ||
      !row.closed_at ||
      row.closed_at.slice(0, 10) >= filters.excludeClosedBefore)
  );
}
export function compareReportSnags(
  a: ReportFilterRow,
  b: ReportFilterRow,
  sort: ReportOptions['sortBy'],
): number {
  const priority = { critical: 0, high: 1, medium: 2, low: 3 };
  if (sort === 'priority')
    return priority[a.priority] - priority[b.priority] || a.number - b.number;
  if (sort === 'due_date')
    return (
      (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31') || a.number - b.number
    );
  return a.number - b.number;
}

import { describe, expect, it } from 'vitest';
import {
  ReportRequestSchema,
  reportMatchesFilters,
  compareReportSnags,
  reportPhotoDimensions,
} from '../src/reports.js';
const request = {
  requestId: '70000000-0000-4000-8000-000000000001',
  projectId: '70000000-0000-4000-8000-000000000002',
  format: 'pdf',
};
describe('report request contract', () => {
  it('supplies every reproducible content option', () => {
    const parsed = ReportRequestSchema.parse(request);
    expect(parsed.theme).toBe('classic');
    expect(parsed.options).toEqual({
      cover: true,
      photos: true,
      annotated: true,
      photoSize: 'medium',
      comments: false,
      timestamps: true,
      fixPhotos: true,
      groupBy: 'location',
      sortBy: 'number',
    });
    expect(parsed.filters.statuses).toEqual([]);
  });
  it.each([
    { format: 'csv' },
    { theme: 'external' },
    { projectId: '../secret' },
    { serviceRole: true },
    { filters: { statuses: ['deleted'] } },
    { filters: { assigneeIds: Array(101).fill(request.projectId) } },
    { filters: { createdFrom: '2026-02-30' } },
    { filters: { createdFrom: '2026-10-30', createdTo: '2026-10-01' } },
    { options: { photos: 'yes' } },
    { options: { photoSize: 'huge' } },
    { options: { unexpected: true } },
  ])('rejects unsafe or ambiguous details %j', (change) =>
    expect(ReportRequestSchema.safeParse({ ...request, ...change }).success).toBe(false),
  );
  it('accepts all themes and bounded multi-filters', () => {
    for (const theme of ['classic', 'compact', 'photo_first'])
      expect(
        ReportRequestSchema.safeParse({
          ...request,
          theme,
          filters: {
            statuses: ['open', 'closed'],
            priorities: ['critical'],
            excludeClosedBefore: '2026-01-01',
          },
        }).success,
      ).toBe(true);
  });
});
const row = {
  number: 1,
  priority: 'high' as const,
  status: 'closed' as const,
  assignee_id: null,
  location_id: null,
  category_id: null,
  created_at: '2026-10-05T12:00:00Z',
  closed_at: '2026-10-20T12:00:00Z',
  due_date: null,
};
describe('report filtering and ordering', () => {
  it('renders distinct small, medium and large photo geometry in every theme', () => {
    for (const theme of ['classic', 'compact', 'photo_first'] as const) {
      const small = reportPhotoDimensions(theme, 'small');
      const medium = reportPhotoDimensions(theme, 'medium');
      const large = reportPhotoDimensions(theme, 'large');
      expect(small[0]).toBeLessThan(medium[0]);
      expect(medium[0]).toBeLessThan(large[0]);
      expect(small[1]).toBeLessThan(medium[1]);
      expect(medium[1]).toBeLessThan(large[1]);
    }
  });
  it('combines filters and excludes only older closed items', () => {
    const filters = ReportRequestSchema.parse({
      ...request,
      filters: {
        createdFrom: '2026-10-05',
        createdTo: '2026-10-05',
        excludeClosedBefore: '2026-10-20',
      },
    }).filters;
    expect(reportMatchesFilters(row, filters)).toBe(true);
    expect(reportMatchesFilters({ ...row, closed_at: '2026-10-19T23:59:59Z' }, filters)).toBe(
      false,
    );
    expect(reportMatchesFilters({ ...row, status: 'open', closed_at: null }, filters)).toBe(true);
    expect(reportMatchesFilters({ ...row, created_at: '2026-10-06T00:00:00Z' }, filters)).toBe(
      false,
    );
  });
  it('orders highest priority first and undated items last with stable number ties', () => {
    expect(compareReportSnags(row, { ...row, priority: 'critical' }, 'priority')).toBeGreaterThan(
      0,
    );
    expect(compareReportSnags(row, { ...row, due_date: '2026-10-01' }, 'due_date')).toBeGreaterThan(
      0,
    );
    expect(compareReportSnags(row, { ...row, number: 2 }, 'number')).toBeLessThan(0);
  });
});

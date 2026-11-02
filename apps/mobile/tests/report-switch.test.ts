import { describe, expect, it, vi } from 'vitest';
import { ReportRequestSchema } from '@snagflow/shared';
const state = vi.hoisted(() => ({
  finish: undefined as (() => void) | undefined,
  shared: 0,
  deleted: 0,
}));
vi.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    exists = true;
    delete() {
      state.deleted++;
    }
    static downloadFileAsync() {
      return new Promise((resolve) => {
        state.finish = () => resolve({ uri: 'file:///old-report.pdf' });
      });
    }
  },
}));
vi.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: async () => {
    state.shared++;
  },
}));
import { shareReport } from '../src/lib/reports';
describe('report sharing across connection changes', () => {
  it('does not open an old deployment share sheet after a download completes on a different connection', async () => {
    let current = true;
    const draft = ReportRequestSchema.parse({
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      projectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      format: 'pdf',
    });
    const report = {
      id: draft.requestId,
      project_id: draft.projectId,
      revision: 1,
      created_at: '2026-11-02T00:00:00Z',
      format: draft.format,
      theme: draft.theme,
      filters: draft.filters,
      options: draft.options,
    };
    const sharing = shareReport(
      'https://backend.example/report.pdf',
      report,
      'android',
      () => current,
    );
    await vi.waitFor(() => expect(state.finish).toBeTypeOf('function'));
    current = false;
    state.finish!();
    await expect(sharing).rejects.toThrow('connection changed');
    expect(state.shared).toBe(0);
    expect(state.deleted).toBe(1);
  });
});

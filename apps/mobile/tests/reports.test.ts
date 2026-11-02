import { describe, expect, it } from 'vitest';
import {
  createReportApi,
  prepareReportRequest,
  requestForRevision,
  type ReportRevision,
} from '../src/lib/reports';
import { AccessUnavailableError, retainedResource } from '../src/lib/online';

const projectId = '11111111-1111-4111-8111-111111111111';
const firstId = '22222222-2222-4222-8222-222222222222';
const nextId = '33333333-3333-4333-8333-333333333333';
const draft = {
  projectId,
  format: 'pdf',
  theme: 'photo_first',
  options: { comments: true },
  filters: { statuses: ['ready_for_review'] },
};

describe('mobile report retries and revisions', () => {
  it('keeps the request identity after an ambiguous failure and changes it when options change', () => {
    const first = prepareReportRequest(draft, null, () => firstId);
    expect(prepareReportRequest(draft, first, () => nextId).requestId).toBe(firstId);
    expect(
      prepareReportRequest({ ...draft, options: { comments: false } }, first, () => nextId)
        .requestId,
    ).toBe(nextId);
  });
  it('regenerates complete saved filters and options with a fresh revision identity', () => {
    const request = prepareReportRequest(draft, null, () => firstId);
    const revision: ReportRevision = {
      ...request,
      id: firstId,
      project_id: projectId,
      revision: 3,
      created_at: '2026-11-02T12:00:00Z',
    };
    const regenerated = requestForRevision(revision, () => nextId);
    expect(regenerated.requestId).toBe(nextId);
    expect(regenerated.filters.statuses).toEqual(['ready_for_review']);
    expect(regenerated.options.comments).toBe(true);
    expect(regenerated.theme).toBe('photo_first');
    expect(regenerated.format).toBe('pdf');
  });
});

describe('bearer report API', () => {
  it('sends a validated generation request to the web API with refreshed caller auth', async () => {
    const input = prepareReportRequest(draft, null, () => firstId);
    let captured: Request | undefined;
    const api = createReportApi(
      'https://web.test/',
      async () => 'caller-jwt',
      async (url, init) => {
        captured = new Request(url, init);
        return Response.json({
          report: {
            ...input,
            id: firstId,
            project_id: projectId,
            revision: 1,
            created_at: '2026-11-02T12:00:00Z',
          },
          url: 'https://supabase.test/report.pdf?token=private',
        });
      },
    );
    const result = await api.generate(input);
    expect(captured?.url).toBe('https://web.test/api/reports');
    expect(captured?.headers.get('authorization')).toBe('Bearer caller-jwt');
    expect(await captured?.json()).toEqual(input);
    expect(result.report.revision).toBe(1);
  });
  it('does not make anonymous report requests', async () => {
    let requests = 0;
    const api = createReportApi(
      'https://web.test',
      async () => null,
      async () => {
        requests++;
        return Response.json({});
      },
    );
    await expect(api.history(projectId, 1)).rejects.toThrow('Sign in');
    expect(requests).toBe(0);
  });
  it('rejects unsafe API configuration and download URLs without exposing credentials', async () => {
    expect(() => createReportApi('https://user:secret@web.test', async () => null)).toThrow();
    const api = createReportApi(
      'https://web.test',
      async () => 'caller-jwt',
      async () => Response.json({ url: 'javascript:alert(1)' }),
    );
    await expect(api.download(firstId)).rejects.toThrow('download');
  });
  it('requests the selected history page and refreshes private download links', async () => {
    const urls: string[] = [];
    const api = createReportApi(
      'https://web.test',
      async () => 'caller-jwt',
      async (url) => {
        urls.push(String(url));
        return urls.length === 1
          ? Response.json({ reports: [], page: 2, pages: 2, count: 21, defaultTheme: 'compact' })
          : Response.json({ url: 'https://storage.test/private.pdf?token=one-use' });
      },
    );
    expect((await api.history(projectId, 2)).page).toBe(2);
    expect(await api.download(firstId)).toBe('https://storage.test/private.pdf?token=one-use');
    expect(urls).toEqual([
      `https://web.test/api/reports?projectId=${projectId}&page=2`,
      `https://web.test/api/reports/${firstId}`,
    ]);
  });
  it('clears report history after the server proves access was lost', async () => {
    for (const status of [401, 403, 404]) {
      const api = createReportApi(
        'https://web.test',
        async () => 'caller-jwt',
        async () => new Response(null, { status }),
      );
      const failure = await api.history(projectId, 1).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AccessUnavailableError);
      expect(retainedResource({ reports: ['old-private-report'] }, failure)).toBeNull();
    }
  });
});

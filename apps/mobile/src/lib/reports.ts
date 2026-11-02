import { ReportRequestSchema, type ReportRequest } from '@snagflow/shared';
import { AccessUnavailableError } from './online';
export type ReportRevision = Omit<ReportRequest, 'requestId' | 'projectId'> & {
  id: string;
  project_id: string;
  revision: number;
  created_at: string;
};
export type ReportHistory = {
  reports: ReportRevision[];
  page: number;
  pages: number;
  count: number;
  defaultTheme: ReportRequest['theme'];
};
const draftSchema = ReportRequestSchema.omit({ requestId: true });

export function prepareReportRequest(
  input: unknown,
  previous: ReportRequest | null,
  createId: () => string,
): ReportRequest {
  const draft = draftSchema.parse(input);
  if (previous && JSON.stringify(draftSchema.strip().parse(previous)) === JSON.stringify(draft))
    return previous;
  return ReportRequestSchema.parse({ ...draft, requestId: createId() });
}
export function requestForRevision(
  revision: ReportRevision,
  createId: () => string,
): ReportRequest {
  return ReportRequestSchema.parse({
    requestId: createId(),
    projectId: revision.project_id,
    format: revision.format,
    theme: revision.theme,
    filters: revision.filters,
    options: revision.options,
  });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The report server returned an invalid response. Retry shortly.');
  return value as Record<string, unknown>;
}
function revision(value: unknown): ReportRevision {
  const row = record(value);
  const input = ReportRequestSchema.parse({
    requestId: row.id,
    projectId: row.project_id,
    format: row.format,
    theme: row.theme,
    filters: row.filters,
    options: row.options,
  });
  if (
    !Number.isInteger(row.revision) ||
    Number(row.revision) < 1 ||
    typeof row.created_at !== 'string'
  )
    throw new Error('The saved report revision is invalid.');
  return {
    id: input.requestId,
    project_id: input.projectId,
    revision: Number(row.revision),
    created_at: row.created_at,
    format: input.format,
    theme: input.theme,
    filters: input.filters,
    options: input.options,
  };
}
function safeDownloadUrl(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('The private download is unavailable. Retry download.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('The private download is unavailable. Retry download.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('The private download is unavailable. Retry download.');
  return url.href;
}
function validId(value: string) {
  ReportRequestSchema.shape.projectId.parse(value);
  return value;
}

/** All requests use the current caller's bearer token; the web API rechecks role and RLS. */
export function createReportApi(
  baseUrl: string,
  getToken: () => Promise<string | null>,
  fetcher: typeof fetch = fetch,
) {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the web app URL, then restart Expo.');
  }
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error(
      'Set a valid EXPO_PUBLIC_API_BASE_URL without credentials or query parameters.',
    );
  const endpoint = `${base.href.replace(/\/$/, '')}/api/reports`;
  async function request(path: string, init: RequestInit = {}) {
    const token = await getToken();
    if (!token) throw new Error('Sign in again before generating or downloading reports.');
    let response: Response;
    try {
      response = await fetcher(`${endpoint}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
      });
    } catch {
      throw new Error('Report connection failed. Your options are retained; retry when online.');
    }
    if (!response.ok) {
      if ([401, 403, 404].includes(response.status)) throw new AccessUnavailableError();
      const messages: Record<number, string> = {
        422: 'The report is too large or took too long. Narrow the filters or reduce photo size.',
        429: 'Report generation is busy. Wait a minute and retry these same options.',
      };
      throw new Error(
        messages[response.status] ??
          'The report could not be confirmed. Retry these same options to recover the saved revision.',
      );
    }
    return record(await response.json());
  }
  return {
    generate: async (input: ReportRequest): Promise<{ report: ReportRevision; url: string }> => {
      const body = ReportRequestSchema.parse(input);
      const result = await request('', { method: 'POST', body: JSON.stringify(body) });
      const report = revision(result.report);
      if (report.project_id !== body.projectId)
        throw new Error('The report project could not be confirmed.');
      return { report, url: safeDownloadUrl(result.url) };
    },
    history: async (projectId: string, page: number): Promise<ReportHistory> => {
      validId(projectId);
      if (!Number.isInteger(page) || page < 1 || page > 100000)
        throw new Error('Choose a valid report page.');
      const result = await request(`?projectId=${projectId}&page=${page}`);
      if (
        !Array.isArray(result.reports) ||
        !Number.isInteger(result.page) ||
        !Number.isInteger(result.pages) ||
        !Number.isInteger(result.count)
      )
        throw new Error('Report history is unavailable. Retry shortly.');
      const reports = result.reports.map(revision);
      if (reports.some((report) => report.project_id !== projectId))
        throw new Error('Report history could not be confirmed.');
      return {
        reports,
        page: Number(result.page),
        pages: Number(result.pages),
        count: Number(result.count),
        defaultTheme: ReportRequestSchema.shape.theme.parse(result.defaultTheme),
      };
    },
    download: async (id: string): Promise<string> =>
      safeDownloadUrl((await request(`/${validId(id)}`)).url),
  };
}

export async function shareReport(
  url: string,
  report: ReportRevision,
  platform: string,
): Promise<void> {
  const downloadUrl = safeDownloadUrl(url);
  if (platform === 'web') {
    if (typeof window === 'undefined') throw new Error('Open the report in a browser.');
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `snagflow-revision-${report.revision}.${report.format}`;
    anchor.rel = 'noopener noreferrer';
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  const [{ File, Paths }, Sharing] = await Promise.all([
    import('expo-file-system'),
    import('expo-sharing'),
  ]);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('File sharing is unavailable on this device.');
  const file = new File(Paths.cache, `snagflow-${report.id}-${Date.now()}.${report.format}`);
  try {
    const downloaded = await File.downloadFileAsync(downloadUrl, file);
    await Sharing.shareAsync(downloaded.uri, {
      dialogTitle: `Share report revision ${report.revision}`,
      mimeType:
        report.format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      UTI: report.format === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
    });
  } catch {
    throw new Error(
      'Unable to download or share this report. Check your connection and retry download.',
    );
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      /* Cache cleanup can be retried by the OS. */
    }
  }
}

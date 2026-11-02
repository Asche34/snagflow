import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ReportRequestSchema } from '@snagflow/shared';
import {
  authorizeReport,
  reportClient,
  reportFailure,
  ReportError,
  signedReportUrl,
} from '@/lib/reports/auth';
import { checkDeadline, loadReportData } from '@/lib/reports/data';
import { loadReportImages } from '@/lib/reports/images';
import { renderReportPdf } from '@/lib/reports/pdf';
import { renderReportExcel } from '@/lib/reports/excel';
// Node is the default runtime; cacheComponents disallows an explicit runtime export.
export const maxDuration = 300;
const listSchema = z
  .object({
    projectId: z.string().uuid(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  try {
    const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ReportError('Choose a valid project and report page.', 400);
    const client = await reportClient(request);
    await authorizeReport(client, parsed.data.projectId);
    const offset = (parsed.data.page - 1) * 20;
    const result = await client
      .from('reports')
      .select('*', { count: 'exact' })
      .eq('project_id', parsed.data.projectId)
      .order('revision', { ascending: false })
      .range(offset, offset + 19);
    if (result.error || !result.data)
      throw new ReportError('Report history could not be loaded. Try again.', 503);
    const org = await client.from('org_settings').select('default_report_theme').single();
    return Response.json(
      {
        reports: result.data,
        page: parsed.data.page,
        pages: Math.max(1, Math.ceil((result.count ?? 0) / 20)),
        count: result.count ?? 0,
        defaultTheme: org.data?.default_report_theme ?? 'classic',
      },
      { headers },
    );
  } catch (error) {
    return reportFailure(error);
  }
}
export async function POST(request: Request) {
  const deadline = Date.now() + 260000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      generateReport(request, deadline),
      new Promise<Response>((resolve) => {
        timer = setTimeout(
          () =>
            resolve(
              reportFailure(
                new ReportError(
                  'This report is taking too long. Choose a narrower filter or fewer photos, then retry.',
                  422,
                ),
              ),
            ),
          260000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function generateReport(request: Request, deadline: number) {
  let stage = 'authentication';
  try {
    const client = await reportClient(request);
    const body = await request.text();
    if (body.length > 32768) throw new ReportError('Report options are too large.', 400);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new ReportError('Enter valid report details.', 400);
    }
    const parsed = ReportRequestSchema.safeParse(json);
    if (!parsed.success)
      throw new ReportError(
        parsed.error.issues[0]?.message ?? 'Check report options and filters.',
        400,
      );
    const input = parsed.data;
    const access = await authorizeReport(client, input.projectId);
    // Bind retry identity to caller and payload so changed options cannot reference
    // bytes from a previous upload, including concurrent retries before registration.
    const hash = createHash('sha256')
      .update(`${access.user.id}:${JSON.stringify(input)}`)
      .digest('hex');
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const existing = await client.from('reports').select('*').eq('id', id).maybeSingle();
    if (existing.error)
      throw new ReportError('The previous report could not be checked. Retry shortly.', 503);
    if (existing.data)
      return Response.json(
        { report: existing.data, url: await signedReportUrl(client, existing.data.storage_path) },
        { headers },
      );
    const claim = await client.rpc('claim_report_generation', { p_project_id: input.projectId });
    if (claim.error) {
      if (claim.error.message.includes('REPORT_RATE_LIMIT'))
        throw new ReportError(
          'You can generate five reports per minute. Wait a minute and retry.',
          429,
        );
      if (claim.error.message.includes('REPORT_FORBIDDEN'))
        throw new ReportError('Reports require an active project manager or administrator.', 403);
      throw new ReportError('Report generation is temporarily unavailable. Try again.', 503);
    }
    const configured = process.env.NEXT_PUBLIC_APP_URL;
    const origin = configured ? new URL(configured).origin : new URL(request.url).origin;
    stage = 'records';
    const data = await loadReportData(client, access, input, origin, deadline);
    stage = 'images';
    await loadReportImages(client, data, deadline);
    checkDeadline(deadline);
    stage = 'render';
    const bytes =
      input.format === 'pdf' ? await renderReportPdf(data) : await renderReportExcel(data);
    checkDeadline(deadline);
    if (bytes.byteLength > 50 * 1024 * 1024)
      throw new ReportError(
        'The report exceeds the 50 MiB download limit. Choose smaller photos or narrower filters.',
        422,
      );
    const path = `${input.projectId}/${id}.${input.format}`;
    stage = 'upload';
    const upload = await client.storage.from('reports').upload(path, bytes, {
      contentType:
        input.format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    });
    if (
      upload.error &&
      !upload.error.message.toLowerCase().includes('already exists') &&
      !upload.error.message.toLowerCase().includes('duplicate')
    )
      throw new ReportError(
        'The report could not be uploaded. Your options are retained; retry generation.',
        503,
      );
    checkDeadline(deadline);
    stage = 'registration';
    const saved = await client.rpc('save_report', {
      p_id: id,
      p_project_id: input.projectId,
      p_format: input.format,
      p_theme: input.theme,
      p_filters: input.filters,
      p_options: input.options,
      p_storage_path: path,
    });
    if (saved.error || !saved.data)
      throw new ReportError(
        'The file was uploaded, but its revision could not be confirmed. Retry these same options to finish saving it.',
        503,
      );
    return Response.json(
      { report: saved.data, url: await signedReportUrl(client, path) },
      { headers },
    );
  } catch (error) {
    if (!(error instanceof ReportError)) console.error('[reports] failed stage', stage);
    return reportFailure(error);
  }
}

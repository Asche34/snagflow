import { z } from 'zod';
import {
  authorizeReport,
  reportClient,
  reportFailure,
  ReportError,
  signedReportUrl,
} from '@/lib/reports/auth';
// Node is the default runtime with cacheComponents.
export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params;
    if (!z.string().uuid().safeParse(reportId).success)
      throw new ReportError('Choose a valid report.', 400);
    const client = await reportClient(request);
    const { data, error } = await client
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();
    if (error) throw new ReportError('The report could not be loaded. Retry shortly.', 503);
    if (!data)
      throw new ReportError('This report is unavailable or you no longer have access.', 404);
    await authorizeReport(client, data.project_id);
    return Response.json(
      { url: await signedReportUrl(client, data.storage_path) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return reportFailure(error);
  }
}

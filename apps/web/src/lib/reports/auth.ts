import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { canAct, type Database } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAnonKey, getSupabaseServerUrl } from '@/lib/env';
import { publicReportDownloadUrl } from '@/lib/mobile-config';

import { ReportError } from './errors';
export { ReportError } from './errors';
export type ReportClient = SupabaseClient<Database>;
export async function reportClient(request: Request) {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    if (!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))
      throw new ReportError('Sign in with a valid access token.', 401);
    return createSupabaseClient<Database>(getSupabaseServerUrl(), getSupabaseAnonKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  if (request.method === 'POST') {
    const origin = request.headers.get('origin');
    const publicOrigin = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
      : new URL(request.url).origin;
    if (
      !origin ||
      (origin !== publicOrigin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new ReportError('Request origin is not allowed.', 403);
  }
  return createClient();
}
export async function authorizeReport(client: ReportClient, projectId: string) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new ReportError('Sign in before opening reports.', 401);
  const [profile, member, project] = await Promise.all([
    client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    client
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle(),
    client.from('projects').select('*').eq('id', projectId).maybeSingle(),
  ]);
  if (profile.error || member.error || project.error)
    throw new ReportError('Report access could not be checked. Try again.', 503);
  if (
    !profile.data?.is_active ||
    !project.data ||
    !canAct(
      { id: user.id, isAdmin: profile.data.is_admin },
      member.data?.role ?? null,
      'report:generate',
    )
  )
    throw new ReportError('Reports require an active project manager or administrator.', 403);
  return { user, profile: profile.data, project: project.data };
}
export function reportFailure(error: unknown) {
  if (error instanceof ReportError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  console.error(
    '[reports] generation failed',
    error instanceof Error ? error.name : 'Unknown error',
    error instanceof Error
      ? error.message
          .replace(/https?:\/\/\S+/gi, '[URL]')
          .replace(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, '[token]')
          .slice(0, 250)
      : '',
  );
  return Response.json(
    { error: 'The report could not be generated. Please retry or choose fewer photos.' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function signedReportUrl(client: ReportClient, path: string) {
  const result = await client.storage
    .from('reports')
    .createSignedUrl(path, 120, { download: true });
  if (result.error || !result.data)
    throw new ReportError(
      'The report was saved, but its download is unavailable. Retry Download from history.',
      503,
    );
  return publicReportDownloadUrl(result.data.signedUrl, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    MOBILE_PUBLIC_SUPABASE_URL: process.env.MOBILE_PUBLIC_SUPABASE_URL,
  });
}

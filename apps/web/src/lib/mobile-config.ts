import { AppUrlSchema, MobilePublicConfigSchema } from '@snagflow/shared';
type PublicEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  MOBILE_PUBLIC_SUPABASE_URL?: string;
};
export const mobileConfigHeaders = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
};
export function publicReportDownloadUrl(
  signedUrl: string,
  environment: Pick<PublicEnvironment, 'NEXT_PUBLIC_SUPABASE_URL' | 'MOBILE_PUBLIC_SUPABASE_URL'>,
): string {
  const url = new URL(signedUrl);
  const configured = environment.MOBILE_PUBLIC_SUPABASE_URL ?? environment.NEXT_PUBLIC_SUPABASE_URL;
  if (configured) {
    const publicUrl = new URL(AppUrlSchema.parse(configured));
    url.protocol = publicUrl.protocol;
    url.host = publicUrl.host;
  }
  return url.toString();
}
/** Explicit public allowlist: never serialize environment objects or internal server credentials. */
export function mobileConfigResponse(environment: PublicEnvironment): Response {
  const config = MobilePublicConfigSchema.safeParse({
    application: 'SnagFlow',
    version: 1,
    supabaseUrl: environment.MOBILE_PUBLIC_SUPABASE_URL ?? environment.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return config.success
    ? Response.json(config.data, { headers: mobileConfigHeaders })
    : Response.json(
        {
          error:
            'Mobile connection settings are unavailable. Ask the administrator to configure the public backend URL and public anon key.',
        },
        { status: 503, headers: mobileConfigHeaders },
      );
}

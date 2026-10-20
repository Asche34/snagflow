/**
 * Environment access.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so the browser bundle
 * always talks to the URL the build was made with. The server side needs a
 * different URL when the app runs inside a container (the browser reaches
 * Supabase on 127.0.0.1, the container reaches it on host.docker.internal),
 * therefore `SUPABASE_SERVER_URL` is read at runtime and is never inlined.
 *
 * Accessors are functions on purpose: a missing value must fail at request
 * time with a clear message, never at build time (CI builds without secrets).
 */

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`[snagflow] Missing required environment variable: ${name}`);
  }
  return value;
}

/** Server-only URL. Falls back to the public URL for host-based dev servers. */
export function getSupabaseServerUrl(): string {
  return (
    process.env.SUPABASE_SERVER_URL ??
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAnonKey, getSupabaseServerUrl } from "@/lib/env";

/**
 * Health check — app <-> Supabase reachability.
 *
 * No secrets: it only reports whether the server can talk to the auth API and
 * whether a signed-in session is present. A non-200 here means the local stack
 * is down or the env is misconfigured, which is exactly what a browser login
 * failure used to look like silently.
 *
 * Reachability and authentication are deliberately separate probes. An
 * anonymous visitor has no session, so `getUser()` fails with "Auth session
 * missing!" even when the backend is perfectly healthy — treating that as
 * "unreachable" made the endpoint report an outage on its most common input.
 * Reachability is therefore measured against the auth API itself, and only a
 * genuine connection/HTTP failure counts as unreachable.
 */
export async function GET() {
  const started = Date.now();

  let supabaseOk = false;
  let detail: string | undefined;

  try {
    // Unauthenticated reachability probe: the settings endpoint needs no
    // session, so a healthy stack answers it even for an anonymous caller.
    const response = await fetch(`${getSupabaseServerUrl()}/auth/v1/settings`, {
      headers: { apikey: getSupabaseAnonKey() },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    supabaseOk = response.ok;
    if (!response.ok) detail = `auth API responded ${response.status}`;
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err);
  }

  // Session state is reported separately and never downgrades reachability.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // No session (anonymous visitor) — expected, not an error condition.
  }

  return NextResponse.json(
    {
      ok: supabaseOk,
      supabase: supabaseOk ? "reachable" : "unreachable",
      authenticated: userId !== null,
      latencyMs: Date.now() - started,
      ...(detail ? { detail } : {}),
    },
    { status: supabaseOk ? 200 : 503 },
  );
}

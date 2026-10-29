import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@snagflow/shared";
import { getSupabaseAnonKey, getSupabaseServerUrl } from "@/lib/env";
import { AUTH_COOKIE_NAME } from "./cookie-name";

/**
 * Server-side Supabase client.
 *
 * One client per request: the session lives in the request cookies and must
 * never be shared across requests. RLS is applied to the signed-in user, so
 * the anon key is correct here — the service role key is only for trusted
 * server-side jobs (report generation).
 */
export async function createClient() {
  // Auth initialization reads the clock. Keep it behind an actual request,
  // including during Next's speculative shell rendering/partial prefetching.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseServerUrl(), getSupabaseAnonKey(), {
    cookieOptions: { name: AUTH_COOKIE_NAME, path: "/" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies once the response is
          // streaming. The proxy refreshes the session on the next request,
          // so dropping the write keeps the session alive.
        }
      },
    },
  });
}

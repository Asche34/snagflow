/**
 * Test environment contract:
 *   SUPABASE_URL                e.g. http://127.0.0.1:54321 (`supabase status`)
 *   SUPABASE_ANON_KEY           anon key from `supabase status`
 *   SUPABASE_SERVICE_ROLE_KEY   service-role key from `supabase status`
 * Skips loudly (with a clear message) when unset, e.g. Docker missing.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type { SupabaseClient };

/** Optional local env file (gitignored): tests/test.env with SUPABASE_URL/ANON/SERVICE_ROLE.
 *  Loaded explicitly so the suite runs offline without extra tooling; process.env still wins. */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "test.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    const key = m?.[1];
    const value = m?.[2];
    if (key && value !== undefined && !(key in process.env)) process.env[key] = value;
  }
}

export const SUPABASE_URL = process.env["SUPABASE_URL"];
export const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"];
export const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

export const TEST_PASSWORD = "Password123!";

export const CREDS = {
  admin: "admin@snagflow.test",
  manager: "manager@snagflow.test",
  member1: "member1@snagflow.test",
  member2: "member2@snagflow.test",
  viewer: "viewer@snagflow.test",
} as const;

/** Seeded demo project ids (see seed.sql). */
export const PROJECT_A = "10101010-1010-4101-8101-101010101010"; // 5 members inc. viewer
export const PROJECT_B = "20202020-2020-4202-8202-202020202020"; // manager + member1 only

export const UIDS = {
  admin: "11111111-1111-4111-8111-111111111111",
  manager: "22222222-2222-4222-8222-222222222222",
  member1: "33333333-3333-4333-8333-333333333333",
  member2: "44444444-4444-4444-8444-444444444444",
  viewer: "55555555-5555-4555-8555-555555555555",
} as const;

export const CATEGORY_ELECTRICAL_A = "0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c01";
export const LOCATION_THEATRE_A = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a04";

export function requireEnv(): boolean {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[db-tests] Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. " +
        "Start the local stack (`supabase start`, needs Docker), then set these from " +
        "`supabase status`. Tests will be skipped here.",
    );
    return false;
  }
  return true;
}

export const hasEnv = requireEnv();

/** Signed in as the given seeded user (their JWT is applied to PostgREST). */
export async function signedInClient(email: string): Promise<SupabaseClient> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("env missing");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`signIn failed for ${email}: ${error.message}`);
  return client;
}

export type ServiceClient = SupabaseClient;

export function serviceClient(): ServiceClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("env missing");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type NewSnag = {
  projectId: string;
  title: string;
  clientId?: string;
  priority?: "low" | "medium" | "high" | "critical";
  assigneeId?: string | null;
  categoryId?: string | null;
  locationId?: string | null;
  dueDate?: string | null;
};

export async function createSnag(
  client: SupabaseClient,
  args: NewSnag,
): Promise<{ id: string; number: number }> {
  const { data, error } = await client
    .from("snags")
    .insert({
      project_id: args.projectId,
      client_id: args.clientId ?? crypto.randomUUID(),
      title: args.title,
      priority: args.priority ?? "medium",
      assignee_id: args.assigneeId ?? null,
      category_id: args.categoryId ?? null,
      location_id: args.locationId ?? null,
      due_date: args.dueDate ?? null,
    })
    .select("id, number")
    .single();
  if (error) throw error;
  if (!data) throw new Error("insert returned no row");
  return { id: data.id, number: data.number };
}

export const expectDbError = (message: string, code: string): void => {
  if (!message.includes(code)) {
    throw new Error(`expected error containing ${code}, got: ${message}`);
  }
};

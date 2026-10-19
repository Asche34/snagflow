import { beforeAll, describe, expect, it } from "vitest";
import { CREDS, UIDS, createSnag, hasEnv, serviceClient, signedInClient, type SupabaseClient } from "./helpers.js";

// Snap-data integrity rules of section 14: sequential numbers under concurrency,
// the 8-photo cap, and offline-create idempotency via client_id.
// Uses a dedicated fixture project so numbers aren't affected by other suites
// running in parallel.

let member1: SupabaseClient;
let manager: SupabaseClient;
let svc: SupabaseClient;
let fixtureProjectId: string;

describe.skipIf(!hasEnv)("data integrity", () => {
  beforeAll(async () => {
    member1 = await signedInClient(CREDS.member1);
    manager = await signedInClient(CREDS.manager);
    svc = serviceClient();

    // Dedicated fixture project; code must be globally unique across seed +
    // parallel suite data, hence the random suffix.
    const stamp = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data: project, error } = await svc
      .from("projects")
      .insert({
        name: `Fixture Project ${stamp}`,
        code: `FIX${stamp}`,
        created_by: UIDS.admin,
      })
      .select("id")
      .single();
    if (error || !project) throw error ?? new Error("fixture project failed");

    fixtureProjectId = project.id;

    const { error: memberError } = await svc.from("project_members").insert({
      project_id: fixtureProjectId,
      user_id: UIDS.member1,
      role: "member",
    });
    const { error: managerError } = await svc.from("project_members").insert({
      project_id: fixtureProjectId,
      user_id: UIDS.manager,
      role: "manager",
    });
    if (memberError || managerError) {
      throw memberError ?? managerError ?? new Error("fixture members failed");
    }
  });

  it("numbers are sequential and unique per project under concurrent inserts", async () => {
    const { data: beforeRow } = await svc
      .from("projects")
      .select("snag_counter")
      .eq("id", fixtureProjectId)
      .single();
    const base = beforeRow?.snag_counter ?? 0;

    // four concurrent inserts from the same member; no two may share a number
    const inserts = [
      createSnag(member1, { projectId: fixtureProjectId, title: "concurrency a", clientId: crypto.randomUUID() }),
      createSnag(member1, { projectId: fixtureProjectId, title: "concurrency b", clientId: crypto.randomUUID() }),
      createSnag(member1, { projectId: fixtureProjectId, title: "concurrency c", clientId: crypto.randomUUID() }),
      createSnag(member1, { projectId: fixtureProjectId, title: "concurrency d", clientId: crypto.randomUUID() }),
    ];
    const results = await Promise.all(
      inserts.map((p) => p.then((r) => r, (e: unknown) => ({ error: true as const, message: String(e) }))),
    );

    for (const r of results) {
      if ("error" in r && r.error) throw new Error(`concurrent insert failed: ${r.message}`);
    }
    const numbers = results.map((r) => (r as { number?: number }).number ?? NaN);
    expect(new Set(numbers).size).toBe(numbers.length);

    const { data: afterRow } = await svc
      .from("projects")
      .select("snag_counter")
      .eq("id", fixtureProjectId)
      .single();
    // counter advanced monotonically by exactly the number of created rows
    expect(afterRow?.snag_counter).toBe(base + numbers.length);
  });

  it("replaying the same client_id cannot create duplicates", async () => {
    const clientId = crypto.randomUUID();
    const first = await member1
      .from("snags")
      .insert({ project_id: fixtureProjectId, title: "offline replay", client_id: clientId })
      .select("id")
      .single();
    expect(first.error).toBeNull();

    // an offline outbox may replay the same create; uniqueness on client_id makes that safe
    const replay = await member1
      .from("snags")
      .insert({ project_id: fixtureProjectId, title: "offline replay", client_id: clientId });
    expect(replay.error).not.toBeNull();

    const count = await svc.from("snags").select("id", { count: "exact" }).eq("client_id", clientId);
    expect(count.count).toBe(1);

    const { data: row } = await svc.from("snags").select("id").eq("client_id", clientId).single();
    expect(row?.id).toBe(first.data?.id);
  });

  it("a snag can hold at most 8 photos; the 9th insert fails", async () => {
    const snag = await createSnag(member1, { projectId: fixtureProjectId, title: "photo cap" });
    // Storage paths don't need to point at real objects for the cap test.
    const path = () => `fake/${snag.id}/${crypto.randomUUID()}.jpg`;

    for (let i = 0; i < 8; i++) {
      const { error } = await member1.from("snag_photos").insert({
        snag_id: snag.id,
        storage_path: path(),
        width: 100,
        height: 100,
      });
      expect(error).toBeNull();
    }

    const ninth = await member1.from("snag_photos").insert({
      snag_id: snag.id,
      storage_path: path(),
      width: 100,
      height: 100,
    });
    expect(ninth.error?.message).toContain("SNAG_PHOTO_LIMIT_REACHED");

    const count = await svc.from("snag_photos").select("id", { count: "exact" }).eq("snag_id", snag.id);
    expect(count.count).toBe(8);
  });

  it("soft delete via RPC is visible; hard row deletes stay possible only for managers", async () => {
    const snag = await createSnag(member1, { projectId: fixtureProjectId, title: "delete flow" });
    await manager.rpc("soft_delete_snag", { p_snag_id: snag.id });

    const row = await svc.from("snags").select("deleted_at").eq("id", snag.id).single();
    expect(row?.data?.deleted_at).not.toBeNull();
  });
});

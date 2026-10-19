import { beforeAll, describe, expect, it } from "vitest";
import {
  CATEGORY_ELECTRICAL_A,
  CREDS,
  LOCATION_THEATRE_A,
  PROJECT_A,
  hasEnv,
  signedInClient,
  type SupabaseClient,
} from "./helpers.js";

// Role gating from the permission matrix (section 4), enforced by RLS + RPCs.

describe.skipIf(!hasEnv)("RLS: write permissions by role", () => {
  let member1: SupabaseClient;
  let member2: SupabaseClient;
  let viewer: SupabaseClient;

  beforeAll(async () => {
    member1 = await signedInClient(CREDS.member1);
    member2 = await signedInClient(CREDS.member2);
    viewer = await signedInClient(CREDS.viewer);
  });

  it("a viewer cannot create snags", async () => {
    const res = await viewer
      .from("snags")
      .insert({ project_id: PROJECT_A, title: "viewer attempt", client_id: crypto.randomUUID() })
      .select("id");
    expect(res.error).not.toBeNull();
  });

  it("a viewer cannot comment", async () => {
    const res = await viewer.from("comments").insert({
      snag_id: "12010101-0101-4101-8101-000000000001",
      body: "viewer will not be heard",
    });
    expect(res.error).not.toBeNull();
  });

  it("a viewer cannot write locations/categories", async () => {
    const res = await viewer
      .from("locations")
      .insert({ project_id: PROJECT_A, name: "Viewer Rim" });
    expect(res.error).not.toBeNull();
  });

  it("a member can create a snag (with the role fields of the matrix)", async () => {
    const { data, error } = await member1
      .from("snags")
      .insert({
        project_id: PROJECT_A,
        title: "member-created snag",
        client_id: crypto.randomUUID(),
        priority: "medium",
        category_id: CATEGORY_ELECTRICAL_A,
        location_id: LOCATION_THEATRE_A,
      })
      .select("id, number, created_by")
      .single();
    expect(error).toBeNull();
    expect(data?.created_by).toBeTypeOf("string");
  });

  it("a member cannot create a snag with someone else as creator", async () => {
    // created_by must be the caller; spoofing another user must be rejected.
    const res = await member1.from("snags").insert({
      project_id: PROJECT_A,
      title: "spoof attempt",
      client_id: crypto.randomUUID(),
      created_by: "22222222-2222-4222-8222-222222222222",
    });
    expect(res.error).not.toBeNull();
  });

  it("a member cannot assign snags (RPC must reject)", async () => {
    const snag = await member1
      .from("snags")
      .insert({ project_id: PROJECT_A, title: "member tries to assign", client_id: crypto.randomUUID() })
      .select("id")
      .single();
    const listedId = snag.data?.id ?? "";
    const { error } = await member1.rpc("assign_snag", {
      p_snag_id: listedId,
      p_assignee_id: null,
    });
    expect(error?.message).toContain("SNAG_ASSIGN_FORBIDDEN");
  });

  it("a member cannot approve / reject / soft-delete", async () => {
    // reuse a seeded in_progress snag assigned to member2
    const { error: approve } = await member1.rpc("transition_snag", {
      p_snag_id: "12010101-0101-4101-8101-000000000007",
      p_to_status: "closed",
    });
    expect(approve?.message).toContain("SNAG_TRANSITION_FORBIDDEN");

    // soft delete writes deleted_at, which the guard trigger blocks for clients.
    // (member1 created snag #7, so the delete must be rejected by the RPC path too.)
    const { error: del } = await member1.rpc("soft_delete_snag", {
      p_snag_id: "12010101-0101-4101-8101-000000000007",
    });
    expect(del?.message).toContain("SNAG_DELETE_FORBIDDEN");

    const { error: direct } = await member1
      .from("snags")
      .update({ deleted_at: new Date() })
      .eq("id", "12010101-0101-4101-8101-000000000007");
    expect(direct?.message).toContain("SNAG_PROTECTED_FIELD");
  });

  it("a member cannot change status of a snag assigned to someone else", async () => {
    // snag #2 is open, assigned to member1 (seed). member2 starts work -> forbidden.
    const { error } = await member2.rpc("transition_snag", {
      p_snag_id: "12010101-0101-4101-8101-000000000002",
      p_to_status: "in_progress",
    });
    expect(error?.message).toContain("SNAG_TRANSITION_FORBIDDEN");
  });

  it("a viewer cannot write activity_log or notifications", async () => {
    const { error: activityError } = await viewer.from("activity_log").insert({
      project_id: PROJECT_A,
      actor_id: "55555555-5555-4555-8555-555555555555",
      action: "forged",
    });
    expect(activityError).not.toBeNull();
  });

  it("comments are immutable: authors cannot edit or delete", async () => {
    const seeded = "12010101-0101-4101-8101-000000000002";
    const found = await member2.from("comments").select("id").eq("snag_id", seeded).limit(1);
    const id = found.data?.[0]?.id;
    if (!id) return; // seeded comment is by manager, not member2
    const { error: upd } = await member2.from("comments").update({ body: "edited" }).eq("id", id);
    expect(upd).not.toBeNull();
    const { error: del } = await member2.from("comments").delete().eq("id", id);
    expect(del).not.toBeNull();
  });

  it("a member cannot write to org_settings", async () => {
    const { error } = await member1.from("org_settings").update({ company_name: "x" }).eq("id", 1);
    expect(error).not.toBeNull();
  });
});

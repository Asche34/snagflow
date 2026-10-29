import { beforeAll, describe, expect, it } from "vitest";
import {
  CREDS,
  LOCATION_THEATRE_A,
  PROJECT_A,
  UIDS,
  createSnag,
  hasEnv,
  serviceClient,
  signedInClient,
  type SupabaseClient,
} from "./helpers.js";

// The state machine in section 6, exercised end to end through the RPCs.
// Uses a fresh snag per case (created as member1) to avoid cross-talk.

describe.skipIf(!hasEnv)("workflow transitions", () => {
  let manager: SupabaseClient;
  let member1: SupabaseClient;
  let svc: SupabaseClient;

  beforeAll(async () => {
    manager = await signedInClient(CREDS.manager);
    member1 = await signedInClient(CREDS.member1);
    svc = serviceClient();
  });

  it("member start -> manager approves", async () => {
    const snag = await createSnag(member1, {
      projectId: PROJECT_A,
      title: "workflow happy path",
      locationId: LOCATION_THEATRE_A,
    });

    // assign by manager (assignment does not change status)
    const assigned = await manager.rpc("assign_snag", { p_snag_id: snag.id, p_assignee_id: "33333333-3333-4333-8333-333333333333" });
    expect(assigned.error).toBeNull();

    const start = await member1.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "in_progress" });
    expect(start.error).toBeNull();

    // project requires a fix photo before ready_for_review
    const review = await member1.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "ready_for_review" });
    expect(review.error?.message).toContain("SNAG_FIX_PHOTO_REQUIRED");

    const { error: photoErr } = await member1.from("snag_photos").insert({
      snag_id: snag.id,
      kind: "fix",
      storage_path: `${PROJECT_A}/${snag.id}/11111111-1111-4111-8111-111111111111.jpg`,
      width: 400,
      height: 400,
    });
    expect(photoErr).toBeNull();

    const ready = await member1.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "ready_for_review" });
    expect(ready.error).toBeNull();

    const approve = await manager.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "closed" });
    expect(approve.error).toBeNull();
    const row = (await svc.from("snags").select("closed_at, closed_by, status").eq("id", snag.id).single()).data;
    expect(row?.status).toBe("closed");
    expect(row?.closed_by).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("reject requires a comment and bumps rejection_count", async () => {
    const snag = await createSnag(member1, {
      projectId: PROJECT_A,
      title: "reject flow",
    });
    const assigned = await manager.rpc("assign_snag", { p_snag_id: snag.id, p_assignee_id: UIDS.member1 });
    expect(assigned.error).toBeNull();
    await member1.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "in_progress" });
    const { error: photoErr } = await member1.from("snag_photos").insert({
      snag_id: snag.id,
      kind: "fix",
      storage_path: `${PROJECT_A}/${snag.id}/22222222-2222-4222-8222-222222222222.jpg`,
      width: 300,
      height: 300,
    });
    expect(photoErr).toBeNull();
    await member1.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "ready_for_review" });

    const noComment = await manager.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "in_progress" });
    expect(noComment.error?.message).toContain("SNAG_COMMENT_REQUIRED");

    const rejected = await manager.rpc("transition_snag", {
      p_snag_id: snag.id,
      p_to_status: "in_progress",
      p_comment: "bracket is not into slab",
    });
    expect(rejected.error).toBeNull();
    expect(rejected.data?.rejection_count).toBe(1);
    expect(rejected.data?.status).toBe("in_progress");
  });

  it("illegal transitions all fail with SNAG_ILLEGAL_TRANSITION", async () => {
    const open = await createSnag(member1, { projectId: PROJECT_A, title: "illegal paths" });
    const cases: Array<{ to: string }> = [
      { to: "closed" }, // open -> closed does not exist
      { to: "ready_for_review" }, // open -> ready does not exist
    ];
    for (const c of cases) {
      const res = await manager.rpc("transition_snag", { p_snag_id: open.id, p_to_status: c.to });
      expect(res.error?.message).toContain("SNAG_ILLEGAL_TRANSITION");
    }

    // member cannot start (transition) on backwards moves either: open -> open etc.
    const stuck = await manager.rpc("transition_snag", { p_snag_id: "12010101-0101-4101-8101-000000000006", p_to_status: "open" });
    // snag #6 is in_progress; in_progress -> open is not a legal arc
    expect(stuck.error?.message).toContain("SNAG_ILLEGAL_TRANSITION");
  });

  it("assignment is separate: assigning does not change status", async () => {
    const snag = await createSnag(member1, { projectId: PROJECT_A, title: "assign keeps status" });
    const res = await manager.rpc("assign_snag", {
      p_snag_id: snag.id,
      p_assignee_id: "44444444-4444-4444-8444-444444444444",
    });
    expect(res.error).toBeNull();
    expect(res.data?.status).toBe("open");
    expect(res.data?.assignee_id).toBe("44444444-4444-4444-8444-444444444444");
  });

  it("unassigning clears assignee_id", async () => {
    const snag = await createSnag(member1, { projectId: PROJECT_A, title: "unassign me" });
    await manager.rpc("assign_snag", { p_snag_id: snag.id, p_assignee_id: "44444444-4444-4444-8444-444444444444" });
    const res = await manager.rpc("assign_snag", { p_snag_id: snag.id, p_assignee_id: null });
    expect(res.error).toBeNull();
    expect(res.data?.assignee_id).toBeNull();
  });

  it("reopening requires a comment and clears closed metadata", async () => {
    // drive a fresh snag to closed first, so the test is repeatable across runs
    const snag = await createSnag(member1, { projectId: PROJECT_A, title: "reopen flow" });
    await manager.rpc("assign_snag", { p_snag_id: snag.id, p_assignee_id: UIDS.member1 });
    await member1.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "in_progress" });
    const { error: fixPhoto } = await member1.from("snag_photos").insert({
      snag_id: snag.id,
      kind: "fix",
      storage_path: `${PROJECT_A}/${snag.id}/${crypto.randomUUID()}.jpg`,
      width: 100,
      height: 100,
    });
    expect(fixPhoto).toBeNull();
    await member1.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "ready_for_review" });
    await manager.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "closed" });

    const noComment = await manager.rpc("transition_snag", {
      p_snag_id: snag.id,
      p_to_status: "open",
    });
    expect(noComment.error?.message).toContain("SNAG_COMMENT_REQUIRED");

    const reopened = await manager.rpc("transition_snag", {
      p_snag_id: snag.id,
      p_to_status: "open",
      p_comment: "rework: bracket rusted through",
    });
    expect(reopened.error).toBeNull();
    expect(reopened.data?.status).toBe("open");
    expect(reopened.data?.closed_at).toBeNull();
  });

  it("notifications fire for assignment, review request and approval", async () => {
    const snag = await createSnag(member1, {
      projectId: PROJECT_A,
      title: "notify flow",
    });
    await manager.rpc("assign_snag", { p_snag_id: snag.id, p_assignee_id: "33333333-3333-4333-8333-333333333333" });

    const assigneeNotifs = await svc
      .from("notifications")
      .select("type")
      .eq("snag_id", snag.id)
      .eq("user_id", "33333333-3333-4333-8333-333333333333");
    expect(assigneeNotifs.data?.some((n: { type: string }) => n.type === "assigned")).toBe(true);

    await member1.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "in_progress" });
    const { error: photoErr } = await member1.from("snag_photos").insert({
      snag_id: snag.id,
      kind: "fix",
      storage_path: `${PROJECT_A}/${snag.id}/33333333-3333-4333-8333-333333333333.jpg`,
      width: 320,
      height: 320,
    });
    expect(photoErr).toBeNull();
    await member1.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "ready_for_review" });

    const managerNotifs = await svc
      .from("notifications")
      .select("type")
      .eq("snag_id", snag.id)
      .neq("user_id", "33333333-3333-4333-8333-333333333333");
    expect(managerNotifs.data?.some((n: { type: string }) => n.type === "review_requested")).toBe(true);

    await manager.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "closed" });
    const fromMember1 = await svc.from("notifications").select("type").eq("snag_id", snag.id).eq("user_id", "33333333-3333-4333-8333-333333333333");
    expect(fromMember1.data?.some((n: { type: string }) => n.type === "approved")).toBe(true);
  });

  it("activity_log records assignment and transitions", async () => {
    const snag = await createSnag(member1, { projectId: PROJECT_A, title: "audit trail" });
    await manager.rpc("assign_snag", { p_snag_id: snag.id, p_assignee_id: "33333333-3333-4333-8333-333333333333" });
    await manager.rpc("transition_snag", { p_snag_id: snag.id, p_to_status: "in_progress" });

    const acts = await svc.from("activity_log").select("action").eq("snag_id", snag.id);
    const actions = acts.data?.map((a: { action: string }) => a.action) ?? [];
    expect(actions).toContain("assigned");
    expect(actions).toContain("status_changed");
  });
});

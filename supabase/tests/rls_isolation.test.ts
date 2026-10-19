import { beforeAll, describe, expect, it } from "vitest";
import {
  CREDS,
  PROJECT_A,
  PROJECT_B,
  hasEnv,
  signedInClient,
  type SupabaseClient,
} from "./helpers.js";

// Membership gates the data a user can read at all (spec section 14).

describe.skipIf(!hasEnv)("RLS: project isolation", () => {
  let member2: SupabaseClient; // member on PROJECT_A only
  let viewer: SupabaseClient;
  let manager: SupabaseClient; // manager on both projects

  beforeAll(async () => {
    member2 = await signedInClient(CREDS.member2);
    viewer = await signedInClient(CREDS.viewer);
    manager = await signedInClient(CREDS.manager);
  });

  it("a non-member cannot read another project's project row", async () => {
    const { data } = await member2.from("projects").select("id").eq("id", PROJECT_B);
    expect(data).not.toBeNull();
    expect(data && data.length).toBe(0);
  });

  it("a non-member cannot read another project's snags", async () => {
    const { data } = await member2.from("snags").select("id").eq("project_id", PROJECT_B);
    expect(data).not.toBeNull();
    expect(data && data.length).toBe(0);
  });

  it("a non-member cannot read another project's comments", async () => {
    // snag …000e lives in PROJECT_B (seed); member2 is not a member of B.
    const { data } = await member2.from("comments").select("id").eq("snag_id", "12010101-0101-4101-8101-00000000000e");
    expect(data).not.toBeNull();
    expect(data && data.length).toBe(0);
  });

  it("project members see their projects through the members table", async () => {
    const { data } = await manager.from("projects").select("id").eq("id", PROJECT_B);
    expect(data && data.length).toBe(1);
  });

  it("viewer can read but the row appears in RLS too", async () => {
    const { data } = await viewer.from("projects").select("id").eq("id", PROJECT_A);
    expect(data && data.length).toBe(1);
  });
});

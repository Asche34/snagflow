import { describe, expect, it } from "vitest";
import { Actor, canAct, canEditSnagDetails, canWorkOnSnag, isReviewer } from "../src/permissions.js";
import { ProjectRole } from "../src/roles.js";
import { SnagStatus } from "../src/workflow.js";

const admin: Actor = { id: "u-admin", isAdmin: true };
const plainMan = (id = "u-man"): Actor => ({ id, isAdmin: false });

/** A viewer must never write; a member must never manage. */
describe("canAct matrix", () => {
  it("admins can always act even without project membership", () => {
    expect(canAct(admin, null, "project:edit")).toBe(true);
    expect(canAct(admin, null, "snag:create")).toBe(true);
  });

  it("viewer role grants read-only", () => {
    expect(canAct(plainMan(), "viewer", "snag:read")).toBe(true);
    expect(canAct(plainMan(), "viewer", "snag:create")).toBe(false);
    expect(canAct(plainMan(), "viewer", "snag:comment")).toBe(false);
  });

  it("member role grants snag CRUD but not management", () => {
    expect(canAct(plainMan(), "member", "snag:create")).toBe(true);
    expect(canAct(plainMan(), "member", "snag:comment")).toBe(true);
    expect(canAct(plainMan(), "member", "snag:assign")).toBe(false);
    expect(canAct(plainMan(), "member", "snag:approve")).toBe(false);
    expect(canAct(plainMan(), "member", "snag:soft-delete")).toBe(false);
    expect(canAct(plainMan(), "member", "report:generate")).toBe(false);
  });

  it("manager role grants project and workflow management", () => {
    expect(canAct(plainMan(), "manager", "project:edit")).toBe(true);
    expect(canAct(plainMan(), "manager", "snag:assign")).toBe(true);
    expect(canAct(plainMan(), "manager", "snag:approve")).toBe(true);
    expect(canAct(plainMan(), "manager", "project:create")).toBe(false); // admin only
  });

  it("org: actions are admin-only", () => {
    expect(canAct(plainMan("u"), "manager", "org:manage-users")).toBe(false);
    expect(canAct(admin, null, "org:manage-users")).toBe(true);
  });

  it("no project membership and non-admin means no project access", () => {
    expect(canAct(plainMan(), null, "snag:read")).toBe(false);
    expect(canAct(null, "viewer", "snag:read")).toBe(false);
  });
});

describe("canEditSnagDetails scope rules", () => {
  it("creator can edit own snag while not closed", () => {
    expect(
      canEditSnagDetails({
        actorId: "u1",
        isAdmin: false,
        projectRole: "member",
        scope: { createdById: "u1", status: "open" },
      }),
    ).toBe(true);
    expect(
      canEditSnagDetails({
        actorId: "u1",
        isAdmin: false,
        projectRole: "member",
        scope: { createdById: "u1", status: "closed" },
      }),
    ).toBe(false);
  });

  it("member cannot edit someone else's snag", () => {
    expect(
      canEditSnagDetails({
        actorId: "u1",
        isAdmin: false,
        projectRole: "member",
        scope: { createdById: "u2", status: "open" },
      }),
    ).toBe(false);
  });

  it("viewer can never edit", () => {
    expect(
      canEditSnagDetails({
        actorId: "u1",
        isAdmin: false,
        projectRole: "viewer",
        scope: { createdById: "u1", status: "open" },
      }),
    ).toBe(false);
  });

  it("manager and admin can always edit", () => {
    expect(
      canEditSnagDetails({
        actorId: "u9",
        isAdmin: false,
        projectRole: "manager",
        scope: { createdById: "u1", status: "closed" as SnagStatus },
      }),
    ).toBe(true);
  });
});

describe("canWorkOnSnag scope rules", () => {
  it("member can act only when assigned", () => {
    expect(
      canWorkOnSnag({
        actorId: "u1",
        isAdmin: false,
        projectRole: "member",
        scope: { assigneeId: "u1" },
      }),
    ).toBe(true);
    expect(
      canWorkOnSnag({
        actorId: "u1",
        isAdmin: false,
        projectRole: "member",
        scope: { assigneeId: "u2" },
      }),
    ).toBe(false);
  });

  it("manager always may act", () => {
    expect(
      canWorkOnSnag({ actorId: "u9", isAdmin: false, projectRole: "manager", scope: {} }),
    ).toBe(true);
  });
});

describe("isReviewer", () => {
  it.each([
    ["viewer", false],
    ["member", false],
    ["manager", true],
  ] as Array<[ProjectRole, boolean]>)("role %s -> %s", (role: ProjectRole, expected: boolean) => {
    expect(isReviewer({ isAdmin: false, projectRole: role })).toBe(expected);
  });
  it("admin is always reviewer", () => {
    expect(isReviewer({ isAdmin: true, projectRole: null })).toBe(true);
  });
});

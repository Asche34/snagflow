import { describe, expect, it } from "vitest";
import { findTransition, SNAG_STATUSES, SNAG_TRANSITIONS, transitionsFrom } from "../src/workflow.js";

describe("snag transition map", () => {
  it("allows exactly open->in_progress from open", () => {
    expect(transitionsFrom("open").map((t) => t.to)).toEqual(["in_progress"]);
  });

  it("in_progress only goes to ready_for_review", () => {
    expect(transitionsFrom("in_progress").map((t) => t.to)).toEqual(["ready_for_review"]);
  });

  it("ready_for_review can be approved (closed) or rejected (in_progress)", () => {
    expect(transitionsFrom("ready_for_review").map((t) => t.to).sort()).toEqual([
      "closed",
      "in_progress",
    ]);
  });

  it("closed can only reopen to open", () => {
    expect(transitionsFrom("closed").map((t) => t.to)).toEqual(["open"]);
  });

  it("reject requires a comment and revert goes to in_progress", () => {
    const reject = findTransition("ready_for_review", "in_progress");
    expect(reject).toBeDefined();
    expect(reject?.commentRequired).toBe(true);
    expect(reject?.actor).toBe("managerOnly");
  });

  it("reopen requires a comment and is managerOnly", () => {
    const reopen = findTransition("closed", "open");
    expect(reopen).toBeDefined();
    expect(reopen?.commentRequired).toBe(true);
    expect(reopen?.actor).toBe("managerOnly");
  });

  it("approve is managerOnly", () => {
    expect(findTransition("ready_for_review", "closed")?.actor).toBe("managerOnly");
  });

  it("request review may require a fix photo flag (project setting decides)", () => {
    expect(findTransition("in_progress", "ready_for_review")?.fixPhotoRequired).toBe(true);
  });

  it("start work is available to assignee or manager", () => {
    expect(findTransition("open", "in_progress")?.actor).toBe("assigneeOrManager");
  });

  it("every rule references a legal status", () => {
    for (const rule of SNAG_TRANSITIONS) {
      expect(SNAG_STATUSES, JSON.stringify(rule)).toContain(rule.from);
      expect(SNAG_STATUSES, JSON.stringify(rule)).toContain(rule.to);
    }
  });
});

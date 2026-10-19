/**
 * Snag status state machine (build prompt section 6). This map is the shared
 * source of truth for button visibility and client-side validation; the server
 * (transition_snag RPC) independently enforces the same rules.
 *
 * Assignment is modelled separately (assignSnag RPC): it never changes status.
 */
export const SNAG_STATUSES = ["open", "in_progress", "ready_for_review", "closed"] as const;
export type SnagStatus = (typeof SNAG_STATUSES)[number];

export const SNAG_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type SnagPriority = (typeof SNAG_PRIORITIES)[number];

export const PHOTO_KINDS = ["issue", "fix"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/**
 * Who may perform a transition:
 * - "assigneeOrManager": the current assignee (member) or any manager/admin.
 * - "managerOnly": manager/admin.
 * Assignment requirement is checked separately: transitions from `open` to
 * `in_progress` require an assignee to exist first (spec: assignment happens
 * via the assign RPC; a member cannot start work on an unassigned snag).
 */
export type TransitionActor = "assigneeOrManager" | "managerOnly";

export type TransitionRule = {
  from: SnagStatus;
  to: SnagStatus;
  actor: TransitionActor;
  /** Server rejects the transition unless a non-empty comment is provided. */
  commentRequired?: boolean;
  /** Server rejects unless the snag already has >= 1 fix photo (project setting). */
  fixPhotoRequired?: boolean;
  /** Human label, reused by UI action buttons. */
  label: string;
  /** Semantic of the transition, used for activity logging. */
  action: "start_work" | "request_review" | "approve" | "reject" | "reopen";
};

export const SNAG_TRANSITIONS: readonly TransitionRule[] = [
  {
    from: "open",
    to: "in_progress",
    actor: "assigneeOrManager",
    label: "Start work",
    action: "start_work",
  },
  {
    from: "in_progress",
    to: "ready_for_review",
    actor: "assigneeOrManager",
    fixPhotoRequired: true,
    label: "Mark ready for review",
    action: "request_review",
  },
  {
    from: "ready_for_review",
    to: "closed",
    actor: "managerOnly",
    label: "Approve and close",
    action: "approve",
  },
  {
    from: "ready_for_review",
    to: "in_progress",
    actor: "managerOnly",
    commentRequired: true,
    label: "Reject back to assignee",
    action: "reject",
  },
  {
    from: "closed",
    to: "open",
    actor: "managerOnly",
    commentRequired: true,
    label: "Reopen",
    action: "reopen",
  },
];

/** All legal target statuses from a given status. */
export function transitionsFrom(status: SnagStatus): TransitionRule[] {
  return SNAG_TRANSITIONS.filter((t) => t.from === status);
}

/** Full rule for a candidate transition, or undefined when illegal. */
export function findTransition(from: SnagStatus, to: SnagStatus): TransitionRule | undefined {
  return SNAG_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

/** Runtime contract returned by the RPC layer; also mirrored in DB error codes. */
export const TRANSITION_ERRORS = {
  illegal: "SNAG_ILLEGAL_TRANSITION",
  forbidden: "SNAG_TRANSITION_FORBIDDEN",
  fixPhotoRequired: "SNAG_FIX_PHOTO_REQUIRED",
  commentRequired: "SNAG_COMMENT_REQUIRED",
  notFound: "SNAG_NOT_FOUND",
  closedByOther: "SNAG_CLOSED_BY_OTHER",
  notAssignee: "SNAG_NOT_ASSIGNEE",
} as const;
export type TransitionErrorCode = (typeof TRANSITION_ERRORS)[keyof typeof TRANSITION_ERRORS];

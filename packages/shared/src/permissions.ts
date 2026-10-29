import type { SnagStatus } from "./workflow";
import { roleAtLeast, type ProjectRole, type RoleLevel } from "./roles";

/**
 * Single source of truth for the permission matrix (build prompt section 4).
 * The database remains the real authority — these helpers gate UI affordances
 * and approve client-side intent, and the server independently enforces the
 * same rules via RLS/RPCs.
 *
 * Hierarchy: admins implicitly hold every project capability and managers hold
 * every member capability; therefore each action is keyed by the *lowest*
 * sufficient role.
 */
export const ACTIONS_BY_MINIMUM_ROLE = {
  /** Admins manage users and projects. */
  "org:manage-users": "admin",
  "org:manage-settings": "admin",
  "project:create": "admin",
  /** Edit project meta, locations, categories, settings. */
  "project:edit": "manager",
  "project:archive": "manager",
  "project:manage-members": "manager",
  "project:view": "viewer",
  /** Snag access. */
  "snag:read": "viewer",
  "snag:create": "member",
  /** Detail edits are further scope-checked by canEditSnagDetails(). */
  "snag:edit-details": "member",
  "snag:assign": "manager",
  /** Work actions are further scope-checked by canWorkOnSnag(). */
  "snag:start-work": "member",
  "snag:request-review": "member",
  "snag:approve": "manager",
  "snag:reject": "manager",
  "snag:reopen": "manager",
  "snag:comment": "member",
  "snag:add-photo": "member",
  "snag:soft-delete": "manager",
  "report:generate": "manager",
} as const satisfies Record<string, RoleLevel>;

export type Action = keyof typeof ACTIONS_BY_MINIMUM_ROLE;

/**
 * Some actions are role-sufficient but object-scope constrained (e.g. a member
 * may not edit anyone else's snag, and cannot edit one that is closed).
 */
export type ScopeContext = {
  /** Snag creator, if the action targets a snag. */
  createdById?: string | null;
  /** Snag assignee, if the action targets a snag. */
  assigneeId?: string | null;
  /** Current status of the snag, if relevant. */
  status?: SnagStatus | null;
};

export type Actor = { id: string; isAdmin: boolean };

export function canAct(
  actor: Actor | null,
  projectRole: ProjectRole | null,
  action: Action,
): boolean {
  if (!actor) return false;
  if (action === "project:create" || action === "org:manage-users" || action === "org:manage-settings") {
    return actor.isAdmin;
  }
  /** Admins can do everything in every project, membership or not. */
  if (actor.isAdmin) return true;
  if (!projectRole) return false;
  const minimum = ACTIONS_BY_MINIMUM_ROLE[action];
  return roleAtLeast(actor.isAdmin ? "admin" : projectRole, minimum);
}

/** Object-scope rules layered on top of the matrix (creator-only detail edits). */
export function canEditSnagDetails(args: {
  actorId: string;
  isAdmin: boolean;
  projectRole: ProjectRole | null;
  scope: ScopeContext;
}): boolean {
  const { actorId, isAdmin, projectRole, scope } = args;
  if (isAdmin) return true;
  if (!projectRole) return false;
  if (projectRole === "manager") return true;
  if (projectRole !== "member") return false;
  if (scope.status === "closed") return false;
  return scope.createdById === actorId;
}

export function canWorkOnSnag(args: {
  actorId: string;
  isAdmin: boolean;
  projectRole: ProjectRole | null;
  scope: ScopeContext;
}): boolean {
  const { actorId, isAdmin, projectRole, scope } = args;
  if (isAdmin || projectRole === "manager") return true;
  if (!projectRole) return false;
  return projectRole === "member" && scope.assigneeId === actorId;
}

/** Only managers/admins may review, approve, reject or reopen. */
export function isReviewer(args: { isAdmin: boolean; projectRole: ProjectRole | null }): boolean {
  const { isAdmin, projectRole } = args;
  if (isAdmin) return true;
  return projectRole === "manager";
}

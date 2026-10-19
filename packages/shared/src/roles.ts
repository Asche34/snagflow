/** Organization-level identity plus roles a user can hold on a project. */
export const PROJECT_ROLES = ["manager", "member", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export type RoleLevel = "admin" | ProjectRole;

/**
 * Canonical ordering for role comparisons. Admin is not a project role but
 * still participates in the permission matrix, hence it sorts above manager.
 */
export const ROLE_LEVEL_ORDER: readonly RoleLevel[] = ["viewer", "member", "manager", "admin"];

export function roleAtLeast(role: RoleLevel, minimum: RoleLevel): boolean {
  const at = ROLE_LEVEL_ORDER.indexOf(role);
  const min = ROLE_LEVEL_ORDER.indexOf(minimum);
  if (at === -1 || min === -1) return false;
  return at >= min;
}

import type { ProjectRole, SnagPriority, SnagStatus } from "@snagflow/shared";

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
};

/** Display labels for the snag state machine (source of truth: workflow.ts). */
export const STATUS_LABELS: Record<SnagStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  closed: "Closed",
};

export const STATUS_ORDER: readonly SnagStatus[] = [
  "open",
  "in_progress",
  "ready_for_review",
  "closed",
];

export const PRIORITY_LABELS: Record<SnagPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const PRIORITY_ORDER: readonly SnagPriority[] = ["critical", "high", "medium", "low"];

/** Tailwind classes per status — kept next to the labels so the palette is in one place. */
export const STATUS_CLASSES: Record<SnagStatus, string> = {
  open: "status-open",
  in_progress: "status-progress",
  ready_for_review: "status-review",
  closed: "status-closed",
};

export const PRIORITY_CLASSES: Record<SnagPriority, string> = {
  low: "status-open",
  medium: "status-progress",
  high: "status-review",
  critical: "status-critical",
};

export const PROJECT_STATE_LABELS = {
  active: "Active",
  archived: "Archived",
} as const;

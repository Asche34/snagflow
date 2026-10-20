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
  open: "bg-slate-100 text-slate-700 ring-slate-200",
  in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  ready_for_review: "bg-amber-50 text-amber-800 ring-amber-200",
  closed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const PRIORITY_CLASSES: Record<SnagPriority, string> = {
  low: "bg-slate-100 text-slate-600 ring-slate-200",
  medium: "bg-sky-50 text-sky-700 ring-sky-200",
  high: "bg-amber-50 text-amber-800 ring-amber-200",
  critical: "bg-red-50 text-red-700 ring-red-200",
};

export const PROJECT_STATE_LABELS = {
  active: "Active",
  archived: "Archived",
} as const;

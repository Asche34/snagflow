import { differenceInCalendarDays, format, parseISO } from "date-fns";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "d MMM yyyy");
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "d MMM yyyy, HH:mm");
}

export type DueDateState = {
  label: string;
  overdue: boolean;
  dueToday: boolean;
};

/** Human due date: "Overdue by 3 days", "Due today", "Due in 5 days", "No due date". */
export function describeDueDate(dueDate: string | null | undefined): DueDateState {
  if (!dueDate) {
    return { label: "No due date", overdue: false, dueToday: false };
  }
  const date = parseISO(dueDate);
  if (Number.isNaN(date.getTime())) {
    return { label: "No due date", overdue: false, dueToday: false };
  }
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0) {
    const overdueBy = Math.abs(days);
    return {
      label: overdueBy === 1 ? "Overdue by 1 day" : `Overdue by ${overdueBy} days`,
      overdue: true,
      dueToday: false,
    };
  }
  if (days === 0) {
    return { label: "Due today", overdue: false, dueToday: true };
  }
  return {
    label: days === 1 ? "Due tomorrow" : `Due in ${days} days`,
    overdue: false,
    dueToday: false,
  };
}

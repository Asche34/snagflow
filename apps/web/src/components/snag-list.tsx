import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { describeDueDate } from "@/lib/dates";
import { personName, type Person, type Project, type Snag } from "@/lib/data";
import { cn } from "@/lib/utils";

type SnagListProps = {
  snags: Snag[];
  people: Person[];
  projects?: Map<string, Project>;
  emptyLabel?: string;
};

/** Compact list of snags used by the dashboard and the project page. */
export function SnagList({ snags, people, projects, emptyLabel = "Nothing here yet." }: SnagListProps) {
  if (snags.length === 0) {
    return <p className="px-6 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y">
      {snags.map((snag) => {
        const due = describeDueDate(snag.due_date);
        const project = projects?.get(snag.project_id);

        return (
          <li key={snag.id}>
            <Link
              href={`/snags/${snag.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3 transition-colors hover:bg-muted/50"
            >
              <span className="w-9 shrink-0 font-mono text-xs text-muted-foreground">#{snag.number}</span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{snag.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {project ? `${project.code} · ` : ""}
                  {personName(people, snag.assignee_id)}
                </span>
              </span>

              <StatusBadge status={snag.status} />
              <PriorityBadge priority={snag.priority} />

              <span
                className={cn(
                  "hidden w-28 shrink-0 text-right text-xs sm:block",
                  due.overdue ? "font-medium text-destructive" : "text-muted-foreground",
                )}
              >
                {due.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

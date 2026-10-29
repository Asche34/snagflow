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
    <ul className="divide-y" aria-label="Snag list">
      {snags.map((snag) => {
        const due = describeDueDate(snag.due_date);
        const project = projects?.get(snag.project_id);

        return (
          <li key={snag.id}>
            <Link
              href={`/snags/${snag.id}`}
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 px-5 py-5 transition-colors hover:bg-muted/50 sm:flex sm:flex-wrap sm:items-center sm:px-6"
            >
              <span className="col-span-2 min-w-0 flex-1">
                <span className="mb-1.5 block font-mono text-xs text-muted-foreground">#{snag.number}</span>
                <span className="block break-words text-sm font-semibold leading-relaxed group-hover:text-primary">{snag.title}</span>
                <span className="mt-1 block break-words text-xs leading-relaxed text-muted-foreground">
                  {project ? `${project.code} · ` : ""}
                  {personName(people, snag.assignee_id)}
                </span>
              </span>

              <span className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-48"><StatusBadge status={snag.status} /><PriorityBadge priority={snag.priority} /></span>

              <span
                className={cn(
                  "self-center break-words text-right text-xs sm:w-28 sm:shrink-0",
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

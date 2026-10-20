import type { SnagPriority, SnagStatus } from "@snagflow/shared";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_CLASSES, PRIORITY_LABELS, STATUS_CLASSES, STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: SnagStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("ring-1 ring-inset", STATUS_CLASSES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: SnagPriority; className?: string }) {
  return (
    <Badge variant="outline" className={cn("ring-1 ring-inset", PRIORITY_CLASSES[priority], className)}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

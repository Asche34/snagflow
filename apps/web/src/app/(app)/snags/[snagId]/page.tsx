import { Suspense } from "react";
import { SnagView } from "@/components/snag-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Snag",
};

export default function SnagPage({ params }: { params: Promise<{ snagId: string }> }) {
  return (
    <Suspense fallback={<SnagSkeleton />}>
      <SnagView params={params} />
    </Suspense>
  );
}

function SnagSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full max-w-40" />
        <Skeleton className="h-7 w-full max-w-96" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 w-full lg:col-span-2" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

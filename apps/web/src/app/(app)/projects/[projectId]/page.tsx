import { Suspense } from 'react';
import { ProjectView } from '@/components/project-view';
import { Skeleton } from '@/components/ui/skeleton';
import type { QueryParams } from '@/lib/snag-filters';

export const metadata = {
  title: 'Project',
};

export default function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<QueryParams>;
}) {
  return (
    <Suspense fallback={<ProjectSkeleton />}>
      <ProjectView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function ProjectSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-full max-w-72" />
        <Skeleton className="h-4 w-full max-w-56" />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

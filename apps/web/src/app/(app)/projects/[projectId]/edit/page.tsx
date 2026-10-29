import { Suspense } from 'react';
import { ProjectFormPage } from '@/components/project-form-page';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Edit project' };
export default function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-3xl" />}>
      <ProjectFormPage params={params} />
    </Suspense>
  );
}

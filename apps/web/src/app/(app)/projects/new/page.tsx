import { Suspense } from 'react';
import { ProjectFormPage } from '@/components/project-form-page';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'New project' };
export default function NewProjectPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-3xl" />}>
      <ProjectFormPage />
    </Suspense>
  );
}

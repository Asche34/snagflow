import { Suspense } from "react";
import { SnagFormPage } from "@/components/snag-form-page";
import { Skeleton } from "@/components/ui/skeleton";
export const metadata = { title: "New snag" };
export default function NewSnagPage({ params }: { params: Promise<{projectId:string}> }) {
  return <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-3xl" />}><SnagFormPage params={params} /></Suspense>;
}

import { Suspense } from "react";
import { SnagFormPage } from "@/components/snag-form-page";
import { Skeleton } from "@/components/ui/skeleton";
export const metadata = { title: "Edit snag" };
export default function EditSnagPage({ params }: { params: Promise<{snagId:string}> }) {
  return <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-3xl" />}><SnagFormPage params={params} /></Suspense>;
}

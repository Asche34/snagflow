import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-72 shrink-0 border-r bg-card md:block">
        <div className="sticky top-0 h-screen">
          <Suspense fallback={<SidebarSkeleton />}>
            <AppSidebar />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
          <Suspense fallback={<div className="h-14" />}>
            <AppTopbar />
          </Suspense>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-3 p-5">
      <Skeleton className="h-9 w-9 rounded-lg" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-6 h-4 w-20" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-5/6" />
    </div>
  );
}

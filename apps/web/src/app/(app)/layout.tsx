import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="fixed left-4 top-4 z-100 -translate-y-32 rounded-lg bg-card px-5 py-3 font-medium shadow-lg focus:translate-y-0">Skip to content</a>
      <Suspense fallback={<SidebarSkeleton />}><AppSidebar /></Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
          <Suspense fallback={<div className="h-[4.5rem]" />}>
            <AppTopbar />
          </Suspense>
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-7 sm:px-6 sm:pb-10 lg:px-8 lg:pt-9">{children}</main>
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="hidden w-62 shrink-0 space-y-3 bg-navigation p-5 lg:block">
      <Skeleton className="h-9 w-9 rounded-lg" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-6 h-4 w-20" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-5/6" />
    </div>
  );
}

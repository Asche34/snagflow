import { Suspense } from "react";
import { LoginPanel } from "./login-panel";
import { HardHat, Building2 } from "lucide-react";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[.9fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navigation p-12 text-navigation-foreground lg:flex xl:p-16" aria-label="About SnagFlow">
        <div className="flex items-center gap-3 text-xl font-semibold tracking-tight"><span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><HardHat className="size-6" aria-hidden /></span>SnagFlow</div>
        <div className="relative z-10 max-w-md py-20"><Building2 className="mb-8 size-12 text-navigation-muted" strokeWidth={1} aria-hidden /><p className="mb-4 text-xs font-semibold uppercase tracking-[.2em] text-navigation-muted">Built for a better handover</p><p className="text-5xl font-medium leading-[1.15] tracking-tight xl:text-6xl">Every detail.<br />One shared view.</p><p className="mt-7 max-w-sm text-base leading-relaxed text-navigation-muted">Keep your projects, site observations and team moving toward a confident handover.</p></div>
        <p className="text-xs text-navigation-muted">A workspace for your project team.</p>
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-96 rotate-12 rounded-[3rem] border border-navigation-muted/15" aria-hidden /><div className="pointer-events-none absolute -bottom-12 -right-12 size-72 rotate-12 rounded-[2rem] border border-navigation-muted/15" aria-hidden />
      </aside>
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
      <Suspense fallback={<div className="h-80 w-full max-w-sm animate-pulse rounded-xl bg-muted" />}>
        <LoginPanel searchParams={searchParams} />
      </Suspense>
      </div>
    </main>
  );
}

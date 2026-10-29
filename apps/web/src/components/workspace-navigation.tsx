'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ClipboardCheck, HardHat, LayoutDashboard, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type NavigationProject = { id: string; name: string; code: string; roleLabel: string };

export function WorkspaceNavigation({
  projects,
  isAdmin,
}: {
  projects: NavigationProject[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const close = () => setOpen(false);

  const navigation = (label: string) => (
    <div className="flex h-full min-h-0 flex-col px-4 py-6">
      <Link
        href="/dashboard"
        onClick={close}
        className="flex min-h-11 items-center gap-3 px-2 pr-12"
        aria-label="SnagFlow overview"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="size-5" aria-hidden />
        </span>
        <span className="text-xl font-semibold tracking-tight">SnagFlow</span>
      </Link>
      <p className="mb-8 mt-3 px-2 text-xs text-navigation-muted">Built for a better handover.</p>
      <nav aria-label={label} className="min-h-0 flex-1 overflow-y-auto px-1 pb-4">
        <Link
          href="/dashboard"
          onClick={close}
          aria-current={pathname === '/dashboard' ? 'page' : undefined}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors hover:bg-navigation-active',
            pathname === '/dashboard' && 'bg-navigation-active font-semibold',
          )}
        >
          <LayoutDashboard className="size-4 shrink-0" aria-hidden />
          Overview
        </Link>
        <Link
          href="/dashboard#my-snags"
          onClick={close}
          className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm text-navigation-muted hover:bg-navigation-active hover:text-navigation-foreground"
        >
          <ClipboardCheck className="size-4 shrink-0" aria-hidden />
          My snags
        </Link>
        <p className="mb-3 mt-8 px-3 text-xs font-semibold uppercase tracking-[.15em] text-navigation-muted">
          Your projects
        </p>
        {projects.length ? (
          <ul className="space-y-1">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  onClick={close}
                  aria-current={pathname === `/projects/${project.id}` ? 'page' : undefined}
                  className={cn(
                    'flex min-h-14 items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-navigation-active',
                    pathname === `/projects/${project.id}` && 'bg-navigation-active',
                  )}
                >
                  <Building2 className="mt-1 size-4 shrink-0 text-navigation-muted" aria-hidden />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium leading-relaxed">
                      {project.name}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-navigation-muted">
                      {project.code} · {project.roleLabel}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 text-sm text-navigation-muted">No projects assigned yet.</p>
        )}
      </nav>
      <div className="mt-4 border-t border-navigation-muted/25 px-3 pt-5">
        <p className="text-xs font-medium">{isAdmin ? 'Administrator' : 'Project workspace'}</p>
        <p className="mt-1 text-xs text-navigation-muted">Better handovers, together.</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <aside className="fieldwork-navigation hidden w-62 shrink-0 bg-navigation text-navigation-foreground lg:block">
        <div className="sticky top-0 h-dvh">{navigation('Main navigation')}</div>
      </aside>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          onClick={(event) => {
            returnFocus.current = event.currentTarget;
          }}
          className="fixed left-3 top-3 z-30 bg-card text-foreground lg:hidden"
        >
          <Menu aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="fieldwork-navigation inset-y-0 left-0 top-0 flex h-dvh w-[min(22rem,calc(100%-2rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-navigation p-0 text-navigation-foreground sm:max-w-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
        <DialogDescription className="sr-only">
          Navigate to your overview, assigned snags and projects.
        </DialogDescription>
        {navigation('Project navigation')}
      </DialogContent>
      <nav
        aria-label="Phone navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-card px-3 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 text-muted-foreground sm:hidden"
      >
        <Link
          href="/dashboard"
          aria-current={pathname === '/dashboard' ? 'page' : undefined}
          className={cn(
            'flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-xs',
            pathname === '/dashboard' && 'font-semibold text-primary',
          )}
        >
          <LayoutDashboard className="size-5" aria-hidden />
          Overview
        </Link>
        <button
          type="button"
          onClick={(event) => {
            returnFocus.current = event.currentTarget;
            setOpen(true);
          }}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-xs"
        >
          <Building2 className="size-5" aria-hidden />
          Projects
        </button>
        <Link
          href="/dashboard#my-snags"
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-xs"
        >
          <ClipboardCheck className="size-5" aria-hidden />
          My snags
        </Link>
      </nav>
    </Dialog>
  );
}

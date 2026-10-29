import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions";
import { initialsOf, loadWorkspace } from "@/lib/data";
import { cn } from "@/lib/utils";

export async function AppTopbar() {
  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const { user, profile, companyName } = workspace;
  const displayName = profile?.full_name ?? user.email ?? "Signed in";

  return (
    <div className="flex min-h-[4.5rem] items-center justify-between gap-3 py-3 pl-16 pr-4 sm:pr-6 lg:px-8">
      <p className="min-w-0 break-words text-xs text-muted-foreground sm:text-sm">
        <span className="font-medium text-foreground">{companyName}</span>
        <span className="mt-0.5 hidden text-xs sm:block">Project workspace</span>
      </p>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground sm:flex" aria-hidden>
            {initialsOf(displayName)}
          </span>
          <div className="hidden max-w-48 leading-tight md:block">
            <p className="break-words text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{profile?.is_admin ? "Admin" : "Project team"}</p>
          </div>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" aria-label="Sign out" className={cn("gap-1.5")}>
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

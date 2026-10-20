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
    <div className="flex h-14 items-center justify-between gap-4 px-6">
      <p className="truncate text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{companyName}</span>
        <span className="hidden sm:inline"> · Snagging workspace</span>
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
            {initialsOf(displayName)}
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{profile?.is_admin ? "Admin" : "Member"}</p>
          </div>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className={cn("gap-1.5")}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

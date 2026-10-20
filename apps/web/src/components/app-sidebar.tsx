import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, HardHat, LayoutDashboard } from "lucide-react";
import { loadWorkspace } from "@/lib/data";
import { PROJECT_ROLE_LABELS } from "@/lib/labels";

export async function AppSidebar() {
  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const { projects, roles, profile } = workspace;
  const isAdmin = profile?.is_admin ?? false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <HardHat className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">SnagFlow</p>
          <p className="truncate text-xs text-muted-foreground">
            {isAdmin ? "Administrator" : "Project team"}
          </p>
        </div>
      </div>

      <nav className="px-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <LayoutDashboard className="size-4" aria-hidden />
          Dashboard
        </Link>
      </nav>

      <div className="mt-6 flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Projects
        </p>
        {projects.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {projects.map((project) => {
              const role = roles.get(project.id);
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground"
                  >
                    <FolderKanban className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{project.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {project.code}
                        {role ? ` · ${PROJECT_ROLE_LABELS[role]}` : isAdmin ? " · Admin" : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

import type { User } from "@supabase/supabase-js";
import type { Database, ProjectRole } from "@snagflow/shared";
import { createClient } from "@/lib/supabase/server";

type Tables = Database["public"]["Tables"];

export type Project = Tables["projects"]["Row"];
export type Snag = Tables["snags"]["Row"];
export type Profile = Tables["profiles"]["Row"];
/** The subset of a profile the UI needs (colleagues are visible per project). */
export type Person = Pick<Profile, "id" | "full_name" | "email" | "is_admin" | "avatar_url" | "is_active">;
export type Location = Tables["locations"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Comment = Tables["comments"]["Row"];
export type Activity = Tables["activity_log"]["Row"];
export type Membership = Tables["project_members"]["Row"];
export type SnagPhoto = Tables["snag_photos"]["Row"];

/**
 * Everything the signed-in user can see, loaded in one pass.
 *
 * Every read goes through the anon client with the user's own session, so
 * RLS decides what comes back — the app never widens the scope on its own.
 */
export type Workspace = {
  user: User;
  profile: Profile | null;
  /** Company name from the single org_settings row. */
  companyName: string;
  projects: Project[];
  snags: Snag[];
  locations: Location[];
  categories: Category[];
  people: Person[];
  /** The signed-in user's role per project id. */
  roles: Map<string, ProjectRole>;
  /** Membership rows of every project the user can see. */
  members: Membership[];
};

export async function loadWorkspace({ includeSnags = true }: { includeSnags?: boolean } = {}): Promise<Workspace | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    profileResult,
    projectsResult,
    membershipsResult,
    snagsResult,
    peopleResult,
    locationsResult,
    categoriesResult,
    orgResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("*").order("name"),
    supabase.from("project_members").select("project_id, role").eq("user_id", user.id),
    includeSnags ? supabase.from("snags").select("*").order("number") : Promise.resolve({ data: [] as Snag[] }),
    supabase.from("profiles").select("id, full_name, email, is_admin, avatar_url, is_active"),
    supabase.from("locations").select("*").order("sort_order"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("org_settings").select("company_name").maybeSingle(),
  ]);

  const projects = projectsResult.data ?? [];
  const projectIds = projects.map((project) => project.id);

  const membersResult = projectIds.length
    ? await supabase.from("project_members").select("*").in("project_id", projectIds)
    : { data: [] as Membership[] };

  const roles = new Map<string, ProjectRole>();
  for (const membership of membershipsResult.data ?? []) {
    roles.set(membership.project_id, membership.role);
  }

  return {
    user,
    profile: profileResult.data ?? null,
    companyName: orgResult.data?.company_name ?? "SnagFlow",
    projects,
    snags: snagsResult.data ?? [],
    locations: locationsResult.data ?? [],
    categories: categoriesResult.data ?? [],
    people: peopleResult.data ?? [],
    roles,
    members: membersResult.data ?? [],
  };
}

export type SnagDetail = {
  snag: Snag;
  project: Project | null;
  userId: string;
  /** The signed-in user's role in the snag's project. */
  role: ProjectRole | null;
  isAdmin: boolean;
  comments: Comment[];
  activity: Activity[];
  photos: SnagPhoto[];
  people: Person[];
};

export async function loadSnagDetail(snagId: string): Promise<SnagDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const snagResult = await supabase.from("snags").select("*").eq("id", snagId).maybeSingle();
  const snag = snagResult.data;
  if (!snag) return null;

  const [commentsResult, activityResult, photosResult, peopleResult, projectResult, membershipResult, selfResult] =
    await Promise.all([
      supabase.from("comments").select("*").eq("snag_id", snagId).order("created_at"),
      supabase.from("activity_log").select("*").eq("snag_id", snagId).order("created_at", { ascending: false }),
      supabase.from("snag_photos").select("*").eq("snag_id", snagId).order("sort_order"),
      supabase.from("profiles").select("id, full_name, email, is_admin, avatar_url, is_active"),
      supabase.from("projects").select("*").eq("id", snag.project_id).maybeSingle(),
      supabase
        .from("project_members")
        .select("role")
        .eq("project_id", snag.project_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("profiles").select("id, is_admin").eq("id", user.id).maybeSingle(),
    ]);

  const people = peopleResult.data ?? [];

  return {
    snag,
    project: projectResult.data ?? null,
    userId: user.id,
    role: membershipResult.data?.role ?? null,
    isAdmin: selfResult.data?.is_admin ?? false,
    comments: commentsResult.data ?? [],
    activity: activityResult.data ?? [],
    photos: photosResult.data ?? [],
    people,
  };
}

export function personName(people: Person[], id: string | null | undefined): string {
  if (!id) return "Unassigned";
  return people.find((person) => person.id === id)?.full_name ?? "Unknown";
}

export function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

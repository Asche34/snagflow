# Project creation and editing

Continue main `504e7d6`. User approved starting project creation/editing and has
delegated routine decisions and main integration throughout this chat.

Admin creates projects; admin or a project's manager edits its details. Follow the
existing shared permission matrix and database RLS (spec §4); §8's admin shorthand
does not remove manager edit rights. No permission/schema change is required.

Use full-page Fieldwork forms at `/projects/new` and `/projects/[projectId]/edit`.
Fields: name, unique code, description, client name, address, require fix photo.
Reuse ProjectCreateSchema limits and code rules. Keep state/archive, membership,
invitations, images and deletion outside this slice. Existing dashboard/sidebar
project lists provide discovery; add New project for admins and Edit project on
authorized project pages. Revalidate layout/navigation and dashboard after saves.

Approaches considered: modal would constrain phone editing; a full project settings
subsystem would expand scope; choose focused pages with shared form and authenticated
Server Action. Fetch edit project directly by UUID under RLS, independent of capped
workspace lists. Re-read active profile and current membership on every save; RLS is
authoritative even if access changes after page load. Never use a service key in app code.

Keep form controls disabled before hydration and while saving. Retain drafts on
validation/network/access/duplicate-code errors; focus a linked error summary. Reuse
existing native controls, forest/orange tokens, 44px targets and responsive layout.
Use stable create UUID to reconcile an uncertain committed create without duplicates;
retry applies revised details only to the same creator's project. Creation must still
require current admin authority. Do not overwrite any existing project based on code.

Verify real browser admin-create, manager-edit, role denial, direct lookup, duplicate
codes, validation, lost create response, access revocation, navigation refresh and
phone/enlarged text. Add real DB project RLS checks. Run package lint/typecheck/build,
existing relevant suites and independent final review; update handoff docs and push main.

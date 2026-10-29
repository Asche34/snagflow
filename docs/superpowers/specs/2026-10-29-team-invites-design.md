# Project team and invitations

Continue main `cd0a3b5`; user asks to push then continue with the previously named
team/invitation slice and delegates routine decisions. Preserve Fieldwork.

## Scope and roles

Project Team tab gets manager/admin add-existing-by-exact-email, role editing and
confirmed removal. Members/viewers retain a read-only roster. Use canonical Auth email,
not a global directory. Allow self role/removal with clear confirmation; admins can
recover project access. Keep org deactivation/admin promotion out of scope.

New-account email invitations require active admin authority, following spec §4/§7 and
shared org:manage-users; §8's manager shorthand does not widen org account creation.
Managers may cancel pending invitations in their own projects as membership management.
Show pending email/role/expiry without bearer tokens, and retry delivery/cancel controls.
Email delivery uses a server-only service key and Supabase Auth inviteUserByEmail.
No external real recipient is contacted during verification; local mail capture only.

## Approach

Rejected a service-key directory/membership API (unnecessarily bypasses RLS) and a
copy-link-only invite (does not deliver the intended email flow). Chosen: narrowly scoped
authenticated DB RPCs for membership and invitation lifecycle, user-session loaders and
Server Actions, admin-checked route handler only for the privileged Auth email operation.
Migration 13 extends the existing invite table only as needed; generated types stay synced.

Invitation preparation uses stable UUIDs, stores seven-day app tokens and rejects duplicate
pending invites. Delivery retries reuse the pending identity, never add a second member or
silently change invitation details. Expired pending invitations can be canceled and replaced.
An emailed Auth link establishes a session (default implicit callback supported), then
`/invite/[token]` validates that the confirmed Auth email matches the invitation. Recipient
sets name/password and accepts atomically in SQL: valid/unexpired token, active inviter
still authorized, active matching recipient, project exists, insert membership without
overwriting an existing role, mark accepted. Used tokens never restore revoked membership.
Cancel/revoke/expire/wrong-user paths must grant no membership. Auth password/profile
setup and DB membership acceptance are separate services; retry reconciles a committed
membership response rather than duplicating or restoring revoked access.

Use existing native controls, labels, hydration gates, error focus, pending feedback, 44px
targets and phone reflow. Revalidate layout after changes. Read invite acceptance anonymously
through an explicit proxy exception; never expose app/Auth tokens to logs or roster props.

## Verification/deployment

Real DB and browser tests cover manager/admin/member/viewer authority, canonical email,
role update/removal, duplicate and stale access, delivery to local mail capture, password
setup, acceptance, wrong identity, canceled/expired/replayed invites and responsive layout.
Run complete relevant suites and fresh independent review. Document server service key,
APP_URL/redirect allowlist and SMTP requirements; do not change a hosted backend.

'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addProjectMember,
  changeProjectMember,
  cancelProjectInvitation,
  type TeamActionResult,
} from '@/app/(app)/projects/team-actions';
import type { TeamPerson, PendingInvite } from '@/components/team-view';
import { PROJECT_ROLE_LABELS } from '@/lib/labels';
import { useHydrated } from '@/lib/use-hydrated';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/dates';

type MutationResult = TeamActionResult & { refresh?: boolean };

export function TeamManager({
  projectId,
  roster,
  invites,
  userId,
  canInvite,
}: {
  projectId: string;
  roster: TeamPerson[];
  invites: PendingInvite[];
  userId: string;
  canInvite: boolean;
}) {
  const prefix = useId();
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<string>();
  const [ownRole, setOwnRole] = useState<string>();
  const busy = useRef(false);
  const summary = useRef<HTMLParagraphElement>(null);
  const invitation = useRef<{ email: string; role: string; id: string } | null>(null);
  useEffect(() => {
    if (error) summary.current?.focus();
  }, [error]);
  const roles = Object.entries(PROJECT_ROLE_LABELS).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
  async function run(task: () => Promise<MutationResult>, success: string, form?: HTMLFormElement) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setNotice('');
    try {
      const result = await task();
      if (result.error) setError(result.error);
      else {
        setNotice(success);
        form?.reset();
        setConfirm(undefined);
        setOwnRole(undefined);
        if (result.leftProject) router.push('/dashboard');
      }
      if (!result.error || result.refresh) router.refresh();
    } catch {
      setError('The request could not be completed. Check your connection and retry.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function send(id: string, email: string, role: string): Promise<MutationResult> {
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: id, projectId, email, role }),
    });
    const result = (await response.json()) as { error?: string; inviteId?: string };
    return {
      refresh: !!result.inviteId,
      error:
        result.error ??
        (response.ok
          ? undefined
          : 'Invitation delivery could not be confirmed. Retry in a moment.'),
    };
  }
  return (
    <div className="space-y-5">
      <div className="px-4 sm:px-6">
        {error ? (
          <p
            ref={summary}
            role="alert"
            tabIndex={-1}
            className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive focus-visible:ring-2 focus-visible:ring-ring"
          >
            {error}
          </p>
        ) : null}
        <p role="status" className="text-sm text-muted-foreground">
          {pending ? 'Updating team…' : notice}
        </p>
      </div>
      <fieldset disabled={!hydrated || pending} className="min-w-0 space-y-6">
        <legend className="sr-only">Manage project team</legend>
        <form
          aria-label="Add existing project member"
          className="grid min-w-0 gap-3 border-y bg-muted/30 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_auto] sm:items-end sm:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget,
              data = new FormData(form);
            void run(
              () =>
                addProjectMember({ projectId, email: data.get('email'), role: data.get('role') }),
              'Member added.',
              form,
            );
          }}
        >
          <div className="min-w-0 space-y-2">
            <label htmlFor={`${prefix}-account-email`} className="text-sm font-medium">
              Existing account email
            </label>
            <Input
              id={`${prefix}-account-email`}
              name="email"
              type="email"
              maxLength={254}
              required
            />
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor={`${prefix}-add-role`} className="text-sm font-medium">
              New member role
            </label>
            <Select id={`${prefix}-add-role`} name="role" defaultValue="member">
              {roles}
            </Select>
          </div>
          <Button type="submit">Add member</Button>
        </form>
        <ul className="divide-y">
          {roster.map((person) => (
            <li key={`${person.id}-${person.role}`} className="min-w-0 space-y-3 px-4 py-5 sm:px-6">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">
                  {person.full_name}
                  {person.id === userId ? ' · You' : ''}
                  {person.is_active ? '' : ' · Inactive'}
                </p>
                <p className="break-all text-xs text-muted-foreground">{person.email}</p>
              </div>
              <form
                aria-label={`Manage ${person.email || person.full_name}`}
                className="flex min-w-0 flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  if (person.id === userId && data.get('role') !== person.role) {
                    setOwnRole(String(data.get('role')));
                    return;
                  }
                  void run(
                    () =>
                      changeProjectMember({ projectId, userId: person.id, role: data.get('role') }),
                    'Role updated.',
                  );
                }}
              >
                <div className="min-w-0 grow basis-36 space-y-2 sm:max-w-52">
                  <label htmlFor={`${prefix}-${person.id}-role`} className="text-sm font-medium">
                    Project role
                  </label>
                  <Select id={`${prefix}-${person.id}-role`} name="role" defaultValue={person.role}>
                    {roles}
                  </Select>
                </div>
                <Button variant="outline" type="submit" disabled={!person.is_active}>
                  Save role
                </Button>
                <Button variant="ghost" type="button" onClick={() => setConfirm(person.id)}>
                  Remove member
                </Button>
              </form>
              {person.id === userId ? (
                <p className="text-xs text-muted-foreground">
                  Changing your own role can remove your team controls.
                </p>
              ) : null}
              {person.id === userId && ownRole ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm">
                    Change your own role to {ownRole}? This can remove your team controls.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() =>
                        void run(
                          () =>
                            changeProjectMember({ projectId, userId: person.id, role: ownRole }),
                          'Role updated.',
                        )
                      }
                    >
                      Confirm role change
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setOwnRole(undefined)}>
                      Keep role
                    </Button>
                  </div>
                </div>
              ) : null}
              {confirm === person.id ? (
                <div className="space-y-3 rounded-lg border border-destructive/30 p-3">
                  <p className="break-words text-sm">
                    Remove {person.full_name} from this project?
                    {person.id === userId
                      ? ' You will lose project access unless you are an administrator.'
                      : ''}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() =>
                        void run(
                          () => changeProjectMember({ projectId, userId: person.id, role: null }),
                          'Member removed.',
                        )
                      }
                    >
                      Confirm removal
                    </Button>
                    <Button variant="outline" type="button" onClick={() => setConfirm(undefined)}>
                      Keep member
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="space-y-4 border-t px-4 py-5 sm:px-6">
          <h3 className="font-semibold">Invitations</h3>
          {canInvite ? (
            <form
              aria-label="Invite a new account"
              className="grid min-w-0 gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget,
                  data = new FormData(form);
                const email = String(data.get('email')).trim().toLowerCase(),
                  role = String(data.get('role'));
                if (
                  !invitation.current ||
                  invitation.current.email !== email ||
                  invitation.current.role !== role
                )
                  invitation.current = { email, role, id: crypto.randomUUID() };
                const draft = invitation.current;
                void run(
                  () => send(draft.id, email, role),
                  'Invitation sent. Check the recipient inbox.',
                  form,
                );
              }}
            >
              <div className="min-w-0 space-y-2">
                <label htmlFor={`${prefix}-invite-email`} className="text-sm font-medium">
                  Invitation email
                </label>
                <Input
                  id={`${prefix}-invite-email`}
                  name="email"
                  type="email"
                  maxLength={254}
                  required
                />
              </div>
              <div className="min-w-0 space-y-2">
                <label htmlFor={`${prefix}-invite-role`} className="text-sm font-medium">
                  Invitation role
                </label>
                <Select id={`${prefix}-invite-role`} name="role" defaultValue="member">
                  {roles}
                </Select>
              </div>
              <Button type="submit" className="w-fit">
                Send invitation
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              New account invitations are managed by administrators.
            </p>
          )}
          <ul className="divide-y">
            {invites.map((invite) => (
              <li key={invite.id} className="space-y-3 py-4">
                <div>
                  <p className="break-all text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {PROJECT_ROLE_LABELS[invite.role]} · Expires {formatDate(invite.expires_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {canInvite && invite.invited_by === userId ? (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() =>
                        void run(
                          () => send(invite.id, invite.email, invite.role),
                          'Invitation sent. Check the recipient inbox.',
                        )
                      }
                    >
                      Retry send
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() =>
                      void run(() => cancelProjectInvitation(invite.id), 'Invitation canceled.')
                    }
                  >
                    Cancel invitation
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </fieldset>
    </div>
  );
}

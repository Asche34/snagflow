'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { acceptInvitation } from '@/app/invite/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PROJECT_ROLE_LABELS } from '@/lib/labels';
import type { ProjectRole } from '@snagflow/shared';

type Invitation = {
  project_id: string;
  project_name: string;
  email: string;
  role: ProjectRole;
  accepted: boolean;
};
export function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<Invitation>();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) summary.current?.focus();
  }, [error]);
  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const client = createClient();
        const hash = new URLSearchParams(window.location.hash.slice(1));
        // Consume session fragments without logging or retaining credentials in the URL.
        window.history.replaceState(null, '', window.location.pathname);
        if (hash.has('error')) throw new Error('invalid');
        if (hash.get('access_token') && hash.get('refresh_token')) {
          const result = await client.auth.setSession({
            access_token: hash.get('access_token')!,
            refresh_token: hash.get('refresh_token')!,
          });
          if (result.error) throw result.error;
        }
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user) throw new Error('invalid');
        const { data, error: lookupError } = await client.rpc('get_my_project_invite', {
          p_token: token,
        });
        if (lookupError || !data?.[0]) throw new Error('invalid');
        if (active) setInvite(data[0]);
      } catch {
        if (active)
          setError('This invitation is unavailable, expired, or belongs to another account.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [token]);
  async function submit(form: HTMLFormElement) {
    if (pending) return;
    const data = new FormData(form);
    setPending(true);
    setError('');
    try {
      const result = await acceptInvitation({
        token,
        fullName: data.get('fullName'),
        password: data.get('password'),
      });
      if (result.error) setError(result.error);
      if (result.projectId) {
        router.push(`/projects/${result.projectId}`);
        router.refresh();
      }
    } catch {
      setError('Your invitation could not be completed. Check your connection and retry.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-5">
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Checking your invitation…
        </p>
      ) : null}
      {error ? (
        <p
          ref={summary}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive focus-visible:ring-2 focus-visible:ring-ring"
        >
          {error}
        </p>
      ) : null}
      {invite ? (
        <>
          <p className="break-words text-sm">
            Join <strong>{invite.project_name}</strong> as{' '}
            {PROJECT_ROLE_LABELS[invite.role].toLowerCase()}.
          </p>
          <p className="break-all text-sm text-muted-foreground">{invite.email}</p>
          {invite.accepted ? (
            <Button asChild>
              <Link href={`/projects/${invite.project_id}`}>Open project</Link>
            </Button>
          ) : (
            <form
              aria-label="Accept project invitation"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(event.currentTarget);
              }}
              className="space-y-5"
            >
              <fieldset disabled={pending} className="min-w-0 space-y-5">
                <legend className="sr-only">Set up your account</legend>
                <div className="space-y-2">
                  <label htmlFor="invite-full-name" className="text-sm font-medium">
                    Full name
                  </label>
                  <Input
                    id="invite-full-name"
                    name="fullName"
                    autoComplete="name"
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="invite-password" className="text-sm font-medium">
                    New password
                  </label>
                  <Input
                    id="invite-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Use at least eight characters.</p>
                </div>
                <Button type="submit">{pending ? 'Joining project…' : 'Join project'}</Button>
              </fieldset>
            </form>
          )}
        </>
      ) : null}
      {!loading && !invite ? (
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-sm text-primary underline"
        >
          Sign in with the invited account
        </Link>
      ) : null}
    </div>
  );
}

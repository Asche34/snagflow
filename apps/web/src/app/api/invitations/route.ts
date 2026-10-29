import { canAct, ProjectInviteSendSchema } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, invitationOrigin } from '@/lib/supabase/admin';
import { teamError } from '@/lib/team-errors';

export async function POST(request: Request) {
  // This API owns auth/CSRF; the proxy intentionally does not cover /api.
  let origin: string;
  try {
    origin = invitationOrigin();
  } catch {
    return Response.json(
      { error: 'Invitations are temporarily unavailable. Contact your administrator.' },
      { status: 503 },
    );
  }
  // Standalone/reverse-proxy internal request URLs need not have the public origin.
  if (request.headers.get('origin') !== origin)
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return Response.json({ error: 'Sign in before sending invitations.' }, { status: 401 });
  const { data: profile } = await client
    .from('profiles')
    .select('is_admin,is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (
    !profile?.is_active ||
    !canAct({ id: user.id, isAdmin: profile.is_admin }, null, 'org:manage-users')
  )
    return Response.json(
      { error: 'Only an active administrator can invite a new account.' },
      { status: 403 },
    );
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096)
      return Response.json({ error: 'Invitation details are too long.' }, { status: 400 });
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: 'Enter valid invitation details.' }, { status: 400 });
  }
  const parsed = ProjectInviteSendSchema.safeParse(input);
  if (!parsed.success)
    return Response.json({ error: 'Enter a valid email and project role.' }, { status: 400 });
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json(
      { error: 'Invitations are temporarily unavailable. Contact your administrator.' },
      { status: 503 },
    );
  }
  const { data, error } = await client.rpc('prepare_project_invite', {
    p_id: parsed.data.clientId,
    p_project_id: parsed.data.projectId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !data?.[0])
    return Response.json({ error: teamError(error?.message ?? '') }, { status: 400 });
  const invite = data[0];
  let { error: deliveryError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${origin}/invite/${invite.token}`,
  });
  if (deliveryError?.code === 'email_exists') {
    // The Auth link may be consumed while setup/membership is still pending.
    // A recovery link re-establishes that recipient's session; the same app invite
    // still enforces email, expiry, cancellation and inviter authority in SQL.
    const recovery = await admin.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/invite/${invite.token}`,
    });
    deliveryError = recovery.error;
  }
  if (deliveryError)
    return Response.json(
      {
        error:
          'Invitation is pending, but email delivery could not be confirmed. Retry sending in a moment or cancel it.',
        inviteId: invite.id,
      },
      { status: 502 },
    );
  return Response.json({ inviteId: invite.id, sent: true });
}

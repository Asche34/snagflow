import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  hasEnv,
  serviceClient,
  signedInClient,
  CREDS,
  PROJECT_A,
  PROJECT_B,
  UIDS,
  createSnag,
  type SupabaseClient,
} from './helpers';
describe.skipIf(!hasEnv)('push authorization and lifecycle', () => {
  let service: SupabaseClient,
    member: SupabaseClient,
    other: SupabaseClient,
    manager: SupabaseClient;
  const token = `ExpoPushToken[push-test-${crypto.randomUUID()}]`;
  const install = crypto.randomUUID();
  const cleanupSnags: string[] = [],
    cleanupNotifications: string[] = [];
  beforeAll(async () => {
    service = serviceClient();
    member = await signedInClient(CREDS.member1);
    other = await signedInClient(CREDS.member2);
    manager = await signedInClient(CREDS.manager);
  });
  afterAll(async () => {
    if (service) {
      await service.from('push_tokens').delete().eq('token', token);
      if (cleanupNotifications.length)
        await service.from('notifications').delete().in('id', cleanupNotifications);
      if (cleanupSnags.length) await service.from('snags').delete().in('id', cleanupSnags);
    }
  });
  it('registers with a short lease and safely transfers a device token to a new account', async () => {
    const first = await member.rpc('register_push_token', {
      p_token: token,
      p_platform: 'android',
      p_deployment_key: 'snagflow.auth.deployment-test',
      p_installation_id: install,
    });
    expect(first.error).toBeNull();
    const moved = await other.rpc('register_push_token', {
      p_token: token,
      p_platform: 'android',
      p_deployment_key: 'snagflow.auth.deployment-test',
      p_installation_id: install,
    });
    expect(moved.error).toBeNull();
    const rows = await service.from('push_tokens').select('user_id,expires_at').eq('token', token);
    expect(rows.data).toHaveLength(1);
    expect(rows.data?.[0]?.user_id).toBe(UIDS.member2);
    const expiry = Date.parse(rows.data![0]!.expires_at);
    expect(expiry).toBeGreaterThan(Date.now());
    expect(expiry).toBeLessThan(Date.now() + 86401000);
    await member.rpc('unregister_push_token', { p_token: token });
    expect(
      (await service.from('push_tokens').select('token').eq('token', token)).data,
    ).toHaveLength(1);
  });
  it('prevents clients forging notifications and invoking delivery workers', async () => {
    const forgedId = crypto.randomUUID();
    cleanupNotifications.push(forgedId);
    const forged = await member
      .from('notifications')
      .insert({ id: forgedId, user_id: UIDS.member1, type: 'assigned', project_id: PROJECT_A });
    expect(forged.error).not.toBeNull();
    expect(
      (await member.rpc('push_authorized_notification', { p_id: crypto.randomUUID() })).error,
    ).not.toBeNull();
    expect(
      (
        await member.rpc('claim_push_delivery', {
          p_notification_id: crypto.randomUUID(),
          p_token: token,
        })
      ).error,
    ).not.toBeNull();
  });
  it('rechecks current recipient project membership and snag visibility', async () => {
    const snag = await createSnag(member, {
      projectId: PROJECT_B,
      title: 'Push authorization fixture',
    });
    cleanupSnags.push(snag.id);
    const notification = crypto.randomUUID();
    cleanupNotifications.push(notification);
    await service.from('notifications').insert({
      id: notification,
      user_id: UIDS.member2,
      type: 'assigned',
      project_id: PROJECT_B,
      snag_id: snag.id,
    });
    const rejected = await service.rpc('push_authorized_notification', { p_id: notification });
    expect(rejected.error).toBeNull();
    expect(rejected.data).toBeNull();
    await service.from('notifications').update({ user_id: UIDS.member1 }).eq('id', notification);
    expect(
      (await service.rpc('push_authorized_notification', { p_id: notification })).data,
    ).toMatchObject({ userId: UIDS.member1, snagId: snag.id });
    expect((await manager.rpc('soft_delete_snag', { p_snag_id: snag.id })).error).toBeNull();
    expect(
      (await service.rpc('push_authorized_notification', { p_id: notification })).data,
    ).toBeNull();
  });
  it('leaves delivery disabled by default', async () => {
    const result = await member.from('push_delivery_config').select('enabled').single();
    expect(result.error).toBeNull();
    expect(result.data?.enabled).toBe(false);
    expect(
      (
        await member
          .from('push_delivery_config')
          .update({ enabled: true })
          .eq('singleton', true)
          .select()
      ).data,
    ).toEqual([]);
  });
  it('does not remove a freshly re-registered token for an older delivery receipt', async () => {
    const snag = await createSnag(member, {
      projectId: PROJECT_A,
      title: 'Push receipt lifecycle fixture',
    });
    cleanupSnags.push(snag.id);
    const notification = crypto.randomUUID();
    cleanupNotifications.push(notification);
    expect(
      (
        await service
          .from('notifications')
          .insert({
            id: notification,
            user_id: UIDS.member2,
            type: 'comment',
            project_id: PROJECT_A,
            snag_id: snag.id,
          })
      ).error,
    ).toBeNull();
    expect(
      (
        await service
          .from('push_deliveries')
          .insert({
            notification_id: notification,
            token,
            status: 'sent',
            ticket: 'old-ticket',
            updated_at: new Date(Date.now() - 60000).toISOString(),
          })
      ).error,
    ).toBeNull();
    expect(
      (
        await other.rpc('register_push_token', {
          p_token: token,
          p_platform: 'android',
          p_deployment_key: 'snagflow.auth.deployment-test',
          p_installation_id: install,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await service.rpc('remove_push_delivery_token', {
          p_notification_id: notification,
          p_token: token,
        })
      ).error,
    ).toBeNull();
    expect(
      (await service.from('push_tokens').select('token').eq('token', token)).data,
    ).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { createPushHandler, type PushStore } from '../../../supabase/functions/push-send/handler';
const notification = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const token = 'ExpoPushToken[test-device]';
function fixture() {
  const events: string[] = [];
  const store: PushStore = {
    enabled: async () => true,
    authorized: async () => ({
      id: notification,
      userId: 'user',
      projectId: 'project',
      snagId: 'snag',
    }),
    tokens: async () => [{ token, deploymentKey: 'deployment-a' }],
    claim: async () => true,
    finish: async (_id, _token, status, ticket) => {
      events.push(`${status}:${ticket ?? ''}`);
    },
    removeToken: async (_token) => {
      events.push('removed');
    },
    receipts: async () => [{ notificationId: notification, token, ticket: 'ticket-a' }],
  };
  const request = (body: unknown = { notificationId: notification }, secret = 'secret') =>
    new Request('https://local/push-send', {
      method: 'POST',
      headers: { 'x-push-webhook-secret': secret },
      body: JSON.stringify(body),
    });
  return { store, events, request };
}
describe('push delivery boundary', () => {
  it('rejects unauthenticated delivery before reading recipient data', async () => {
    const f = fixture();
    f.store.enabled = async () => {
      throw Error('must not read');
    };
    expect(
      (await createPushHandler({ secret: 'secret', store: f.store })(f.request({}, 'wrong')))
        .status,
    ).toBe(401);
  });
  it('rejects arbitrary payloads and malformed IDs', async () => {
    const f = fixture();
    expect(
      (
        await createPushHandler({ secret: 'secret', store: f.store })(
          f.request({ notificationId: 'invalid', to: token }),
        )
      ).status,
    ).toBe(400);
  });
  it('does not send while deployment delivery is disabled', async () => {
    const f = fixture();
    f.store.enabled = async () => false;
    const handler = createPushHandler({
      secret: 'secret',
      store: f.store,
      transport: async () => {
        throw Error('must not send');
      },
    });
    expect((await handler(f.request())).status).toBe(409);
  });
  it('suppresses revoked/deleted/inactive recipients', async () => {
    const f = fixture();
    f.store.authorized = async () => null;
    const handler = createPushHandler({
      secret: 'secret',
      store: f.store,
      transport: async () => {
        throw Error('must not send');
      },
    });
    expect((await handler(f.request())).status).toBe(200);
    expect(f.events).toEqual([]);
  });
  it('sends generic text with deployment-bound opaque navigation data', async () => {
    const f = fixture();
    let sent: unknown;
    const handler = createPushHandler({
      secret: 'secret',
      store: f.store,
      transport: async (_url, options) => {
        sent = JSON.parse(String(options?.body));
        return Response.json({ data: [{ status: 'ok', id: 'ticket-a' }] });
      },
    });
    expect((await handler(f.request())).status).toBe(200);
    expect(sent).toEqual([
      {
        to: token,
        title: 'SnagFlow update',
        body: 'Open SnagFlow to view your update.',
        sound: 'default',
        channelId: 'snagflow-updates',
        data: { notificationId: notification, deploymentKey: 'deployment-a' },
      },
    ]);
    expect(f.events).toEqual(['sent:ticket-a']);
  });
  it('does not replay an already claimed delivery', async () => {
    const f = fixture();
    f.store.claim = async () => false;
    const handler = createPushHandler({
      secret: 'secret',
      store: f.store,
      transport: async () => {
        throw Error('must not send');
      },
    });
    expect((await handler(f.request())).status).toBe(200);
  });
  it('removes DeviceNotRegistered tickets', async () => {
    const f = fixture();
    const handler = createPushHandler({
      secret: 'secret',
      store: f.store,
      transport: async () =>
        Response.json({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
    });
    await handler(f.request());
    expect(f.events).toContain('removed');
    expect(f.events).toContain('failed:');
  });
  it('checks receipts and removes unregistered tokens', async () => {
    const f = fixture();
    const handler = createPushHandler({
      secret: 'secret',
      store: f.store,
      transport: async () =>
        Response.json({
          data: { 'ticket-a': { status: 'error', details: { error: 'DeviceNotRegistered' } } },
        }),
    });
    expect((await handler(f.request({ action: 'receipts' }))).status).toBe(200);
    expect(f.events).toEqual(['removed', 'failed:ticket-a']);
  });
});

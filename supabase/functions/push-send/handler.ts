/** Runtime-independent push boundary. All recipient data comes from the database, never the webhook. */
export type Delivery = { id: string; userId: string; projectId: string; snagId: string };
export type PushStore = {
  enabled: () => Promise<boolean>;
  authorized: (id: string) => Promise<Delivery | null>;
  tokens: (userId: string) => Promise<{ token: string; deploymentKey: string }[]>;
  claim: (notificationId: string, token: string) => Promise<boolean>;
  finish: (
    notificationId: string,
    token: string,
    status: 'sent' | 'failed' | 'delivered' | 'uncertain' | 'retry',
    ticket?: string,
  ) => Promise<void>;
  removeToken: (token: string, notificationId: string) => Promise<void>;
  receipts: () => Promise<{ notificationId: string; token: string; ticket: string }[]>;
};
type ExpoResult = { status?: string; id?: string; details?: { error?: string } };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const reply = (status: number, value: string) => Response.json({ status: value }, { status });
export function createPushHandler({
  secret,
  store,
  transport = fetch,
  accessToken,
}: {
  secret: string;
  store: PushStore;
  transport?: typeof fetch;
  accessToken?: string;
}) {
  const post = (path: string, body: unknown) =>
    transport(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return reply(405, 'method not allowed');
    if (!secret || request.headers.get('x-push-webhook-secret') !== secret)
      return reply(401, 'unauthorized');
    try {
      const raw = await request.text();
      if (raw.length > 16384) return reply(400, 'invalid request');
      const body: unknown = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return reply(400, 'invalid request');
      if (!(await store.enabled())) return reply(409, 'delivery disabled');
      if ('action' in body && body.action === 'receipts') {
        const rows = await store.receipts();
        if (!rows.length) return reply(200, 'no receipts');
        const response = await post('getReceipts', { ids: rows.map((row) => row.ticket) });
        if (!response.ok) return reply(503, 'receipt service unavailable');
        const value = (await response.json()) as { data?: Record<string, ExpoResult> };
        for (const row of rows) {
          const receipt = value.data?.[row.ticket];
          if (!receipt || !['ok', 'error'].includes(receipt.status ?? '')) continue;
          if (receipt.details?.error === 'DeviceNotRegistered')
            await store.removeToken(row.token, row.notificationId);
          await store.finish(
            row.notificationId,
            row.token,
            receipt.status === 'ok' ? 'delivered' : 'failed',
            row.ticket,
          );
        }
        return reply(200, 'receipts checked');
      }
      // Database webhooks may supply record.id. Their remaining payload is deliberately ignored.
      const id =
        'notificationId' in body
          ? body.notificationId
          : 'record' in body &&
              body.record &&
              typeof body.record === 'object' &&
              'id' in body.record
            ? body.record.id
            : null;
      if (typeof id !== 'string' || !UUID.test(id))
        return reply(400, 'invalid notification identity');
      const notification = await store.authorized(id);
      if (!notification) return reply(200, 'recipient unavailable');
      for (const entry of await store.tokens(notification.userId)) {
        if (!(await store.claim(id, entry.token))) continue;
        // Recheck immediately before delivery, after the per-token claim.
        if (!(await store.authorized(id))) {
          await store.finish(id, entry.token, 'failed');
          continue;
        }
        let response: Response;
        try {
          response = await post('send', [
            {
              to: entry.token,
              title: 'SnagFlow update',
              body: 'Open SnagFlow to view your update.',
              sound: 'default',
              channelId: 'snagflow-updates',
              data: { notificationId: id, deploymentKey: entry.deploymentKey },
            },
          ]);
        } catch {
          // A dropped response may already have reached Expo. Do not duplicate it automatically.
          await store.finish(id, entry.token, 'uncertain');
          continue;
        }
        if (!response.ok) {
          await store.finish(
            id,
            entry.token,
            response.status === 429 || response.status >= 500 ? 'retry' : 'failed',
          );
          continue;
        }
        let ticket: ExpoResult | undefined;
        try {
          const value = (await response.json()) as { data?: ExpoResult[] };
          ticket = value.data?.[0];
        } catch {
          /* ambiguous acceptance */
        }
        if (ticket?.details?.error === 'DeviceNotRegistered')
          await store.removeToken(entry.token, id);
        await store.finish(
          id,
          entry.token,
          ticket?.status === 'ok' && ticket.id
            ? 'sent'
            : ticket?.status === 'error'
              ? ticket.details?.error === 'MessageRateExceeded'
                ? 'retry'
                : 'failed'
              : 'uncertain',
          ticket?.id,
        );
      }
      return reply(200, 'processed');
    } catch {
      return reply(503, 'push processing unavailable');
    }
  };
}

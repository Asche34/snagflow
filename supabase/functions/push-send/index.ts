import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createPushHandler, type PushStore } from './handler.ts';
const client = createClient(
  Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:1',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'unconfigured',
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const store: PushStore = {
  enabled: async () => {
    if (Deno.env.get('PUSH_DELIVERY_ENABLED') !== 'true') return false;
    const result = await client.from('push_delivery_config').select('enabled').single();
    if (result.error) throw result.error;
    return result.data?.enabled === true;
  },
  authorized: async (id) => {
    const result = await client.rpc('push_authorized_notification', { p_id: id });
    if (result.error) throw result.error;
    return result.data;
  },
  tokens: async (userId) => {
    const result = await client
      .from('push_tokens')
      .select('token,deployment_key')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .not('deployment_key', 'is', null);
    if (result.error) throw result.error;
    return (result.data ?? []).map((row: { token: string; deployment_key: string }) => ({
      token: row.token,
      deploymentKey: row.deployment_key,
    }));
  },
  claim: async (notificationId, token) => {
    const result = await client.rpc('claim_push_delivery', {
      p_notification_id: notificationId,
      p_token: token,
    });
    if (result.error) throw result.error;
    return result.data === true;
  },
  finish: async (notificationId, token, status, ticket) => {
    const result = await client.rpc('finish_push_delivery', {
      p_notification_id: notificationId,
      p_token: token,
      p_status: status,
      p_ticket: ticket ?? null,
    });
    if (result.error) throw result.error;
  },
  removeToken: async (token, notificationId) => {
    const result = await client.rpc('remove_push_delivery_token', {
      p_notification_id: notificationId,
      p_token: token,
    });
    if (result.error) throw result.error;
  },
  receipts: async () => {
    const result = await client
      .from('push_deliveries')
      .select('notification_id,token,ticket')
      .eq('status', 'sent')
      .gt('updated_at', new Date(Date.now() - 24 * 60 * 60000).toISOString())
      .lt('updated_at', new Date(Date.now() - 15 * 60000).toISOString())
      .order('updated_at')
      .limit(100);
    if (result.error) throw result.error;
    return (result.data ?? [])
      .filter((row: { ticket: string | null }) => row.ticket)
      .map((row: { notification_id: string; token: string; ticket: string }) => ({
        notificationId: row.notification_id,
        token: row.token,
        ticket: row.ticket,
      }));
  },
};
Deno.serve(
  createPushHandler({
    secret: Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '',
    store,
    accessToken: Deno.env.get('EXPO_PUSH_ACCESS_TOKEN'),
  }),
);

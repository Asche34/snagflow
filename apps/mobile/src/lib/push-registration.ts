import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@snagflow/shared/db-types';
import type { createRegistrationLifecycle } from './push-core';
type Client = SupabaseClient<Database>;
type Lifecycle = ReturnType<typeof createRegistrationLifecycle>;
const registrations = new WeakMap<Client, Lifecycle>();
export function attachPushRegistration(client: Client, lifecycle: Lifecycle) {
  registrations.set(client, lifecycle);
  return () => {
    if (registrations.get(client) === lifecycle) registrations.delete(client);
  };
}
/** Called before Auth or deployment revocation, while the originating client can still unlink. */
export async function deactivatePushRegistration(client: Client): Promise<void> {
  const lifecycle = registrations.get(client);
  registrations.delete(client);
  // Local sign-out must remain possible offline. Server leases expire and messages contain no private text.
  await lifecycle?.deactivate().catch(() => {});
  const { Platform } = await import('react-native');
  if (Platform.OS !== 'web') {
    const notifications = await import('expo-notifications');
    await notifications.dismissAllNotificationsAsync().catch(() => {});
    notifications.clearLastNotificationResponse();
  }
}

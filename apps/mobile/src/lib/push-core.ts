/** Serializes token changes so a late register cannot undo a completed sign-out. */
export function createRegistrationLifecycle(service: {
  register: (token: string) => Promise<void>;
  unregister: (token: string) => Promise<void>;
}) {
  let active = true;
  let token: string | null = null;
  let pending: Promise<void> = Promise.resolve();
  return {
    update(next: string): Promise<void> {
      if (!active) return Promise.reject(Error('Push registration is inactive.'));
      const operation = pending.then(async () => {
        if (!active) return;
        const previous = token;
        // Capture the token before I/O: a dropped response may still have committed registration.
        token = next;
        await service.register(next);
        if (previous && previous !== next) await service.unregister(previous);
      });
      pending = operation.catch(() => {});
      return operation;
    },
    clear(): Promise<void> {
      const operation = pending.then(async () => {
        if (token) await service.unregister(token);
        token = null;
      });
      pending = operation.catch(() => {});
      return operation;
    },
    async deactivate(): Promise<void> {
      active = false;
      await pending;
      if (token) await service.unregister(token);
      token = null;
    },
  };
}
type NotificationRow = { user_id: string; snag_id: string | null; project_id: string | null };
type SnagRow = { id: string; project_id: string; deleted_at: string | null };
export async function resolvePushTarget(
  data: unknown,
  scope: {
    userId: string;
    deploymentKey: string;
    isCurrent: () => boolean;
    notification: (id: string) => Promise<NotificationRow | null>;
    snag: (id: string) => Promise<SnagRow | null>;
  },
): Promise<string | null> {
  if (
    !data ||
    typeof data !== 'object' ||
    !('deploymentKey' in data) ||
    data.deploymentKey !== scope.deploymentKey ||
    !('notificationId' in data) ||
    typeof data.notificationId !== 'string' ||
    !/^[a-f\d-]{36}$/i.test(data.notificationId) ||
    !scope.isCurrent()
  )
    return null;
  const notification = await scope.notification(data.notificationId);
  if (
    !scope.isCurrent() ||
    !notification?.snag_id ||
    !notification.project_id ||
    notification.user_id !== scope.userId
  )
    return null;
  const snag = await scope.snag(notification.snag_id);
  return scope.isCurrent() &&
    snag &&
    !snag.deleted_at &&
    snag.project_id === notification.project_id
    ? snag.id
    : null;
}

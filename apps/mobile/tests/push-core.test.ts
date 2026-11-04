import { describe, expect, it } from 'vitest';
import { createRegistrationLifecycle, resolvePushTarget } from '../src/lib/push-core';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const snagId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
describe('push lifecycle and navigation', () => {
  it('waits for an in-flight registration before unregistering on signout', async () => {
    const events: string[] = [];
    let finish!: () => void;
    const lifecycle = createRegistrationLifecycle({
      register: async (token) => {
        events.push(`start:${token}`);
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        events.push('registered');
      },
      unregister: async (token) => {
        events.push(`unregister:${token}`);
      },
    });
    const registering = lifecycle.update('token-a');
    await Promise.resolve();
    const closing = lifecycle.deactivate();
    finish();
    await registering;
    await closing;
    expect(events).toEqual(['start:token-a', 'registered', 'unregister:token-a']);
    await expect(lifecycle.update('token-b')).rejects.toThrow('inactive');
  });
  it('unregisters the previous rotated token and keeps only the current one', async () => {
    const events: string[] = [];
    const lifecycle = createRegistrationLifecycle({
      register: async (token) => {
        events.push(`add:${token}`);
      },
      unregister: async (token) => {
        events.push(`remove:${token}`);
      },
    });
    await lifecycle.update('old');
    await lifecycle.update('new');
    await lifecycle.deactivate();
    expect(events).toEqual(['add:old', 'add:new', 'remove:old', 'remove:new']);
  });
  const dependencies = () => ({
    userId: 'user-a',
    deploymentKey: 'deployment-a',
    isCurrent: () => true,
    notification: async () => ({ user_id: 'user-a', snag_id: snagId, project_id: 'project-a' }),
    snag: async () => ({ id: snagId, project_id: 'project-a', deleted_at: null }),
  });
  it('opens only an authorized persisted notification in the selected deployment', async () => {
    expect(
      await resolvePushTarget(
        { notificationId: id, deploymentKey: 'deployment-a' },
        dependencies(),
      ),
    ).toBe(snagId);
  });
  it('ignores a notification from another deployment before querying the server', async () => {
    expect(
      await resolvePushTarget(
        { notificationId: id, deploymentKey: 'deployment-b' },
        {
          ...dependencies(),
          notification: async () => {
            throw Error('must not query');
          },
        },
      ),
    ).toBeNull();
  });
  it('rejects a notification belonging to a previous account', async () => {
    expect(
      await resolvePushTarget(
        { notificationId: id, deploymentKey: 'deployment-a' },
        { ...dependencies(), userId: 'user-b' },
      ),
    ).toBeNull();
  });
  it('does not navigate after deployment/account changes during validation', async () => {
    let current = true;
    expect(
      await resolvePushTarget(
        { notificationId: id, deploymentKey: 'deployment-a' },
        {
          ...dependencies(),
          isCurrent: () => current,
          notification: async () => {
            current = false;
            return { user_id: 'user-a', snag_id: snagId, project_id: 'project-a' };
          },
        },
      ),
    ).toBeNull();
  });
  it('does not navigate to a deleted or revoked snag', async () => {
    expect(
      await resolvePushTarget(
        { notificationId: id, deploymentKey: 'deployment-a' },
        { ...dependencies(), snag: async () => null },
      ),
    ).toBeNull();
  });
});

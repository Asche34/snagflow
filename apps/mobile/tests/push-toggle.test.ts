import { describe, expect, it } from 'vitest';
import { createRegistrationLifecycle } from '../src/lib/push-core';
describe('push opt-out and re-enable', () => {
  it('supports turning off and on without closing the account lifecycle', async () => {
    const registered: string[] = [],
      removed: string[] = [];
    const lifecycle = createRegistrationLifecycle({
      register: async (token) => {
        registered.push(token);
      },
      unregister: async (token) => {
        removed.push(token);
      },
    });
    await lifecycle.update('same-token');
    await lifecycle.clear();
    await lifecycle.update('same-token');
    expect(registered).toEqual(['same-token', 'same-token']);
    expect(removed).toEqual(['same-token']);
  });
});

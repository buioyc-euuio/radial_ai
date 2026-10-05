import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal in-memory stand-in for the bits of @vercel/kv that _pass.ts uses.
const store = new Map<string, unknown>();
vi.mock('@vercel/kv', () => ({
  kv: {
    get: async (k: string) => store.get(k) ?? null,
    mget: async (...keys: string[]) => keys.map(k => store.get(k) ?? null),
    set: async (k: string, v: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(k)) return null;
      store.set(k, v);
      return 'OK';
    },
    del: async (...keys: string[]) => { keys.forEach(k => store.delete(k)); },
  },
}));

import { getPassStatus, openPassRequest, approvePassRequest } from '../../api/_pass';

describe('one-hour pass', () => {
  beforeEach(() => store.clear());

  it('goes none → pending → active for one hour, and the approval id is single-use', async () => {
    expect(await getPassStatus('A@x.com')).toEqual({ active: false, expiresAt: null, pending: false });

    const id = await openPassRequest('A@x.com');
    expect(id).toBeTruthy();
    expect((await getPassStatus('a@x.com')).pending).toBe(true);

    const granted = await approvePassRequest(id!);
    expect(granted?.email).toBe('a@x.com');
    const status = await getPassStatus('a@x.com');
    expect(status.active).toBe(true);
    expect(status.pending).toBe(false);
    expect(status.expiresAt! - Date.now()).toBeGreaterThan(59 * 60 * 1000);
    expect(status.expiresAt! - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000);

    expect(await approvePassRequest(id!)).toBeNull();
  });

  it('does not open a second request while one is pending', async () => {
    expect(await openPassRequest('a@x.com')).toBeTruthy();
    expect(await openPassRequest('a@x.com')).toBeNull();
  });

  it('rejects unknown approval ids and treats an elapsed pass as inactive', async () => {
    expect(await approvePassRequest('nope')).toBeNull();
    store.set('pass:active:a@x.com', Date.now() - 1);
    expect((await getPassStatus('a@x.com')).active).toBe(false);
  });
});

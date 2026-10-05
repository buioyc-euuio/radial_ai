import { kv } from '@vercel/kv';

// One-hour pass to the developer (PROD) API key, granted when the developer
// approves a request from their phone (ntfy notification → /api/approve-pass).
// Independent of the 3-day trial: anyone without access may ask.
const PASS_MS = 60 * 60 * 1000;
// How long an unanswered request stays open; also the re-notify cooldown.
const REQUEST_TTL_S = 30 * 60;

export interface PassStatus {
  active: boolean;
  expiresAt: number | null;
  pending: boolean;   // request sent, waiting for the developer to approve
}

const NONE: PassStatus = { active: false, expiresAt: null, pending: false };

const activeKey = (email: string) => `pass:active:${email.toLowerCase()}`;
const pendingKey = (email: string) => `pass:pending:${email.toLowerCase()}`;
const requestKey = (id: string) => `pass:req:${id}`;

/** Fails closed (no pass) if KV is unavailable. */
export async function getPassStatus(email: string): Promise<PassStatus> {
  try {
    const [expiresAt, pendingId] = await kv.mget<[number | null, string | null]>(
      activeKey(email), pendingKey(email),
    );
    if (expiresAt != null && Date.now() < expiresAt) return { active: true, expiresAt, pending: false };
    return { ...NONE, pending: pendingId != null };
  } catch {
    return NONE;
  }
}

/**
 * Opens an approval request and returns its unguessable id (the approval link's
 * only credential). Returns null if one is already open for this email, so
 * repeated clicks can't spam the developer's phone.
 */
export async function openPassRequest(email: string): Promise<string | null> {
  const id = crypto.randomUUID();
  const ok = await kv.set(pendingKey(email), id, { nx: true, ex: REQUEST_TTL_S });
  if (!ok) return null;
  await kv.set(requestKey(id), email.toLowerCase(), { ex: REQUEST_TTL_S });
  return id;
}

export async function cancelPassRequest(email: string, id: string): Promise<void> {
  await kv.del(pendingKey(email), requestKey(id));
}

export async function peekPassRequest(id: string): Promise<string | null> {
  return kv.get<string>(requestKey(id));
}

/** Grants the pass (clock starts now). Returns null for an unknown/expired/used id. */
export async function approvePassRequest(id: string): Promise<{ email: string; expiresAt: number } | null> {
  const email = await kv.get<string>(requestKey(id));
  if (!email) return null;
  const expiresAt = Date.now() + PASS_MS;
  await kv.set(activeKey(email), expiresAt, { px: PASS_MS });
  await kv.del(pendingKey(email), requestKey(id));
  return { email, expiresAt };
}

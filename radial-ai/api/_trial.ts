import { kv } from '@vercel/kv';

// First Google login grants a free trial of the developer (PROD) API key.
const TRIAL_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_MS = TRIAL_DAYS * DAY_MS;

export interface TrialStatus {
  active: boolean;
  startedAt: number | null;
  expiresAt: number | null;
  daysLeft: number;
}

const INACTIVE: TrialStatus = { active: false, startedAt: null, expiresAt: null, daysLeft: 0 };

function fromStart(startedAt: number): TrialStatus {
  const expiresAt = startedAt + TRIAL_MS;
  const now = Date.now();
  const active = now < expiresAt;
  return {
    active,
    startedAt,
    expiresAt,
    daysLeft: active ? Math.ceil((expiresAt - now) / DAY_MS) : 0,
  };
}

/**
 * Returns the trial status for an email. When `establish` is true, the trial
 * clock is started on the very first call for that email (atomic NX write, so
 * re-logging in never resets or extends it). Fails closed (inactive) if KV is
 * unavailable.
 */
export async function getTrialStatus(
  email: string,
  { establish = false }: { establish?: boolean } = {},
): Promise<TrialStatus> {
  const key = `trial:start:${email.toLowerCase()}`;
  try {
    let startedAt = await kv.get<number>(key);
    if (startedAt == null && establish) {
      const now = Date.now();
      const ok = await kv.set(key, now, { nx: true });
      startedAt = ok ? now : await kv.get<number>(key);
    }
    if (startedAt == null) return INACTIVE;
    return fromStart(startedAt);
  } catch {
    return INACTIVE;
  }
}

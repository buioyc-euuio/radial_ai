import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

export interface TrialStatus {
  active: boolean;
  daysLeft: number;
  startedAt: number | null;  // null = eligible but never activated
  expiresAt: number | null;
}

/** Developer-approved one-hour pass to the developer API key. */
export interface PassStatus {
  active: boolean;
  expiresAt: number | null;
  pending: boolean;   // requested, waiting for the developer's approval
}

/**
 * Asks the developer (phone notification) for a one-hour pass. Safe to
 * re-click: the server won't re-notify while a request is still open.
 */
export async function requestHourPass(
  credential: string,
): Promise<{ pass: PassStatus | null; error?: string }> {
  try {
    const r = await fetch('/api/request-pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await r.json() as { pass?: PassStatus | null; error?: string };
    return { pass: data.pass ?? null, error: r.ok ? undefined : (data.error ?? `Server error ${r.status}`) };
  } catch { return { pass: null, error: '連線失敗，請稍後再試' }; }
}

/** Read-only pass status, for polling while a request awaits approval. */
export async function fetchPassStatus(credential: string): Promise<PassStatus | null> {
  try {
    const r = await fetch('/api/check-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await r.json() as { pass?: PassStatus | null };
    return data.pass ?? null;
  } catch { return null; }
}

/** The pass is short-lived, so re-check its expiry on the client clock too. */
export function isPassActive(pass: PassStatus | null): boolean {
  return !!pass?.active && (pass.expiresAt ?? 0) > Date.now();
}

/** Eligible to start a trial: signed in, not whitelisted, clock never started. */
export function isTrialEligible(s: Pick<AuthStore, 'isWhitelisted' | 'trial'>): boolean {
  return !s.isWhitelisted && (!s.trial || s.trial.startedAt == null);
}

/** Explicit opt-in: starts the 3-day trial clock server-side, returns the status. */
export async function activateTrial(credential: string): Promise<TrialStatus | null> {
  try {
    const r = await fetch('/api/activate-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await r.json() as { trial?: TrialStatus | null };
    return data.trial ?? null;
  } catch { return null; }
}

export function formatTrialExpiry(expiresAt: number | null): string {
  if (!expiresAt) return '—';
  const d = new Date(expiresAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface AuthStore {
  user: GoogleUser | null;
  credential: string | null;   // raw Google ID-token for backend verification
  isWhitelisted: boolean;
  trial: TrialStatus | null;   // 3-day free trial of the developer API key
  pass: PassStatus | null;     // developer-approved one-hour pass
  devMode: boolean;            // true = use backend PROD_API_KEY
  authExpired: boolean;        // Google ID-token expired — prompt re-login
  trialPromptDismissed: boolean; // user answered the first-login opt-in dialog

  login: (user: GoogleUser, credential: string) => void;
  logout: () => void;
  setWhitelisted: (v: boolean) => void;
  setTrial: (t: TrialStatus | null) => void;
  setPass: (p: PassStatus | null) => void;
  setDevMode: (v: boolean) => void;
  markAuthExpired: () => void;
  setTrialPromptDismissed: (v: boolean) => void;
}

/** Whether the signed-in user may use the developer (PROD) API key. */
export function hasDevKeyAccess(s: Pick<AuthStore, 'isWhitelisted' | 'trial' | 'pass'>): boolean {
  return s.isWhitelisted || !!s.trial?.active || isPassActive(s.pass);
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      credential: null,
      isWhitelisted: false,
      trial: null,
      pass: null,
      devMode: false,
      authExpired: false,
      trialPromptDismissed: false,

      login: (user, credential) => set({ user, credential, authExpired: false }),
      logout: () => set({ user: null, credential: null, isWhitelisted: false, trial: null, pass: null, devMode: false, authExpired: false, trialPromptDismissed: false }),
      setWhitelisted: (v) => set({ isWhitelisted: v }),
      setTrial: (t) => set({ trial: t }),
      setPass: (p) => set({ pass: p }),
      setDevMode: (v) => set({ devMode: v }),
      // Keep `user` (for the name/avatar in the re-login prompt) but drop the
      // dead credential so nothing keeps retrying with an expired token.
      markAuthExpired: () => set({ credential: null, authExpired: true }),
      setTrialPromptDismissed: (v) => set({ trialPromptDismissed: v }),
    }),
    {
      name: 'radial-ai-auth',
      storage: createJSONStorage(() => localStorage),
      // Don't persist devMode — re-evaluate on each session.
      // Trial is re-fetched (authoritative) from the server on each login.
      partialize: (s) => ({ user: s.user, credential: s.credential, isWhitelisted: s.isWhitelisted, trial: s.trial, pass: s.pass, trialPromptDismissed: s.trialPromptDismissed }),
    }
  )
);

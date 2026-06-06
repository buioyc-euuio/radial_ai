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
  devMode: boolean;            // true = use backend PROD_API_KEY
  authExpired: boolean;        // Google ID-token expired — prompt re-login
  trialPromptDismissed: boolean; // user answered the first-login opt-in dialog

  login: (user: GoogleUser, credential: string) => void;
  logout: () => void;
  setWhitelisted: (v: boolean) => void;
  setTrial: (t: TrialStatus | null) => void;
  setDevMode: (v: boolean) => void;
  markAuthExpired: () => void;
  setTrialPromptDismissed: (v: boolean) => void;
}

/** Whether the signed-in user may use the developer (PROD) API key. */
export function hasDevKeyAccess(s: Pick<AuthStore, 'isWhitelisted' | 'trial'>): boolean {
  return s.isWhitelisted || !!s.trial?.active;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      credential: null,
      isWhitelisted: false,
      trial: null,
      devMode: false,
      authExpired: false,
      trialPromptDismissed: false,

      login: (user, credential) => set({ user, credential, authExpired: false }),
      logout: () => set({ user: null, credential: null, isWhitelisted: false, trial: null, devMode: false, authExpired: false, trialPromptDismissed: false }),
      setWhitelisted: (v) => set({ isWhitelisted: v }),
      setTrial: (t) => set({ trial: t }),
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
      partialize: (s) => ({ user: s.user, credential: s.credential, isWhitelisted: s.isWhitelisted, trial: s.trial, trialPromptDismissed: s.trialPromptDismissed }),
    }
  )
);

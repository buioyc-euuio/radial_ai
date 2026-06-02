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
  expiresAt: number | null;
}

interface AuthStore {
  user: GoogleUser | null;
  credential: string | null;   // raw Google ID-token for backend verification
  isWhitelisted: boolean;
  trial: TrialStatus | null;   // 3-day free trial of the developer API key
  devMode: boolean;            // true = use backend PROD_API_KEY
  authExpired: boolean;        // Google ID-token expired — prompt re-login

  login: (user: GoogleUser, credential: string) => void;
  logout: () => void;
  setWhitelisted: (v: boolean) => void;
  setTrial: (t: TrialStatus | null) => void;
  setDevMode: (v: boolean) => void;
  markAuthExpired: () => void;
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

      login: (user, credential) => set({ user, credential, authExpired: false }),
      logout: () => set({ user: null, credential: null, isWhitelisted: false, trial: null, devMode: false, authExpired: false }),
      setWhitelisted: (v) => set({ isWhitelisted: v }),
      setTrial: (t) => set({ trial: t }),
      setDevMode: (v) => set({ devMode: v }),
      // Keep `user` (for the name/avatar in the re-login prompt) but drop the
      // dead credential so nothing keeps retrying with an expired token.
      markAuthExpired: () => set({ credential: null, authExpired: true }),
    }),
    {
      name: 'radial-ai-auth',
      storage: createJSONStorage(() => localStorage),
      // Don't persist devMode — re-evaluate on each session.
      // Trial is re-fetched (authoritative) from the server on each login.
      partialize: (s) => ({ user: s.user, credential: s.credential, isWhitelisted: s.isWhitelisted, trial: s.trial }),
    }
  )
);

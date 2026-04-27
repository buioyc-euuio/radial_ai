import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

interface AuthStore {
  user: GoogleUser | null;
  credential: string | null;   // raw Google ID-token for backend verification
  isWhitelisted: boolean;
  devMode: boolean;            // true = use backend PROD_API_KEY

  login: (user: GoogleUser, credential: string) => void;
  logout: () => void;
  setWhitelisted: (v: boolean) => void;
  setDevMode: (v: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      credential: null,
      isWhitelisted: false,
      devMode: false,

      login: (user, credential) => set({ user, credential }),
      logout: () => set({ user: null, credential: null, isWhitelisted: false, devMode: false }),
      setWhitelisted: (v) => set({ isWhitelisted: v }),
      setDevMode: (v) => set({ devMode: v }),
    }),
    {
      name: 'radial-ai-auth',
      storage: createJSONStorage(() => localStorage),
      // Don't persist devMode — re-evaluate on each session
      partialize: (s) => ({ user: s.user, credential: s.credential, isWhitelisted: s.isWhitelisted }),
    }
  )
);

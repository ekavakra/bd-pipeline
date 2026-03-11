/**
 * Auth Store — Zustand
 *
 * Manages JWT token and user state across the application.
 * Persists to localStorage for page refresh survival.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,

      setAuth: (accessToken, user) => set({ accessToken, user }),

      logout: () => set({ accessToken: null, user: null }),

      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'bd-pipeline-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    },
  ),
);

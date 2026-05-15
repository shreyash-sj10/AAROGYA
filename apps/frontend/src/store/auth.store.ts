import { create } from "zustand";

const AUTH_TOKEN_KEY = "aarogya_auth_token";

type AuthUser = {
  id: string;
  email: string;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: { token: string; user: AuthUser | null }) => void;
  setAuth: (data: { token: string; user: AuthUser | null }) => void;
  logout: () => void;
};

function readTokenFromStorage(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeTokenToStorage(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearTokenFromStorage() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

const initialToken = readTokenFromStorage();

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: initialToken,
  // Never auto-authenticate from localStorage token alone.
  isAuthenticated: false,
  login: ({ token, user }) => {
    writeTokenToStorage(token);
    set({
      token,
      user,
      isAuthenticated: true,
    });
  },
  setAuth: ({ token, user }) => {
    writeTokenToStorage(token);
    set({
      token,
      user,
      isAuthenticated: true,
    });
  },
  logout: () => {
    clearTokenFromStorage();
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));

export type { AuthUser };

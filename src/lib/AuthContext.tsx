import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchMe,
  getStoredToken,
  login as apiLogin,
  register as apiRegister,
  setStoredToken,
  type SessionUser,
  type UserRole,
} from "./api";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string;
    role: UserRole;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => setStoredToken(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      async login(email, password) {
        setError(null);
        const result = await apiLogin(email, password);
        setUser(result.user);
      },
      async register(payload) {
        setError(null);
        const created = await apiRegister(payload);
        if (created.token && created.id) {
          setUser(created);
          return;
        }
        const result = await apiLogin(payload.email, payload.password);
        setUser(result.user);
      },
      logout() {
        setStoredToken(null);
        setUser(null);
      },
    }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

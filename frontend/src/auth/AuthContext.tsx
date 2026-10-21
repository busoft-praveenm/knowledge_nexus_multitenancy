import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from '../api/client';
import { Persona } from '../api/types';

interface AuthState {
  user: Persona | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>(null as unknown as AuthState);
const USER_KEY = 'nexus.user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Persona | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw && tokenStore.get() ? (JSON.parse(raw) as Persona) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  const login = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const { data } = await api.post<{ accessToken: string; user: Persona }>('/auth/login', { email });
      tokenStore.set(data.accessToken);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser, RegisterInput } from '../types/auth';
import { apiService } from '../services/apiService';
import { clearAuthToken, getAuthToken, setAuthToken } from '../services/authStorage';
import { setUnauthorizedHandler } from '../services/crdbClient';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  requiresAuth: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const requiresAuth = apiService.isUsingCrdb();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(requiresAuth);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    if (!requiresAuth) {
      setLoading(false);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiService
      .getCurrentUser()
      .then((u) => setUser(u))
      .catch(() => {
        clearAuthToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [requiresAuth]);

  const login = useCallback(async (identifier: string, password: string) => {
    const { token, user: loggedInUser } = await apiService.login(identifier, password);
    setAuthToken(token);
    setUser(loggedInUser);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { token, user: newUser } = await apiService.register(input);
    setAuthToken(token);
    setUser(newUser);
  }, []);

  const value = useMemo(
    () => ({ user, loading, requiresAuth, login, register, logout }),
    [user, loading, requiresAuth, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

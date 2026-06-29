/**
 * useAuth.ts — Authentication Hook & Context
 *
 * Provides global authentication state using React Context.
 * Features:
 * - JWT access token management (in-memory + localStorage refresh token)
 * - User profile caching via React Query
 * - Login / register / logout handlers
 * - Automatic token refresh on 401 responses
 */

import React, { createContext, useContext, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

/* ─────────── Types ─────────── */

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (creds: LoginCredentials) => Promise<void>;
  register: (creds: RegisterCredentials) => Promise<void>;
  logout: () => void;
}

/* ─────────── Context ─────────── */

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/* ─────────── Provider ─────────── */

const AUTH_QUERY_KEY = ["auth", "me"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Check for existing refresh token on mount
    return !!localStorage.getItem("refreshToken");
  });

  /**
   * Fetch current user profile from the API.
   * Only enabled when we have a refresh token (indicating prior auth).
   * On failure, clear auth state.
   */
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        const { data } = await api.get<User>("/auth/me");
        setIsAuthenticated(true);
        return data;
      } catch {
        setIsAuthenticated(false);
        localStorage.removeItem("refreshToken");
        return null;
      }
    },
    enabled: isAuthenticated || !!localStorage.getItem("refreshToken"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  /* ── Mutations ── */

  const loginMutation = useMutation({
    mutationFn: async (creds: LoginCredentials) => {
      const { data } = await api.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/auth/login", creds);
      return data;
    },
    onSuccess: (data) => {
      localStorage.setItem("refreshToken", data.refreshToken);
      api.defaults.headers.Authorization = `Bearer ${data.accessToken}`;
      setIsAuthenticated(true);
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (creds: RegisterCredentials) => {
      const { data } = await api.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/auth/register", creds);
      return data;
    },
    onSuccess: (data) => {
      localStorage.setItem("refreshToken", data.refreshToken);
      api.defaults.headers.Authorization = `Bearer ${data.accessToken}`;
      setIsAuthenticated(true);
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
    },
  });

  /* ── Handlers ── */

  const login = useCallback(
    async (creds: LoginCredentials) => {
      await loginMutation.mutateAsync(creds);
    },
    [loginMutation]
  );

  const register = useCallback(
    async (creds: RegisterCredentials) => {
      await registerMutation.mutateAsync(creds);
    },
    [registerMutation]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("refreshToken");
    delete api.defaults.headers.Authorization;
    setIsAuthenticated(false);
    queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
    queryClient.removeQueries({ queryKey: ["tenant"] });
    // Optionally notify the server to invalidate the refresh token
    api.post("/auth/logout").catch(() => {});
  }, [queryClient]);

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading: isLoading && isAuthenticated,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

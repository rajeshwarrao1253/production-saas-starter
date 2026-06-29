/**
 * api.ts — Centralized HTTP Client
 *
 * Axios instance with production-grade interceptors:
 * - Automatic JWT access token injection
 * - X-Tenant-ID header from tenant context
 * - 401 → automatic token refresh with retry queue
 * - Request/response logging in development
 * - Standardized error handling
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

/**
 * Base API URL. Uses Vite's import.meta.env for environment-specific values.
 * Falls back to localhost:4000 for development.
 */
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * Global Axios instance for all API communication.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30s request timeout
  withCredentials: false, // We use Bearer tokens, not cookies
});

/* ─────────── Request Interceptor ─────────── */

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach JWT access token if available
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach tenant ID if already set in defaults (managed by useTenant)
    const tenantId = api.defaults.headers["X-Tenant-ID"];
    if (tenantId && config.headers) {
      config.headers["X-Tenant-ID"] = tenantId as string;
    }

    if (import.meta.env.DEV) {
      console.log(
        `[API] ${config.method?.toUpperCase()} ${config.url}`,
        config.params || ""
      );
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ─────────── Response Interceptor ─────────── */

/** Queue of failed requests to retry after token refresh */
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function getAccessToken(): string | null {
  // Access token is ephemeral — stored in-memory only.
  // We extract it from the axios default headers to persist across requests.
  const authHeader = api.defaults.headers.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 401 Unauthorized — attempt token refresh (once per request)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the refresh to complete, then retry
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const { data } = await axios.post<{
          accessToken: string;
          refreshToken: string;
        }>(`${API_BASE_URL}/auth/refresh`, { refreshToken });

        // Persist new tokens
        localStorage.setItem("refreshToken", data.refreshToken);
        api.defaults.headers.Authorization = `Bearer ${data.accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

        onTokenRefreshed(data.accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — force re-authentication
        localStorage.removeItem("refreshToken");
        delete api.defaults.headers.Authorization;
        window.location.href = "/";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 403 Forbidden — user lacks permission
    if (error.response?.status === 403) {
      console.warn("[API] Forbidden — insufficient permissions");
    }

    return Promise.reject(error);
  }
);

/* ─────────── Utility Exports ─────────── */

/**
 * Extract a user-friendly error message from an API error.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    return (
      data?.message ??
      data?.error ??
      error.message ??
      "An unexpected error occurred."
    );
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

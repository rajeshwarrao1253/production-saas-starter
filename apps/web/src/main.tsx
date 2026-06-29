/**
 * main.tsx — React Entry Point
 *
 * Bootstraps the React application with all global providers:
 * - QueryClientProvider (React Query for server state)
 * - React Router
 * - Authentication context
 * - Tenant context
 * - Toast notifications
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { TenantProvider } from "./hooks/useTenant";
import App from "./App";
import "./index.css";

/**
 * Global QueryClient configuration for React Query.
 *
 * Stale time: 30 seconds to reduce redundant API calls.
 * Retry: 1 retry for failed queries (not for 401/403 responses).
 * Refetch: Disabled on window focus to prevent unnecessary network activity.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,           // 30 seconds
      gcTime: 1000 * 60 * 5,          // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <App />
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

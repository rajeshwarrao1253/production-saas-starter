/**
 * useTenant.ts — Multi-Tenancy Hook & Context
 *
 * Manages the current active organization/tenant for the user.
 * Features:
 * - Automatic tenant resolution from user memberships
 * - Tenant switching with URL update
 * - X-Tenant-ID header injection for API calls
 * - Tenant-aware caching
 */

import React, { createContext, useContext, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "./useAuth";

/* ─────────── Types ─────────── */

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "FREE" | "PRO" | "TEAM" | "ENTERPRISE";
  logoUrl: string | null;
}

interface TenantContextValue {
  tenant: Tenant | null;
  tenants: Tenant[];
  isLoading: boolean;
  setTenant: (tenantId: string) => void;
  switchTenant: (tenantId: string) => Promise<void>;
}

/* ─────────── Context ─────────── */

const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}

const TENANT_QUERY_KEY = ["tenant", "list"];
const ACTIVE_TENANT_KEY = ["tenant", "active"];

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Fetch all tenants the current user belongs to.
   * Returns empty array when not authenticated.
   */
  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: TENANT_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<Tenant[]>("/tenants");
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  /**
   * Determine the active tenant:
   * 1. Check URL ?tenant= param
   * 2. Fallback to first tenant in list
   * 3. null when unauthenticated
   */
  const activeTenantId = searchParams.get("tenant");

  const { data: tenant } = useQuery<Tenant | null>({
    queryKey: ACTIVE_TENANT_KEY,
    queryFn: async () => {
      if (!isAuthenticated) return null;

      // If a specific tenant is requested, validate access
      if (activeTenantId) {
        const found = tenants.find((t) => t.id === activeTenantId);
        if (found) return found;
      }

      // Default to first available tenant
      return tenants[0] ?? null;
    },
    enabled: isAuthenticated && tenants.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  /**
   * Sync active tenant to X-Tenant-ID header on all API requests.
   */
  useEffect(() => {
    if (tenant?.id) {
      api.defaults.headers["X-Tenant-ID"] = tenant.id;
    } else {
      delete api.defaults.headers["X-Tenant-ID"];
    }
  }, [tenant?.id]);

  /**
   * Update URL search param when tenant changes externally.
   */
  useEffect(() => {
    if (tenant?.id && !activeTenantId) {
      setSearchParams({ tenant: tenant.id }, { replace: true });
    }
  }, [tenant?.id, activeTenantId, setSearchParams]);

  /* ── Actions ── */

  const setTenant = useCallback(
    (tenantId: string) => {
      setSearchParams({ tenant: tenantId }, { replace: true });
      const found = tenants.find((t) => t.id === tenantId);
      if (found) {
        queryClient.setQueryData(ACTIVE_TENANT_KEY, found);
      }
    },
    [tenants, setSearchParams, queryClient]
  );

  const switchTenant = useCallback(
    async (tenantId: string) => {
      setTenant(tenantId);
      // Invalidate tenant-scoped queries to refetch with new context
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    [setTenant, queryClient]
  );

  const value: TenantContextValue = {
    tenant: tenant ?? null,
    tenants,
    isLoading,
    setTenant,
    switchTenant,
  };

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

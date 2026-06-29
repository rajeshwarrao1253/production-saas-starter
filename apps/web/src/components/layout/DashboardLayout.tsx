/**
 * DashboardLayout.tsx — Application Shell
 *
 * Wraps all authenticated and public routes with a consistent layout:
 * - Responsive sidebar navigation (collapsible on mobile)
 * - Topbar with tenant switcher, user avatar, and notifications
 * - Main content area with proper scrolling behavior
 * - Breadcrumbs integration placeholder
 */

import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../hooks/useAuth";
import { useTenant } from "../../hooks/useTenant";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  Settings,
  Shield,
  Bell,
  Search,
  Menu,
  X,
  Building2,
  ChevronDown,
  LogOut,
} from "lucide-react";

/**
 * Navigation items with role-based visibility.
 * Each item specifies which minimum role is required to view it.
 */
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/", minRole: "VIEWER" },
  { label: "Billing", icon: CreditCard, href: "/billing", minRole: "MEMBER" },
  { label: "Team", icon: Users, href: "/team", minRole: "ADMIN" },
  { label: "Settings", icon: Settings, href: "/settings", minRole: "ADMIN" },
  { label: "Admin", icon: Shield, href: "/admin", minRole: "ADMIN" },
];

/** Maps role names to numeric levels for comparison */
const ROLE_LEVELS: Record<string, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { tenant, tenants, switchTenant } = useTenant();

  const userRole = user?.role ?? "VIEWER";
  const visibleNav = navItems.filter(
    (item) => (ROLE_LEVELS[item.minRole] ?? 0) <= (ROLE_LEVELS[userRole] ?? 0)
  );

  return (
    <div className="flex h-screen w-screen bg-background">
      {/* ─── Mobile Sidebar Overlay ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar-background
          transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold tracking-tight">
                SaaS Starter
              </span>
            </div>
            <button
              className="lg:hidden rounded-md p-1 hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <Sidebar
            items={visibleNav}
            onNavigate={() => setSidebarOpen(false)}
          />

          {/* Sidebar Footer */}
          <div className="border-t p-4">
            <p className="text-xs text-muted-foreground">
              v1.0.0 ·{" "}
              <a
                href="https://github.com/rajeshwarrao1253/production-saas-starter"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                GitHub
              </a>
            </p>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden rounded-md p-2 hover:bg-accent"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Search Bar */}
            <div className="hidden items-center rounded-md border bg-muted px-3 py-1.5 md:flex">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="ml-2 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="ml-4 rounded bg-background px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                Ctrl+K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tenant Switcher */}
            {user && tenants.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setTenantMenuOpen(!tenantMenuOpen)}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="max-w-[120px] truncate">
                    {tenant?.name ?? "Select Organization"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>

                {tenantMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setTenantMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border bg-popover shadow-lg">
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                        Your Organizations
                      </div>
                      {tenants.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            switchTenant(t.id);
                            setTenantMenuOpen(false);
                          }}
                          className={`flex w-full items-center px-3 py-2 text-sm hover:bg-accent ${
                            t.id === tenant?.id ? "bg-accent" : ""
                          }`}
                        >
                          <div className="mr-2 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{t.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {t.plan.toLowerCase()} plan
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notifications */}
            <button className="relative rounded-md p-2 hover:bg-accent">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </button>

            {/* User Menu */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium"
                >
                  {user.name?.charAt(0).toUpperCase() ??
                    user.email.charAt(0).toUpperCase()}
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border bg-popover shadow-lg">
                      <div className="border-b px-3 py-2">
                        <p className="text-sm font-medium">
                          {user.name ?? user.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

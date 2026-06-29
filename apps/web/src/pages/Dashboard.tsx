/**
 * Dashboard.tsx — Main Dashboard Page
 *
 * Displays a high-level overview of the tenant:
 * - Stat cards (revenue, users, API calls, storage)
 * - Recent activity feed
 * - Chart placeholders (ready for chart.js or recharts)
 * - Quick action buttons
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "../hooks/useTenant";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import {
  DollarSign,
  Users,
  Activity,
  HardDrive,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Zap,
  Clock,
  BarChart3,
} from "lucide-react";

/* ─────────── Types ─────────── */

interface DashboardStats {
  totalRevenue: number;
  activeUsers: number;
  apiCalls: number;
  storageUsed: number;
  revenueChange: number;   // percentage from last period
  usersChange: number;
  apiCallsChange: number;
  storageChange: number;
}

interface ActivityItem {
  id: string;
  type: "USER_JOINED" | "PAYMENT_RECEIVED" | "API_KEY_CREATED" | "SETTINGS_CHANGED";
  description: string;
  createdAt: string;
  actorName: string;
}

/* ─────────── Component ─────────── */

export function Dashboard() {
  const { tenant } = useTenant();
  const { user } = useAuth();

  const tenantId = tenant?.id ?? "";

  /** Fetch dashboard stats with tenant context */
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats", tenantId],
    queryFn: async () => {
      const { data } = await api.get<DashboardStats>("/dashboard/stats");
      return data;
    },
    enabled: !!tenantId,
  });

  /** Fetch recent activity feed */
  const { data: activities = [] } = useQuery<ActivityItem[]>({
    queryKey: ["dashboard", "activity", tenantId],
    queryFn: async () => {
      const { data } = await api.get<ActivityItem[]>("/dashboard/activity");
      return data;
    },
    enabled: !!tenantId,
  });

  const statCards = [
    {
      label: "Total Revenue",
      value: stats ? `$${stats.totalRevenue.toLocaleString()}` : "—",
      change: stats?.revenueChange ?? 0,
      icon: DollarSign,
      accent: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Active Users",
      value: stats?.activeUsers.toLocaleString() ?? "—",
      change: stats?.usersChange ?? 0,
      icon: Users,
      accent: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "API Calls (30d)",
      value: stats?.apiCalls.toLocaleString() ?? "—",
      change: stats?.apiCallsChange ?? 0,
      icon: Activity,
      accent: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Storage Used",
      value: stats ? `${(stats.storageUsed / 1024 / 1024 / 1024).toFixed(1)} GB` : "—",
      change: stats?.storageChange ?? 0,
      icon: HardDrive,
      accent: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back{user?.name ? `, ${user.name}` : ""} — here's what's
            happening in <strong>{tenant?.name ?? "your organization"}</strong>.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            <Clock className="h-4 w-4" />
            Last 30 days
          </button>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Zap className="h-4 w-4" />
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const isPositive = card.change >= 0;
          return (
            <div
              key={card.label}
              className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </span>
                <div className={`rounded-md p-2 ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.accent}`} />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">
                  {statsLoading ? (
                    <span className="inline-block h-7 w-20 animate-pulse rounded bg-muted" />
                  ) : (
                    card.value
                  )}
                </p>
                {!statsLoading && (
                  <div className="mt-1 flex items-center text-xs">
                    {isPositive ? (
                      <TrendingUp className="mr-1 h-3 w-3 text-emerald-600" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                    )}
                    <span
                      className={isPositive ? "text-emerald-600" : "text-red-500"}
                    >
                      {isPositive ? "+" : ""}
                      {card.change}%
                    </span>
                    <span className="ml-1 text-muted-foreground">from last month</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts + Activity Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Charts Placeholder */}
        <div className="rounded-lg border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Revenue Overview</h2>
            <button className="text-sm text-primary hover:underline">
              View Report
            </button>
          </div>
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed bg-muted/50">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm font-medium">Chart Placeholder</p>
              <p className="text-xs mt-1">
                Integrate Recharts or Chart.js here
              </p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <button className="text-sm text-primary hover:underline">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No recent activity.
              </div>
            ) : (
              activities.slice(0, 6).map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.actorName} ·{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <QuickActionButton label="Invite Team Member" href="/team" />
          <QuickActionButton label="Manage API Keys" href="/settings" />
          <QuickActionButton label="View Invoices" href="/billing" />
          <QuickActionButton label="Upgrade Plan" href="/billing" />
        </div>
      </div>
    </div>
  );
}

/** Small helper for quick action pill buttons */
function QuickActionButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}

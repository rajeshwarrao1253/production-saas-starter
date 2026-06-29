/**
 * App.tsx — Main Application Component
 *
 * Defines the top-level routing structure for the SaaS application.
 * All routes are wrapped in DashboardLayout which provides the sidebar,
 * topbar, and tenant context.
 *
 * Routes:
 *   /           → Dashboard (overview, stats, charts)
 *   /billing    → Stripe billing integration
 *   /team       → Team member management
 *   /settings   → Org settings, profile, API keys
 *   /admin      → Admin dashboard (admin role required)
 */

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import { Billing } from "./pages/Billing";
import { Team } from "./pages/Team";
import { Settings } from "./pages/Settings";

/**
 * Protected route guard — redirects unauthenticated users to login.
 * In a real app, you'd have a dedicated login page. For this starter,
 * we redirect to the dashboard (which shows auth status).
 */
function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        {/* Public routes */}
        <Route path="/" element={<Dashboard />} />

        {/* Protected routes */}
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team"
          element={
            <ProtectedRoute>
              <Team />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="mt-2 text-muted-foreground">
                  System-wide metrics and user management.
                </p>
              </div>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

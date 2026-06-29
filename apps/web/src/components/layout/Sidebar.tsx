/**
 * Sidebar.tsx — Navigation Sidebar Component
 *
 * Renders role-based navigation items with active state highlighting.
 * Used inside DashboardLayout. Supports keyboard navigation and
 * responsive collapse behavior.
 */

import React from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  minRole: string;
}

interface SidebarProps {
  items: NavItem[];
  onNavigate?: () => void;
}

export function Sidebar({ items, onNavigate }: SidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Sidebar">
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                to={item.href}
                onClick={onNavigate}
                className={`
                  group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium
                  transition-colors duration-150
                  ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }
                `}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={`h-5 w-5 flex-shrink-0 ${
                    isActive
                      ? "text-sidebar-primary-foreground"
                      : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
                  }`}
                  aria-hidden="true"
                />
                {item.label}
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Quick Actions Section */}
      <div className="mt-8">
        <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Links
        </h3>
        <ul className="mt-2 space-y-1">
          <li>
            <a
              href="https://github.com/rajeshwarrao1253/production-saas-starter/issues"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              Support
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

/**
 * rbac.ts — Role-Based Access Control Middleware
 *
 * Permission system with role hierarchy:
 *   OWNER (3)  → All permissions including deletion
 *   ADMIN (2)  → Manage members, settings, billing
 *   MEMBER (1) → Read/write resources, view billing
 *   VIEWER (0) → Read-only access
 *
 * Usage:
 *   router.get("/sensitive", requireRole("ADMIN"), handler);
 *   router.post("/data", requireMinRole("MEMBER"), handler);
 */

import { Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "./auth";
import { TenantRequest } from "./tenant";

const prisma = new PrismaClient();

/* ─────────── Types ─────────── */

type OrgRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
  VIEWER: 0,
};

interface RequestWithUserAndTenant extends AuthenticatedRequest, TenantRequest {}

/* ─────────── Permission Checking ─────────── */

/**
 * Fetches the member's role in the current tenant.
 * Returns null if the user is not a member.
 */
export async function getMemberRole(
  userId: string,
  tenantId: string
): Promise<OrgRole | null> {
  const member = await prisma.member.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: tenantId,
      },
    },
    select: { role: true },
  });
  return (member?.role as OrgRole) ?? null;
}

/* ─────────── Middleware Factory ─────────── */

/**
 * Creates middleware that requires the user to have AT LEAST the specified role.
 * Uses numeric hierarchy: OWNER > ADMIN > MEMBER > VIEWER.
 */
export function requireMinRole(requiredRole: OrgRole) {
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  return async (
    req: RequestWithUserAndTenant,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const user = req.user;
    const tenant = req.tenant;

    if (!user) {
      res.status(401).json({
        status: "error",
        message: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    if (!tenant) {
      res.status(400).json({
        status: "error",
        message: "Tenant context required",
        code: "TENANT_REQUIRED",
      });
      return;
    }

    try {
      const userRole = await getMemberRole(user.userId, tenant.id);

      if (!userRole) {
        res.status(403).json({
          status: "error",
          message: "You are not a member of this organization",
          code: "NOT_A_MEMBER",
        });
        return;
      }

      const userLevel = ROLE_HIERARCHY[userRole];

      if (userLevel < requiredLevel) {
        res.status(403).json({
          status: "error",
          message: `This action requires ${requiredRole} role or higher. Your role: ${userRole}`,
          code: "INSUFFICIENT_ROLE",
        });
        return;
      }

      // Attach role to request for downstream use
      (req as unknown as Record<string, unknown>).memberRole = userRole;
      next();
    } catch (err) {
      console.error("[rbac] Permission check error:", err);
      res.status(500).json({
        status: "error",
        message: "Permission check failed",
        code: "PERMISSION_CHECK_ERROR",
      });
    }
  };
}

/**
 * Convenience middleware: requires OWNER role.
 */
export const requireOwner = requireMinRole("OWNER");

/**
 * Convenience middleware: requires ADMIN or higher.
 */
export const requireAdmin = requireMinRole("ADMIN");

/**
 * Convenience middleware: requires MEMBER or higher.
 */
export const requireMember = requireMinRole("MEMBER");

/**
 * Convenience middleware: requires VIEWER or higher (any authenticated member).
 */
export const requireViewer = requireMinRole("VIEWER");

/* ─────────── Permission Helpers ─────────── */

/**
 * Check if a specific action is allowed for a role.
 * Use this for fine-grained permission checks in route handlers.
 */
export function can(role: OrgRole, action: "read" | "write" | "delete" | "admin" | "billing") {
  switch (action) {
    case "read":
      return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.VIEWER;
    case "write":
      return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.MEMBER;
    case "billing":
      return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.ADMIN;
    case "admin":
    case "delete":
      return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.ADMIN;
    default:
      return false;
  }
}

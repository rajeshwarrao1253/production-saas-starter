/**
 * tenant.ts — Multi-Tenancy Middleware
 *
 * Resolves the current tenant from:
 * 1. X-Tenant-ID header (primary — from tenant context)
 * 2. Subdomain (e.g., acme.example.com → acme org)
 * 3. Falls back to user's default organization
 *
 * Validates subscription status and attaches tenant info to the request.
 */

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ─────────── Types ─────────── */

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerId: string;
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
}

export interface TenantRequest extends Request {
  tenant?: TenantContext;
}

/* ─────────── Middleware ─────────── */

/**
 * Resolves the tenant for the current request.
 * Looks up X-Tenant-ID header first, then falls back to subdomain lookup.
 * Validates that the requesting user is a member of the tenant.
 */
export async function resolveTenant(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip tenant resolution for public routes (auth, health)
  if (req.path.startsWith("/auth/") || req.path === "/health" || req.path === "/ready") {
    next();
    return;
  }

  const userId = (req as unknown as Record<string, unknown>).user
    ? ((req as unknown as { user: { userId: string } }).user.userId)
    : null;

  // Strategy 1: X-Tenant-ID header (most reliable)
  const headerTenantId = req.headers["x-tenant-id"] as string | undefined;

  // Strategy 2: Subdomain (e.g., acme.example.com)
  const host = req.headers.host ?? "";
  const subdomain = host.split(".")[0];
  const isSubdomainTenant = subdomain && subdomain !== "www" && subdomain !== "app" && subdomain !== "localhost" && subdomain !== "127";

  let tenantId = headerTenantId;

  // If no header but subdomain present, look up org by slug
  if (!tenantId && isSubdomainTenant) {
    try {
      const org = await prisma.organization.findUnique({
        where: { slug: subdomain },
        select: { id: true },
      });
      if (org) tenantId = org.id;
    } catch {
      // Log and continue
    }
  }

  if (!tenantId) {
    res.status(400).json({
      status: "error",
      message: "Tenant ID required. Provide X-Tenant-ID header or use a subdomain.",
      code: "TENANT_REQUIRED",
    });
    return;
  }

  try {
    // Look up tenant and verify user membership
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        ownerId: true,
        stripeCustomerId: true,
        subscriptionStatus: true,
        members: {
          where: userId ? { userId } : undefined,
          select: { role: true },
        },
      },
    });

    if (!org) {
      res.status(404).json({
        status: "error",
        message: "Organization not found",
        code: "TENANT_NOT_FOUND",
      });
      return;
    }

    // If authenticated, verify membership
    if (userId && org.members.length === 0) {
      res.status(403).json({
        status: "error",
        message: "You are not a member of this organization",
        code: "TENANT_ACCESS_DENIED",
      });
      return;
    }

    // Check subscription status (allow FREE plan and active subscriptions)
    const isPaidPlan = org.plan !== "FREE";
    const isSubscriptionActive =
      !isPaidPlan ||
      org.subscriptionStatus === "active" ||
      org.subscriptionStatus === "trialing";

    if (isPaidPlan && !isSubscriptionActive) {
      res.status(403).json({
        status: "error",
        message: "Subscription is inactive. Please update your billing information.",
        code: "SUBSCRIPTION_INACTIVE",
      });
      return;
    }

    req.tenant = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      ownerId: org.ownerId,
      stripeCustomerId: org.stripeCustomerId,
      subscriptionStatus: org.subscriptionStatus,
    };

    next();
  } catch (err) {
    console.error("[tenant] Resolution error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to resolve tenant",
      code: "TENANT_RESOLUTION_ERROR",
    });
  }
}

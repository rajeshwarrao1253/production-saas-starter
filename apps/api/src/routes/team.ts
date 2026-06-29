/**
 * team.ts — Team Management Routes
 *
 * Endpoints:
 *   GET  /team/members       — List all members in the tenant
 *   GET  /team/invitations   — List pending invitations
 *   POST /team/invite        — Invite a member by email
 *   PATCH /team/members/:id/role — Update member role
 *   DELETE /team/members/:id     — Remove member
 *   POST /team/invitations/:id/resend — Resend invitation
 *
 * All endpoints require ADMIN or higher role.
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";
import { resolveTenant, TenantRequest } from "../middleware/tenant";
import { createError } from "../middleware/error-handler";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken, resolveTenant, requireAdmin);

interface TeamRequest extends AuthenticatedRequest, TenantRequest {}

/**
 * GET /team/members
 * List all members of the current tenant.
 */
router.get("/members", async (req: TeamRequest, res: Response) => {
  const tenant = req.tenant!;

  const members = await prisma.member.findMany({
    where: { organizationId: tenant.id },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const formatted = members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    email: m.user.email,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    joinedAt: m.createdAt.toISOString(),
  }));

  res.json(formatted);
});

/**
 * GET /team/invitations
 * List pending invitations for the tenant.
 */
router.get("/invitations", async (req: TeamRequest, res: Response) => {
  const tenant = req.tenant!;

  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId: tenant.id,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(invitations);
});

/**
 * POST /team/invite
 * Invite a new member by email address.
 */
router.post("/invite", async (req: TeamRequest, res: Response) => {
  const tenant = req.tenant!;
  const inviterId = req.user!.userId;
  const { email, role = "MEMBER" } = req.body;

  if (!email || !email.includes("@")) {
    throw createError("Valid email address required.", 400, "INVALID_EMAIL");
  }

  if (!["ADMIN", "MEMBER", "VIEWER"].includes(role)) {
    throw createError("Invalid role. Must be ADMIN, MEMBER, or VIEWER.", 400, "INVALID_ROLE");
  }

  // Check if user is already a member
  const existingMember = await prisma.member.findFirst({
    where: {
      organizationId: tenant.id,
      user: { email: email.toLowerCase() },
    },
    select: { id: true },
  });

  if (existingMember) {
    throw createError("This user is already a member of the organization.", 409, "ALREADY_MEMBER");
  }

  // Check for existing pending invitation
  const existingInvite = await prisma.invitation.findFirst({
    where: {
      organizationId: tenant.id,
      email: email.toLowerCase(),
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (existingInvite) {
    throw createError("A pending invitation already exists for this email.", 409, "INVITE_EXISTS");
  }

  // Create invitation
  const invitation = await prisma.invitation.create({
    data: {
      email: email.toLowerCase(),
      role: role as "ADMIN" | "MEMBER" | "VIEWER",
      organizationId: tenant.id,
      invitedById: inviterId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  // TODO: Send invitation email
  // await sendInvitationEmail(email, tenant.name, invitationLink);

  res.status(201).json({
    status: "success",
    data: { invitation },
  });
});

/**
 * PATCH /team/members/:id/role
 * Update a member's role.
 */
router.patch("/members/:id/role", async (req: TeamRequest, res: Response) => {
  const tenant = req.tenant!;
  const { id: memberId } = req.params;
  const { role } = req.body;

  if (!["ADMIN", "MEMBER", "VIEWER"].includes(role)) {
    throw createError("Invalid role.", 400, "INVALID_ROLE");
  }

  // Prevent modifying the owner
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: tenant.id },
    select: { role: true, userId: true },
  });

  if (!member) {
    throw createError("Member not found.", 404, "MEMBER_NOT_FOUND");
  }

  if (member.role === "OWNER") {
    throw createError("Cannot modify the owner's role.", 403, "CANNOT_MODIFY_OWNER");
  }

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { role: role as "ADMIN" | "MEMBER" | "VIEWER" },
    select: {
      id: true,
      role: true,
      user: {
        select: { id: true, email: true, name: true, avatarUrl: true },
      },
    },
  });

  res.json({
    status: "success",
    data: {
      member: {
        id: updated.id,
        userId: updated.user.id,
        email: updated.user.email,
        name: updated.user.name,
        avatarUrl: updated.user.avatarUrl,
        role: updated.role,
      },
    },
  });
});

/**
 * DELETE /team/members/:id
 * Remove a member from the organization.
 */
router.delete("/members/:id", async (req: TeamRequest, res: Response) => {
  const tenant = req.tenant!;
  const { id: memberId } = req.params;

  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: tenant.id },
    select: { role: true, userId: true },
  });

  if (!member) {
    throw createError("Member not found.", 404, "MEMBER_NOT_FOUND");
  }

  if (member.role === "OWNER") {
    throw createError("Cannot remove the owner. Transfer ownership first.", 403, "CANNOT_REMOVE_OWNER");
  }

  await prisma.member.delete({ where: { id: memberId } });

  res.json({ status: "success", message: "Member removed successfully" });
});

export { router as teamRouter };

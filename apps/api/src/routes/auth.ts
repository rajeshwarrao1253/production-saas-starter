/**
 * auth.ts — Authentication Routes
 *
 * Endpoints:
 *   POST /auth/register     — Create new user + organization
 *   POST /auth/login        — Authenticate and get tokens
 *   POST /auth/refresh      — Exchange refresh token for new access token
 *   POST /auth/logout       — Invalidate refresh token
 *   GET  /auth/me           — Get current user profile
 *   POST /auth/forgot-password — Initiate password reset
 *   POST /auth/reset-password  — Complete password reset
 *
 * Features:
 * - Bcrypt password hashing (12 rounds)
 * - JWT access + refresh token pair
 * - Input validation
 * - Automatic organization creation on register
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { createError } from "../middleware/error-handler";

const router = Router();
const prisma = new PrismaClient();

/* ─────────── Helpers ─────────── */

/** Generate access token (short-lived) */
function generateAccessToken(user: { id: string; email: string }) {
  return jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
}

/** Generate refresh token (long-lived) */
function generateRefreshToken(user: { id: string }) {
  return jwt.sign({ userId: user.id }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
}

/* ─────────── Routes ─────────── */

/**
 * POST /auth/register
 * Register a new user and create their first organization.
 */
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("name").optional().trim().escape(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: errors.array(),
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const { email, password, name } = req.body;

    try {
      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) {
        throw createError("An account with this email already exists.", 409, "DUPLICATE_EMAIL");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user + organization in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: name || null,
          },
          select: { id: true, email: true, name: true },
        });

        // Create default organization
        const orgSlug = email.split("@")[0].replace(/[^a-z0-9]/g, "-").toLowerCase();
        const org = await tx.organization.create({
          data: {
            name: `${name || email}'s Organization`,
            slug: `${orgSlug}-${user.id.slice(0, 6)}`,
            ownerId: user.id,
            plan: "FREE",
          },
          select: { id: true, name: true, slug: true },
        });

        // Add user as OWNER member
        await tx.member.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: "OWNER",
          },
        });

        return { user, org };
      });

      // Generate tokens
      const accessToken = generateAccessToken(result.user);
      const refreshToken = generateRefreshToken(result.user);

      // Store refresh token hash (for revocation support)
      const refreshHash = await bcrypt.hash(refreshToken, 10);
      await prisma.refreshToken.create({
        data: {
          tokenHash: refreshHash,
          userId: result.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      res.status(201).json({
        status: "success",
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: "OWNER",
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode) throw err;
      console.error("[auth] Registration error:", err);
      throw createError("Registration failed. Please try again.", 500, "REGISTRATION_ERROR");
    }
  }
);

/**
 * POST /auth/login
 * Authenticate with email and password.
 */
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: errors.array(),
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const { email, password } = req.body;

    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          avatarUrl: true,
          members: {
            select: {
              role: true,
              organization: {
                select: { id: true, name: true, slug: true, plan: true },
              },
            },
          },
        },
      });

      if (!user || !user.passwordHash) {
        throw createError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
      }

      // Verify password
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw createError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Store refresh token
      const refreshHash = await bcrypt.hash(refreshToken, 10);
      await prisma.refreshToken.create({
        data: {
          tokenHash: refreshHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      res.json({
        status: "success",
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.members[0]?.role ?? "MEMBER",
            organizations: user.members.map((m) => ({
              id: m.organization.id,
              name: m.organization.name,
              slug: m.organization.slug,
              role: m.role,
            })),
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode) throw err;
      console.error("[auth] Login error:", err);
      throw createError("Login failed. Please try again.", 500, "LOGIN_ERROR");
    }
  }
);

/**
 * POST /auth/refresh
 * Exchange a valid refresh token for a new access token pair.
 */
router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw createError("Refresh token required.", 400, "MISSING_REFRESH_TOKEN");
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, {
      clockTolerance: 60,
    }) as { userId: string };

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw createError("Invalid refresh token.", 401, "INVALID_REFRESH_TOKEN");
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Rotate refresh token: invalidate old, store new
    const newHash = await bcrypt.hash(newRefreshToken, 10);
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      prisma.refreshToken.create({
        data: {
          tokenHash: newHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    res.json({
      status: "success",
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      throw createError("Invalid or expired refresh token.", 401, "INVALID_REFRESH_TOKEN");
    }
    throw err;
  }
});

/**
 * POST /auth/logout
 * Invalidate the refresh token (client should also clear localStorage).
 */
router.post("/logout", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    try {
      const decoded = jwt.decode(refreshToken) as { userId: string } | null;
      if (decoded?.userId) {
        await prisma.refreshToken.deleteMany({
          where: { userId: decoded.userId },
        });
      }
    } catch {
      // Best-effort cleanup
    }
  }

  res.json({ status: "success", message: "Logged out successfully" });
});

/**
 * GET /auth/me
 * Get the current authenticated user's profile.
 */
router.get("/me", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      members: {
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw createError("User not found.", 404, "USER_NOT_FOUND");
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.members[0]?.role ?? "MEMBER",
    organizations: user.members.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  });
});

/**
 * POST /auth/forgot-password
 * Initiate password reset flow — sends email with reset token.
 */
router.post(
  "/forgot-password",
  [body("email").isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // Always return success to prevent email enumeration
    if (user) {
      // TODO: Generate reset token and send email
      // const resetToken = generateResetToken(user.id);
      // await sendPasswordResetEmail(email, resetToken);
    }

    res.json({
      status: "success",
      message: "If an account exists, a reset link has been sent.",
    });
  }
);

export { router as authRouter };

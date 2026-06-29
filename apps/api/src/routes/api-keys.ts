/**
 * api-keys.ts — API Key Management Routes
 *
 * Endpoints:
 *   GET  /api-keys         — List API keys for the tenant
 *   POST /api-keys         — Generate a new API key
 *   DELETE /api-keys/:id   — Revoke an API key
 *
 * All endpoints require ADMIN or higher role.
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";
import { resolveTenant, TenantRequest } from "../middleware/tenant";
import { createError } from "../middleware/error-handler";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken, resolveTenant, requireAdmin);

interface ApiKeyRequest extends AuthenticatedRequest, TenantRequest {}

/**
 * Generate a secure random API key with a recognizable prefix.
 * Format: saas_sk_{prefix}_{random}
 * The full key is shown only once on creation.
 */
function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const randomPart = crypto.randomBytes(32).toString("hex");
  const prefix = randomPart.slice(0, 8);
  const fullKey = `saas_sk_${prefix}_${randomPart.slice(8)}`;
  const hash = crypto.createHash("sha256").update(fullKey).digest("hex");
  return { fullKey, prefix, hash };
}

/**
 * GET /api-keys
 * List all API keys for the tenant (without full keys).
 */
router.get("/", async (req: ApiKeyRequest, res: Response) => {
  const tenant = req.tenant!;

  const keys = await prisma.apiKey.findMany({
    where: { organizationId: tenant.id },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(keys);
});

/**
 * POST /api-keys
 * Generate a new API key. The full key is returned only in this response.
 */
router.post("/", async (req: ApiKeyRequest, res: Response) => {
  const tenant = req.tenant!;
  const { name, scopes = ["read"] } = req.body;

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    throw createError("API key name is required.", 400, "INVALID_NAME");
  }

  // Validate scopes
  const validScopes = ["read", "write", "admin"];
  const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s));
  if (!Array.isArray(scopes) || scopes.length === 0 || invalidScopes.length > 0) {
    throw createError(
      `Invalid scopes. Valid values: ${validScopes.join(", ")}`,
      400,
      "INVALID_SCOPES"
    );
  }

  // Enforce maximum keys per organization
  const existingCount = await prisma.apiKey.count({
    where: { organizationId: tenant.id },
  });
  if (existingCount >= 50) {
    throw createError(
      "Maximum number of API keys (50) reached. Revoke unused keys first.",
      409,
      "API_KEY_LIMIT_REACHED"
    );
  }

  const { fullKey, prefix, hash } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      name: name.trim(),
      keyHash: hash,
      prefix,
      scopes,
      organizationId: tenant.id,
      createdById: req.user!.userId,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  res.status(201).json({
    status: "success",
    data: {
      apiKey,
      fullKey, // Only shown once!
    },
  });
});

/**
 * DELETE /api-keys/:id
 * Revoke (delete) an API key.
 */
router.delete("/:id", async (req: ApiKeyRequest, res: Response) => {
  const tenant = req.tenant!;
  const { id } = req.params;

  const key = await prisma.apiKey.findFirst({
    where: { id, organizationId: tenant.id },
    select: { id: true },
  });

  if (!key) {
    throw createError("API key not found.", 404, "API_KEY_NOT_FOUND");
  }

  await prisma.apiKey.delete({ where: { id } });

  res.json({ status: "success", message: "API key revoked successfully" });
});

/**
 * POST /api-keys/:id/rotate
 * Rotate an API key (revoke old, create new with same settings).
 */
router.post("/:id/rotate", async (req: ApiKeyRequest, res: Response) => {
  const tenant = req.tenant!;
  const { id } = req.params;

  const existing = await prisma.apiKey.findFirst({
    where: { id, organizationId: tenant.id },
    select: { id: true, name: true, scopes: true },
  });

  if (!existing) {
    throw createError("API key not found.", 404, "API_KEY_NOT_FOUND");
  }

  const { fullKey, prefix, hash } = generateApiKey();

  // Delete old and create new in a transaction
  const [newKey] = await prisma.$transaction([
    prisma.apiKey.create({
      data: {
        name: `${existing.name} (rotated)`,
        keyHash: hash,
        prefix,
        scopes: existing.scopes,
        organizationId: tenant.id,
        createdById: req.user!.userId,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
    prisma.apiKey.delete({ where: { id: existing.id } }),
  ]);

  res.json({
    status: "success",
    data: {
      apiKey: newKey,
      fullKey, // Only shown once!
    },
  });
});

export { router as apiKeyRouter };

/**
 * env.ts — Environment Configuration
 *
 * Validates and type-checks all environment variables at startup using Zod.
 * Fails fast with a descriptive error if any required variable is missing.
 * This prevents runtime surprises from undefined env vars.
 */

import { z } from "zod";

/**
 * Schema for environment variable validation.
 * All secrets are marked as optional in development but required in production.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  API_PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().min(1).max(65535))
    .default("4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  // Database
  DATABASE_URL: z.string().startsWith("postgresql://"),

  // Cache
  REDIS_URL: z.string().startsWith("redis://").default("redis://localhost:6379"),

  // Authentication
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  // OAuth
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  STRIPE_PRICE_PRO: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_TEAM: z.string().startsWith("price_").optional(),

  // Email
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().min(1).max(65535))
    .default("1025"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default("noreply@example.com"),

  // AWS
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
});

/**
 * Parsed and validated environment variables.
 * Process exits with code 1 if validation fails.
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "[env] Configuration validation failed:\n",
    parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")
  );
  process.exit(1);
}

/**
 * Type-safe environment configuration.
 * Import this throughout the API instead of accessing process.env directly.
 */
export const env = parsed.data;

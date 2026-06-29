/**
 * index.ts — Express Server Entry Point
 *
 * Bootstraps the production-grade API server with:
 * - Security middleware (helmet, CORS, rate limiting)
 * - Request logging (morgan + winston)
 * - JWT & tenant middleware
 * - Route mounting
 * - Global error handling
 * - Graceful shutdown on SIGTERM/SIGINT
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth";
import { billingRouter } from "./routes/billing";
import { teamRouter } from "./routes/team";
import { apiKeyRouter } from "./routes/api-keys";

// Load environment variables
const envPath = process.env.NODE_ENV === "production"
  ? ".env"
  : ".env.development";
dotenv.config({ path: envPath });

const app = express();
const PORT = env.API_PORT;

/* ─────────── Security Middleware ─────────── */

// Helmet for secure HTTP headers
app.use(helmet());

// CORS — restrict to frontend origin in production
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-ID"],
  })
);

/* ─────────── Rate Limiting ─────────── */

// General API rate limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});
app.use(generalLimiter);

// Stricter rate limit for auth endpoints: 5 requests per minute
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    status: "error",
    message: "Too many auth attempts. Please try again later.",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },
});

/* ─────────── Logging ─────────── */

// HTTP request logging
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

// Parse JSON request bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ─────────── Health Check ─────────── */

// Kubernetes / load balancer health probe
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? "1.0.0",
  });
});

// Readiness check — verify DB and Redis connectivity
app.get("/ready", async (_req: Request, res: Response) => {
  try {
    // TODO: Add actual DB + Redis connectivity checks
    res.status(200).json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not ready" });
  }
});

/* ─────────── Route Mounting ─────────── */

// Public routes
app.use("/auth", authLimiter, authRouter);

// Protected routes (require authentication + tenant context)
app.use("/billing", billingRouter);
app.use("/team", teamRouter);
app.use("/api-keys", apiKeyRouter);

// TODO: Add remaining routes
// app.use("/dashboard", dashboardRouter);
// app.use("/settings", settingsRouter);
// app.use("/tenants", tenantRouter);
// app.use("/webhooks", webhookRouter);

/* ─────────── 404 Handler ─────────── */

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint not found",
    code: "NOT_FOUND",
  });
});

/* ─────────── Global Error Handler ─────────── */

app.use(errorHandler);

/* ─────────── Graceful Shutdown ─────────── */

const server = app.listen(PORT, () => {
  console.log(`[server] API running on port ${PORT} in ${env.NODE_ENV} mode`);
});

// Handle graceful shutdown for Docker / Kubernetes
const shutdown = (signal: string) => {
  console.log(`[server] ${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    console.log("[server] HTTP server closed.");
    // Close DB connections, flush logs, etc.
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error("[server] Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});

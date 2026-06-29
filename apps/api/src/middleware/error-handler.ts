/**
 * error-handler.ts — Global Error Handler
 *
 * Catches all unhandled errors in the Express app and returns
 * structured, consistent JSON responses.
 *
 * Features:
 * - Distinguishes operational errors (bad input) from programming errors
 * - Returns detailed messages in development, generic in production
 * - Logs errors via Winston (production) or console (dev)
 * - Handles specific Prisma and Zod error types
 */

import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

/* ─────────── Types ─────────── */

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Creates a standardized API error with status code and error code.
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code: string = "INTERNAL_ERROR"
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
}

/* ─────────── Global Error Handler ─────────── */

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const errorCode = err.code ?? "INTERNAL_ERROR";
  const isDev = env.NODE_ENV === "development";

  // Don't leak error details in production
  const message =
    isDev || (err.isOperational && statusCode < 500)
      ? err.message
      : "Internal server error";

  // Log error details
  if (statusCode >= 500) {
    console.error("[error]", {
      code: errorCode,
      message: err.message,
      stack: isDev ? err.stack : undefined,
    });
  }

  // Check for specific error types and provide better messages

  // Prisma errors
  if (err.message?.includes("P2002")) {
    res.status(409).json({
      status: "error",
      message: "A record with this unique value already exists.",
      code: "DUPLICATE_ENTRY",
    });
    return;
  }

  if (err.message?.includes("P2025")) {
    res.status(404).json({
      status: "error",
      message: "Record not found.",
      code: "NOT_FOUND",
    });
    return;
  }

  // Zod validation errors
  if (err.message?.includes("validation")) {
    res.status(400).json({
      status: "error",
      message: err.message,
      code: "VALIDATION_ERROR",
    });
    return;
  }

  // JWT errors (from middleware that passes through)
  if (err.message === "jwt expired") {
    res.status(401).json({
      status: "error",
      message: "Token expired",
      code: "TOKEN_EXPIRED",
    });
    return;
  }

  res.status(statusCode).json({
    status: "error",
    message,
    code: errorCode,
    ...(isDev && { stack: err.stack }),
  });
}

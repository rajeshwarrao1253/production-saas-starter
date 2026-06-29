/**
 * auth.ts — JWT Authentication Middleware
 *
 * Verifies Bearer token from Authorization header.
 * Attaches decoded user payload to the request object for downstream use.
 * Handles token expiry with appropriate 401 responses.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

/* ─────────── Types ─────────── */

/** Payload encoded into the JWT access token */
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/** Extended Express Request with authenticated user */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/* ─────────── Middleware ─────────── */

/**
 * Verifies the JWT access token in the Authorization header.
 * On success: attaches `req.user` and calls `next()`.
 * On failure: returns 401 with an error code.
 */
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({
      status: "error",
      message: "Access token required",
      code: "MISSING_ACCESS_TOKEN",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      clockTolerance: 60, // 60s leeway for clock skew
    }) as JwtPayload;

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        status: "error",
        message: "Access token expired",
        code: "TOKEN_EXPIRED",
      });
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        status: "error",
        message: "Invalid access token",
        code: "INVALID_TOKEN",
      });
      return;
    }

    res.status(500).json({
      status: "error",
      message: "Token verification failed",
      code: "TOKEN_VERIFICATION_ERROR",
    });
  }
}

/**
 * Optional authentication — attaches user if token present,
 * but does not reject the request if absent.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        clockTolerance: 60,
      }) as JwtPayload;
      req.user = decoded;
    } catch {
      // Silently ignore invalid optional tokens
    }
  }

  next();
}

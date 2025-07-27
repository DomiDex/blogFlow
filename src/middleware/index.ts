/// <reference lib="deno.ns" />
import type { Hono } from "@hono/hono";
import { corsMiddleware } from "./cors.ts";
import { securityMiddleware, requestValidation } from "./security.ts";
import { requestLogger } from "./requestLogger.ts";
import { errorHandler } from "./errorHandler.ts";
import { rateLimiter, formRateLimiter, createWhitelistSkip } from "./rateLimiter.ts";
import type { Variables } from "@app-types";

/**
 * Register all middleware in the correct order
 * Order matters: error handler -> request logger -> security -> rate limit -> validation -> cors -> routes
 */
export function registerMiddleware(app: Hono<{ Variables: Variables }>): void {
  // Error handler middleware (must wrap all routes)
  app.use("*", errorHandler());

  // Request logger middleware (includes request ID generation)
  app.use("*", requestLogger());

  // Security headers middleware (early to protect all endpoints)
  app.use("*", securityMiddleware({
    enableNonce: false, // Can be enabled for stricter CSP
    enableCSP: true,
    enableHSTS: true,
  }));

  // Global rate limiting (before CORS to prevent abuse)
  app.use("*", rateLimiter({
    skip: createWhitelistSkip(),  // Skip rate limiting for localhost in development
  }));

  // Specific rate limiting for form endpoints
  app.use("/api/webflow-form", formRateLimiter);

  // Request validation middleware (validate before processing)
  app.use("*", requestValidation());

  // CORS middleware (before routes)
  app.use("*", corsMiddleware());
}

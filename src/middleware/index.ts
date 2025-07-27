/// <reference lib="deno.ns" />
import type { Hono } from "@hono/hono";
import { corsMiddleware } from "./cors.ts";
import { securityMiddleware } from "./security.ts";
import { requestLogger } from "./requestLogger.ts";
import { errorHandler } from "./errorHandler.ts";
import { rateLimiter, formRateLimiter, createWhitelistSkip } from "./rateLimiter.ts";

/**
 * Register all middleware in the correct order
 * Order matters: error handler -> request logger -> rate limit -> cors -> security -> routes
 */
export function registerMiddleware(app: Hono): void {
  // Error handler middleware (must wrap all routes)
  app.use("*", errorHandler());

  // Request logger middleware (includes request ID generation)
  app.use("*", requestLogger());

  // Global rate limiting (before CORS to prevent abuse)
  app.use("*", rateLimiter({
    skip: createWhitelistSkip(),  // Skip rate limiting for localhost in development
  }));

  // Specific rate limiting for form endpoints
  app.use("/api/webflow-form", formRateLimiter);

  // CORS middleware (before routes)
  app.use("*", corsMiddleware());

  // Security headers middleware
  app.use("*", securityMiddleware());

  // Additional middleware will be added in subsequent tasks:
  // - Request validation
}

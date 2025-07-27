/// <reference lib="deno.ns" />
import type { Hono } from "@hono/hono";
import { corsMiddleware } from "./cors.ts";
import { securityMiddleware } from "./security.ts";
import { requestLogger } from "./requestLogger.ts";
import { errorHandler } from "./errorHandler.ts";

/**
 * Register all middleware in the correct order
 * Order matters: error handler -> request logger -> cors -> security -> routes
 */
export function registerMiddleware(app: Hono): void {
  // Error handler middleware (must wrap all routes)
  app.use("*", errorHandler());

  // Request logger middleware (includes request ID generation)
  app.use("*", requestLogger());

  // CORS middleware (before routes)
  app.use("*", corsMiddleware());

  // Security headers middleware
  app.use("*", securityMiddleware());

  // Additional middleware will be added in subsequent tasks:
  // - Rate limiting
  // - Request validation
}

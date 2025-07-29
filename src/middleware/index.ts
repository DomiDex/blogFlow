/// <reference lib="deno.ns" />
import type { Hono } from "@hono/hono";
import { corsMiddleware } from "./cors.ts";
import { securityMiddleware, requestValidation } from "./security.ts";
import { requestLogger } from "./requestLogger.ts";
import { errorHandler } from "./errorHandler.ts";
import { rateLimiter, formRateLimiter, createWhitelistSkip } from "./rateLimiter.ts";
import type { Variables } from "@app-types";
import { config as appConfig } from "@config/index.ts";

export interface MiddlewareConfig {
  testing?: boolean;
}

/**
 * Register all middleware in the correct order
 * Order matters: error handler -> request logger -> security -> rate limit -> validation -> cors -> routes
 */
export function registerMiddleware(
  app: Hono<{ Variables: Variables }>, 
  config?: MiddlewareConfig
): void {
  // Error handler middleware (must wrap all routes)
  app.use("*", errorHandler());

  // Request logger middleware (includes request ID generation)
  app.use("*", requestLogger());

  // Security headers middleware (early to protect all endpoints)
  app.use("*", securityMiddleware({
    enableNonce: false, // Can be enabled for stricter CSP
    enableCSP: true,
    enableHSTS: appConfig.NODE_ENV === "production",
  }));

  // Global rate limiting (before CORS to prevent abuse)
  if (!config?.testing) {
    app.use("*", rateLimiter({
      skip: appConfig.NODE_ENV === "development" ? createWhitelistSkip() : undefined,
    }));

    // Specific rate limiting for form endpoints
    app.use("/api/webflow-form", formRateLimiter);
  }

  // Request validation middleware (validate before processing)
  app.use("*", requestValidation());

  // CORS middleware (before routes)
  app.use("*", corsMiddleware());

  // Production-specific middleware
  if (appConfig.NODE_ENV === "production" && !config?.testing) {
    // Add cache headers for static assets
    app.use("/health/*", async (c, next) => {
      await next();
      c.header("Cache-Control", "public, max-age=300"); // 5 minutes
    });
  }
}

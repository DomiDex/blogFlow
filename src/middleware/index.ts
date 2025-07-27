/// <reference lib="deno.ns" />
import type { Hono } from "@hono/hono";
import { logger } from "@hono/logger";
import { corsMiddleware } from "./cors.ts";
import { securityMiddleware } from "./security.ts";

/**
 * Register all middleware in the correct order
 * Order matters: logger -> cors -> security -> routes
 */
export function registerMiddleware(app: Hono): void {
  // Request ID middleware (must be first)
  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    await next();
  });

  // Logger middleware (needs request ID)
  app.use(
    "*",
    logger((str, ...rest) => {
      // Custom logger format with request ID
      const reqId = rest[0]?.requestId || "unknown";
      console.log(`[${reqId}] ${str}`);
    }),
  );

  // CORS middleware (before routes)
  app.use("*", corsMiddleware());

  // Security headers middleware
  app.use("*", securityMiddleware());

  // Request timing middleware
  app.use("*", async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    c.header("X-Response-Time", `${duration}ms`);
  });

  // Additional middleware will be added in subsequent tasks:
  // - Rate limiting
  // - Request validation
  // - Error handling (wraps routes)
}

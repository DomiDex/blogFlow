/// <reference lib="deno.ns" />
import { Hono } from "@hono/hono";
import { config } from "@config/index.ts";
import { logger } from "@utils/logger.ts";
import { getRateLimitStats } from "@middleware/rateLimiter.ts";

export const healthRoutes = new Hono();

// Detailed health check endpoint
healthRoutes.get("/health", (c) => {
  const memoryUsage = Deno.memoryUsage();
  const requestId = c.get("requestId") as string | undefined;

  // Log health check access
  logger.debug("Health check accessed", {
    requestId,
    userAgent: c.req.header("user-agent"),
  });

  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "webflow-middleware",
    version: "1.0.0",
    environment: config.NODE_ENV,
    uptime: Math.floor(performance.now() / 1000), // seconds since start
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // MB
    },
    rateLimits: getRateLimitStats(),
  });
});

// Root endpoint with service info
healthRoutes.get("/", (c) => {
  return c.json({
    message: "Webflow Form to CMS Middleware",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      form: "/api/webflow-form",
    },
    documentation: "https://github.com/your-org/webflow-middleware",
  });
});

// Simple ping endpoint for quick checks
healthRoutes.get("/ping", (c) => {
  return c.text("pong");
});

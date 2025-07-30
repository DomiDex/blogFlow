/// <reference lib="deno.ns" />
import { Hono } from "@hono/hono";
import { config } from "@config/index.ts";
import { logger } from "@utils/logger.ts";
import { getRateLimitStats } from "@middleware/rateLimiter.ts";
import type { Variables } from "@app-types";

export const healthRoutes = new Hono<{ Variables: Variables }>();

// Detailed health check endpoint
healthRoutes.get("/health", async (c) => {
  const memoryUsage = Deno.memoryUsage();
  const requestId = c.get("requestId");
  const startTime = performance.now();

  // Log health check access
  logger.debug("Health check accessed", {
    requestId,
    userAgent: c.req.header("user-agent"),
  });

  // Check Webflow API connectivity
  let webflowStatus = "unknown";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://api.webflow.com/v2/sites", {
      method: "HEAD",
      headers: {
        "Authorization": config.WEBFLOW_API_TOKEN,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    webflowStatus = response.ok ? "connected" : "error";
  } catch (error) {
    webflowStatus = "disconnected";
    logger.warn("Webflow API health check failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const responseTime = performance.now() - startTime;

  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "webflow-middleware",
    version: Deno.env.get("VERSION") || "1.0.0",
    environment: config.NODE_ENV,
    uptime: Math.floor(performance.now() / 1000), // seconds since start
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
    },
    dependencies: {
      webflow: {
        status: webflowStatus,
        responseTime: Math.round(responseTime),
      },
    },
    rateLimits: getRateLimitStats(),
    deployment: {
      platform: "deno-deploy",
      region: Deno.env.get("DENO_REGION") || "unknown",
      deployment_id: Deno.env.get("DENO_DEPLOYMENT_ID") || "local",
    },
  });
});

// Root endpoint with service info
healthRoutes.get("/", (c) => {
  return c.json({
    message: "Webflow Form to CMS Middleware",
    version: Deno.env.get("VERSION") || "1.0.0",
    endpoints: {
      health: "/health",
      form: "/api/webflow-form",
      metrics: "/health/metrics",
      ready: "/health/ready",
    },
    documentation: "Made By DomiDex: https://github.com/DomiDex/blogFlow",
    deployment: {
      platform: "deno-deploy",
      build: Deno.env.get("GIT_COMMIT") || "development",
    },
  });
});

// Simple ping endpoint for quick checks
healthRoutes.get("/ping", (c) => {
  return c.text("pong");
});

// Readiness check for load balancers
healthRoutes.get("/health/ready", (c) => {
  const checks = {
    environment: !!config.WEBFLOW_API_TOKEN && !!config.WEBFLOW_COLLECTION_ID,
    memory: Deno.memoryUsage().heapUsed < (512 * 1024 * 1024), // Less than 512MB
  };

  const allChecksPass = Object.values(checks).every((check) => check === true);

  if (!allChecksPass) {
    return c.json({
      status: "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    }, 503);
  }

  return c.json({
    status: "ready",
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint for monitoring
healthRoutes.get("/health/metrics", (c) => {
  const memoryUsage = Deno.memoryUsage();
  const rateLimitStats = getRateLimitStats();

  // Prometheus-style metrics
  const metrics = [
    `# HELP process_heap_bytes Process heap size in bytes`,
    `# TYPE process_heap_bytes gauge`,
    `process_heap_bytes ${memoryUsage.heapUsed}`,
    ``,
    `# HELP process_memory_rss_bytes Resident set size in bytes`,
    `# TYPE process_memory_rss_bytes gauge`,
    `process_memory_rss_bytes ${memoryUsage.rss}`,
    ``,
    `# HELP http_requests_total Total number of HTTP requests`,
    `# TYPE http_requests_total counter`,
    `http_requests_total ${rateLimitStats.totalRequests || 0}`,
    ``,
    `# HELP rate_limit_active_clients Number of active rate limited clients`,
    `# TYPE rate_limit_active_clients gauge`,
    `rate_limit_active_clients ${rateLimitStats.activeClients || 0}`,
    ``,
    `# HELP uptime_seconds Service uptime in seconds`,
    `# TYPE uptime_seconds gauge`,
    `uptime_seconds ${Math.floor(performance.now() / 1000)}`,
  ].join("\n");

  return c.text(metrics, 200, {
    "Content-Type": "text/plain; version=0.0.4",
  });
});

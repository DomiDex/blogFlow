/// <reference lib="deno.ns" />
import type { Hono } from "@hono/hono";
import { healthRoutes } from "./health.ts";
import { webflowRoutes } from "./webflow.ts";
import { securityRoutes } from "./security.ts";
import type { Variables } from "@app-types";

export function registerRoutes(app: Hono<{ Variables: Variables }>): void {
  // Security routes (security.txt, CSP reporting, etc.)
  app.route("/", securityRoutes);
  
  // Health check routes at root level
  app.route("/", healthRoutes);

  // API routes for webflow form submission
  app.route("/api", webflowRoutes);

  // Global 404 handler
  app.notFound((c) => {
    return c.json(
      {
        error: "Not Found",
        message: "The requested endpoint does not exist",
        path: c.req.path,
        timestamp: new Date().toISOString(),
      },
      404,
    );
  });

  // Global error handler (will be enhanced in error handling task)
  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred",
        timestamp: new Date().toISOString(),
      },
      500,
    );
  });
}

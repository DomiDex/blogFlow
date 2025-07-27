import type { Hono } from "@hono/hono";
import { healthRoutes } from "./health.ts";
import { webflowRoutes } from "./webflow.ts";

export function registerRoutes(app: Hono): void {
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

/// <reference lib="deno.ns" />
import { Hono } from "@hono/hono";
import { compress } from "@hono/hono/compress";
import { registerRoutes } from "@routes/index.ts";
import { registerMiddleware } from "@middleware/index.ts";
import type { Variables } from "@app-types";
import { config } from "@config/index.ts";

export interface AppConfig {
  testing?: boolean;
  disableRateLimiting?: boolean;
}

/**
 * Creates and configures the Hono application
 * @param config Optional configuration for dependency injection
 * @returns Configured Hono app instance
 */
export function createApp(appConfig?: AppConfig): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  // Production optimizations
  if (config.NODE_ENV === "production" && !appConfig?.testing) {
    // Enable response compression
    app.use(
      "*",
      compress({
        encoding: "gzip",
      }),
    );
  }

  // Register middleware
  registerMiddleware(app, { testing: appConfig?.testing });

  // Register routes
  registerRoutes(app);

  return app;
}

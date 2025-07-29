/// <reference lib="deno.ns" />
import { Hono } from "@hono/hono";
import { registerRoutes } from "@routes/index.ts";
import { registerMiddleware } from "@middleware/index.ts";
import type { Variables } from "@app-types";

export interface AppConfig {
  testing?: boolean;
  disableRateLimiting?: boolean;
}

/**
 * Creates and configures the Hono application
 * @param config Optional configuration for dependency injection
 * @returns Configured Hono app instance
 */
export function createApp(config?: AppConfig): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();
  
  // Register middleware
  registerMiddleware(app, { testing: config?.testing });
  
  // Register routes
  registerRoutes(app);
  
  return app;
}
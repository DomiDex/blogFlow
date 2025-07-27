import type { Hono } from "@hono/hono";
import { cors } from "@hono/cors";
import { logger } from "@hono/logger";
import { config } from "@config/index.ts";

export function registerMiddleware(app: Hono): void {
  // Logger must be first for accurate request logging
  app.use("*", logger());

  // CORS configuration for Webflow domains
  app.use(
    "*",
    cors({
      origin: (origin) => {
        // Allow requests with no origin (like Postman or curl)
        if (!origin) return "*";

        // Check if origin matches allowed patterns
        const allowedPatterns = config.ALLOWED_ORIGINS.map((pattern) => {
          // Convert wildcard patterns to regex
          return pattern
            .replace(/\./g, "\\.")
            .replace(/\*/g, ".*");
        });

        const isAllowed = allowedPatterns.some((pattern) => {
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(origin);
        });

        return isAllowed ? origin : null;
      },
      allowMethods: ["POST", "GET", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["X-Request-Id"],
      maxAge: 86400,
      credentials: true,
    }),
  );

  // Additional middleware will be added in subsequent tasks:
  // - Request ID generation
  // - Security headers
  // - Rate limiting
  // - Error handling
}

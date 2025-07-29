/// <reference lib="deno.ns" />
import { Hono } from "@hono/hono";
import { serve } from "@std/http/server";
import { config } from "@config/index.ts";
import { registerRoutes } from "@routes/index.ts";
import { registerMiddleware } from "@middleware/index.ts";
import { logger } from "@utils/logger.ts";
import type { Variables } from "@app-types";

// Create Hono app with strict typing
const app = new Hono<{ Variables: Variables }>();

// Register global middleware (order matters!)
registerMiddleware(app);

// Register all routes
registerRoutes(app);

// Start server
const port = config.PORT;

// Log startup information
logger.info("Server starting", {
  environment: config.NODE_ENV,
  port,
  logLevel: config.LOG_LEVEL,
  corsOrigins: config.CORS_ORIGINS,
});

// Display startup banner
console.log(`
╔══════════════════════════════════════════════╗
║       Webflow Form to CMS Middleware         ║
╚══════════════════════════════════════════════╝

📍 Environment: ${config.NODE_ENV}
📊 Log Level: ${config.LOG_LEVEL}
🚀 Server: http://localhost:${port}
💚 Health: http://localhost:${port}/health
📝 API: http://localhost:${port}/api/webflow-form

🎯 Ready to process form submissions!
`);

// Use Deno's native HTTP server
// Export app for testing
export { app };

// Start server if not in test mode
if (import.meta.main) {
  await serve(app.fetch, {
    port,
    hostname: "0.0.0.0", // Bind to all interfaces for WSL compatibility
    onListen({ port, hostname }) {
      logger.info("Server ready", {
        hostname,
        port,
        url: `http://${hostname}:${port}`,
      });
    },
  });
}

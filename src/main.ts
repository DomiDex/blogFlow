/// <reference lib="deno.ns" />
import { serve } from "@std/http/server";
import { config } from "@config/index.ts";
import { logger } from "@utils/logger.ts";
import { createApp } from "@/app.ts";
import type { Variables } from "@app-types";

// Create Hono app using factory
const app = createApp();

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
export type { Variables };

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

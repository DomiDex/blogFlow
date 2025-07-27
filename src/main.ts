import { Hono } from "@hono/hono";
import { serve } from "@std/http/server";
import { config } from "@config/index.ts";
import { registerRoutes } from "@routes/index.ts";
import { registerMiddleware } from "@middleware/index.ts";

// Create Hono app with strict typing
const app = new Hono();

// Register global middleware (order matters!)
registerMiddleware(app);

// Register all routes
registerRoutes(app);

// Start server
const port = config.PORT;
console.log(`⚡ Server starting...`);
console.log(`📍 Environment: ${config.NODE_ENV}`);
console.log(`🚀 Server running on http://localhost:${port}`);
console.log(`💚 Health check: http://localhost:${port}/health`);

// Use Deno's native HTTP server
serve(app.fetch, {
  port,
  onListen() {
    console.log(`✅ Server is ready to accept connections`);
  },
});

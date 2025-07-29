#!/usr/bin/env deno run --allow-all

import { serve } from "@std/http/server.ts";
import { checkEnvironment } from "./check-env.ts";

interface PreviewOptions {
  port?: number;
  host?: string;
  open?: boolean;
}

function parseArgs(): PreviewOptions {
  const args = Deno.args;
  const port = args.find(arg => arg.startsWith("--port="))?.split("=")[1];
  const host = args.find(arg => arg.startsWith("--host="))?.split("=")[1];
  
  return {
    port: port ? parseInt(port) : 8000,
    host: host || "localhost",
    open: args.includes("--open"),
  };
}

async function loadEnvFile(): Promise<void> {
  try {
    const envContent = await Deno.readTextFile(".env.preview");
    const lines = envContent.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        if (key && value) {
          Deno.env.set(key, value);
        }
      }
    }
    
    console.log("✅ Loaded preview environment");
  } catch {
    console.log("⚠️  No .env.preview file found, using default environment");
  }
}

async function checkPreviewEnvironment(): Promise<void> {
  console.log("\n📋 Checking preview environment...");
  
  // Set preview-specific defaults
  if (!Deno.env.get("NODE_ENV")) {
    Deno.env.set("NODE_ENV", "preview");
  }
  
  if (!Deno.env.get("LOG_LEVEL")) {
    Deno.env.set("LOG_LEVEL", "debug");
  }
  
  // Run environment check
  const result = checkEnvironment();
  if (!result.valid) {
    throw new Error("Environment check failed");
  }
}

async function startPreviewServer(options: PreviewOptions): Promise<void> {
  const { port, host } = options;
  
  console.log("\n🚀 Starting preview server...");
  console.log(`📡 Server: http://${host}:${port}`);
  console.log("🔄 Hot reload: Enabled");
  console.log("🐛 Debug mode: Enabled\n");
  
  // Import and start the main application
  const { app } = await import("../src/main.ts");
  
  // Add preview-specific middleware
  app.use("*", async (c, next) => {
    console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.url}`);
    const start = performance.now();
    await next();
    const ms = (performance.now() - start).toFixed(2);
    console.log(`  └─ ${c.res.status} (${ms}ms)`);
  });
  
  // Add preview banner endpoint
  app.get("/_preview", (c) => {
    return c.json({
      mode: "preview",
      version: Deno.env.get("VERSION") || "dev",
      environment: {
        node_env: Deno.env.get("NODE_ENV"),
        log_level: Deno.env.get("LOG_LEVEL"),
        port,
        host,
      },
      features: {
        hot_reload: true,
        debug_mode: true,
        detailed_errors: true,
      },
    });
  });
  
  // Start server
  serve(app.fetch, {
    port,
    hostname: host,
    onListen() {
      console.log("✅ Preview server is running!");
      console.log("\nAvailable endpoints:");
      console.log("  GET  /_preview          - Preview server info");
      console.log("  GET  /health           - Health check");
      console.log("  POST /api/blog-posts   - Submit blog post");
      console.log("  GET  /api/blog-posts   - List blog posts");
      console.log("\nPress Ctrl+C to stop the server");
      
      if (options.open) {
        openBrowser(`http://${host}:${port}/_preview`);
      }
    },
  });
}

async function openBrowser(url: string): Promise<void> {
  const cmd = Deno.build.os === "windows" ? "start" :
              Deno.build.os === "darwin" ? "open" : "xdg-open";
  
  try {
    const process = new Deno.Command(cmd, {
      args: [url],
      stdout: "null",
      stderr: "null",
    });
    await process.output();
  } catch {
    console.log(`\n💡 Open ${url} in your browser`);
  }
}

async function watchForChanges(): Promise<void> {
  console.log("\n👁️  Watching for file changes...");
  
  const watcher = Deno.watchFs(["src/", "deno.json"], { recursive: true });
  
  for await (const event of watcher) {
    if (event.kind === "modify" || event.kind === "create") {
      console.log(`\n🔄 File changed: ${event.paths[0]}`);
      console.log("🔄 Restarting server...\n");
      
      // In a real implementation, you'd restart the server here
      // For now, we'll just log the change
    }
  }
}

// Main execution
if (import.meta.main) {
  try {
    console.log("🎭 Webflow Middleware - Preview Mode\n");
    
    const options = parseArgs();
    
    // Load preview environment
    await loadEnvFile();
    
    // Check environment
    await checkPreviewEnvironment();
    
    // Start preview server
    await startPreviewServer(options);
    
    // Watch for changes (in parallel)
    watchForChanges().catch(console.error);
    
  } catch (error) {
    console.error("\n❌ Preview server failed:", error.message);
    Deno.exit(1);
  }
}
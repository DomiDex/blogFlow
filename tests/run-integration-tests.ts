#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Integration test runner that sets up proper test environment
 */

// Set test environment variables
Deno.env.set("NODE_ENV", "test");
Deno.env.set("PORT", "0"); // Use random port
Deno.env.set("WEBFLOW_API_TOKEN", "test-token");
Deno.env.set("WEBFLOW_COLLECTION_ID", "test-collection-id");
Deno.env.set("WEBFLOW_SITE_ID", "test-site-id");
Deno.env.set("LOG_LEVEL", "error"); // Reduce noise in tests
Deno.env.set("RATE_LIMIT_WINDOW_MS", "60000");
Deno.env.set("RATE_LIMIT_MAX_REQUESTS", "100");

// Run tests
const command = new Deno.Command("deno", {
  args: [
    "test",
    "--allow-net",
    "--allow-env",
    "--allow-read",
    "--filter=integration",
    "--no-check", // Skip type checking for faster runs
    ...Deno.args, // Pass through any additional arguments
  ],
});

const { code } = await command.output();
Deno.exit(code);
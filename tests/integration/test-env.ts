/**
 * Test environment setup for integration tests
 */

// Set test environment variables before importing app
Deno.env.set("NODE_ENV", "test");
Deno.env.set("LOG_LEVEL", "error");
Deno.env.set("WEBFLOW_API_TOKEN", "test-token");
Deno.env.set("WEBFLOW_COLLECTION_ID", "test-collection-id");
Deno.env.set("WEBFLOW_SITE_ID", "test-site-id");
Deno.env.set("RATE_LIMIT_WINDOW_MS", "60000");
Deno.env.set("RATE_LIMIT_MAX_REQUESTS", "100");
Deno.env.set("CORS_ORIGINS", "http://localhost:3000,https://test.com");

// Export for use in tests
export const TEST_ENV = {
  NODE_ENV: "test",
  WEBFLOW_API_TOKEN: "test-token",
  WEBFLOW_COLLECTION_ID: "test-collection-id",
  WEBFLOW_SITE_ID: "test-site-id",
} as const;

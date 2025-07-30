/// <reference lib="deno.ns" />

/**
 * Test environment setup
 * This file configures environment variables for testing
 */

// Store original environment variables
const originalEnv = new Map<string, string | undefined>();

export function setupTestEnvironment() {
  // Save original values
  const varsToOverride = [
    "NODE_ENV",
    "LOG_LEVEL",
    "WEBFLOW_API_TOKEN",
    "WEBFLOW_COLLECTION_ID",
    "WEBFLOW_SITE_ID",
    "PORT",
    "RATE_LIMIT_WINDOW_MS",
    "RATE_LIMIT_MAX_REQUESTS",
  ];

  for (const key of varsToOverride) {
    originalEnv.set(key, Deno.env.get(key));
  }

  // Set test values
  Deno.env.set("NODE_ENV", "test");
  Deno.env.set("LOG_LEVEL", "error");
  Deno.env.set("WEBFLOW_API_TOKEN", "test-token");
  Deno.env.set("WEBFLOW_COLLECTION_ID", "test-collection-id");
  Deno.env.set("WEBFLOW_SITE_ID", "test-site-id");
  Deno.env.set("PORT", "0"); // Use random port for tests
  Deno.env.set("RATE_LIMIT_WINDOW_MS", "60000");
  Deno.env.set("RATE_LIMIT_MAX_REQUESTS", "10");
}

export function restoreTestEnvironment() {
  // Restore original values
  for (const [key, value] of originalEnv) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
  originalEnv.clear();
}

/**
 * Test environment configuration
 */
export const testEnv = {
  NODE_ENV: "test",
  LOG_LEVEL: "error",
  WEBFLOW_API_TOKEN: "test-token",
  WEBFLOW_COLLECTION_ID: "test-collection-id",
  WEBFLOW_SITE_ID: "test-site-id",
  PORT: 0,
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX_REQUESTS: 10,
};

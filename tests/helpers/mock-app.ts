/// <reference lib="deno.ns" />
import { createApp } from "@/app.ts";
import { Hono } from "@hono/hono";
import type { Variables } from "@app-types";
import { setupTestEnvironment } from "./test-env.ts";

/**
 * Creates a test app instance with mocked dependencies
 * This allows integration tests to run without external dependencies
 */
export function createTestApp(): Hono<{ Variables: Variables }> {
  // Create app with test configuration
  // Note: Test environment should be set up before importing this module
  const app = createApp({
    testing: true,
    disableRateLimiting: false, // Can test rate limiting if needed
  });

  return app;
}

/**
 * Setup integration test environment
 * Returns app instance and helper functions
 */
export function setupIntegrationTest() {
  const app = createTestApp();

  // Helper to make requests
  const request = async (
    path: string,
    options?: RequestInit,
  ): Promise<Response> => {
    return app.request(path, options);
  };

  // Helper to make authenticated requests
  const authenticatedRequest = async (
    path: string,
    options?: RequestInit,
  ): Promise<Response> => {
    const headers = new Headers(options?.headers);
    headers.set("Authorization", "Bearer test-token");

    return app.request(path, {
      ...options,
      headers,
    });
  };

  return {
    app,
    request,
    authenticatedRequest,
  };
}

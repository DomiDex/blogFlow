/// <reference lib="deno.ns" />

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

// Set test environment BEFORE any app imports
Deno.env.set("NODE_ENV", "test");
Deno.env.set("LOG_LEVEL", "error");
Deno.env.set("WEBFLOW_API_TOKEN", "test-token");
Deno.env.set("WEBFLOW_COLLECTION_ID", "test-collection-id");
Deno.env.set("WEBFLOW_SITE_ID", "test-site-id");

// Now import the app
import { createApp } from "@/app.ts";

describe("Simple Mock Test", () => {
  it("should create app and handle health check", async () => {
    const app = createApp({ testing: true });

    const response = await app.request("/health");

    assertEquals(response.status, 200);

    const result = await response.json();
    assertEquals(result.status, "healthy");
  });

  it("should reject unauthorized requests", async () => {
    const app = createApp({ testing: true });

    const response = await app.request("/api/webflow-form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "data" }),
    });

    assertEquals(response.status, 401);
  });
});

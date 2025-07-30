/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { setupIntegrationTest } from "../helpers/mock-app.ts";
import { assertAsyncThrows, createMockFetch, createMockResponse } from "../helpers/test-utils.ts";
import * as fixtures from "../fixtures/quill-delta.ts";
import * as webflowFixtures from "../fixtures/webflow-responses.ts";
import { WebflowService } from "@services/webflowService.ts";
import type { FormData } from "@/types/form.ts";

describe("Webflow API Integration Tests", () => {
  let originalFetch: typeof fetch;
  let mockResponses: Map<string, Response>;
  let requestLog: Array<{ url: string; method: string; body?: any }>;
  const { app } = setupIntegrationTest();

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockResponses = new Map();
    requestLog = [];

    // Create a custom fetch that logs requests
    globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
      const method = init?.method || "GET";
      let body;

      if (init?.body) {
        try {
          body = JSON.parse(init.body.toString());
        } catch {
          body = init.body;
        }
      }

      requestLog.push({ url, method, body });

      const mockFetch = createMockFetch(mockResponses);
      return mockFetch(input, init);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("API Error Handling", () => {
    it("should handle 400 validation errors from Webflow", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // Mock validation error response
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.WEBFLOW_ERROR_RESPONSE, { status: 400 }),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Test Article",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 400);

      const error = await response.json();
      assertExists(error.error);
      assertExists(error.details);
    });

    it("should handle 401 authentication errors", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // Mock auth error response
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.AUTH_ERROR_RESPONSE, { status: 401 }),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Test Article",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer invalid-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 401);

      const error = await response.json();
      assertEquals(error.error, "Authentication failed");
    });

    it("should handle 404 collection not found errors", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // Mock not found response
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.NOT_FOUND_ERROR_RESPONSE, { status: 404 }),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Test Article",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 404);

      const error = await response.json();
      assertExists(error.error);
    });

    it("should handle 500 server errors from Webflow", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // Mock server error response
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.SERVER_ERROR_RESPONSE, { status: 500 }),
      );

      // Mock successful slug check
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Test Article",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 502);

      const error = await response.json();
      assertEquals(error.error, "External service error");
    });
  });

  describe("Rate Limiting", () => {
    it("should handle rate limit errors with retry after", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // Mock rate limit response with retry-after header
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        new Response(
          JSON.stringify(webflowFixtures.RATE_LIMIT_ERROR_RESPONSE),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
              "X-RateLimit-Limit": "60",
              "X-RateLimit-Remaining": "0",
            },
          },
        ),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Rate Limited Article",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 429);

      const error = await response.json();
      assertEquals(error.error, "Rate limit exceeded");
      assertExists(response.headers.get("Retry-After"));
    });
  });

  describe("Retry Logic", () => {
    it("should retry on network errors", async () => {
      const baseUrl = "https://api.webflow.com/v2";
      let attemptCount = 0;

      // Override fetch to simulate network error then success
      globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;
        attemptCount++;

        if (attemptCount === 1 && url.includes("/items?limit=100")) {
          // First attempt fails with network error
          throw new TypeError("Network request failed");
        }

        // Subsequent attempts succeed
        const mockFetch = createMockFetch(mockResponses);
        return mockFetch(input, init);
      };

      // Setup successful responses
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE),
      );

      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Network Retry Test",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      // Should succeed after retry
      assertEquals(response.status, 201);
      // Should have made more than one attempt
      assertEquals(attemptCount > 1, true);
    });

    it("should not retry on client errors", async () => {
      const baseUrl = "https://api.webflow.com/v2";
      let attemptCount = 0;

      // Count fetch attempts
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        attemptCount++;
        return originalFetch(input, init);
      };

      // Mock 400 error
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.WEBFLOW_ERROR_RESPONSE, { status: 400 }),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "No Retry Test",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 400);
      // Should not retry on 400 errors
      assertEquals(attemptCount, 1);
    });
  });

  describe("Network Timeouts", () => {
    it("should handle request timeouts", async () => {
      // Create a delayed response that will timeout
      globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

        if (url.includes("/items")) {
          // Simulate a very slow response
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }

        const mockFetch = createMockFetch(mockResponses);
        return mockFetch(input, init);
      };

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Timeout Test",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      // Use a shorter timeout for testing
      const service = new WebflowService({
        apiToken: "test-token",
        siteId: "test-site",
        collectionId: "test-collection",
        timeout: 100, // 100ms timeout
      });

      try {
        await service.checkSlugExists("test-slug");
        throw new Error("Expected timeout error");
      } catch (error) {
        assertEquals((error as Error).message, "Request timeout");
      }
    });
  });

  describe("Request Headers", () => {
    it("should send correct headers to Webflow API", async () => {
      const baseUrl = "https://api.webflow.com/v2";
      let capturedHeaders: Headers | undefined;

      // Capture request headers
      globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        if (init?.headers) {
          capturedHeaders = new Headers(init.headers);
        }

        const mockFetch = createMockFetch(mockResponses);
        return mockFetch(input, init);
      };

      // Setup mock responses
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE),
      );

      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Headers Test",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertExists(capturedHeaders);
      assertEquals(capturedHeaders.get("authorization"), "Bearer test-token");
      assertEquals(capturedHeaders.get("content-type"), "application/json");
      assertEquals(capturedHeaders.get("accept-version"), "1.0.0");
    });
  });

  describe("Slug Uniqueness", () => {
    it("should generate unique slug when original exists", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // First call returns existing slug
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse({
          items: [
            { id: "existing", fieldData: { slug: "test-article", name: "Existing" } },
          ],
          pagination: { limit: 100, offset: 0, total: 1 },
        }),
      );

      // Second call with numbered slug returns empty
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100&slug=test-article-2`,
        createMockResponse({
          items: [],
          pagination: { limit: 100, offset: 0, total: 0 },
        }),
      );

      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Test Article", // Same title as existing
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 201);

      const result = await response.json();
      // Should have generated unique slug
      assertEquals(result.slug, "test-article-2");
    });
  });

  describe("Publishing Flow", () => {
    it("should publish item when publishNow is true", async () => {
      const baseUrl = "https://api.webflow.com/v2";
      const itemId = webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE.id;

      // Setup mock responses
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE),
      );

      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
      );

      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items/${itemId}/publish`,
        createMockResponse(webflowFixtures.PUBLISH_ITEM_SUCCESS_RESPONSE),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Published Article",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: true,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 201);

      const result = await response.json();
      assertEquals(result.status, "published");
      assertExists(result.publishedAt);

      // Verify publish endpoint was called
      const publishCall = requestLog.find((req) => req.url.includes(`/items/${itemId}/publish`));
      assertExists(publishCall);
      assertEquals(publishCall.method, "PUT");
    });

    it("should not publish when publishNow is false", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // Setup mock responses
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE),
      );

      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Draft Article",
        metaDescription:
          "This is a comprehensive test description with enough characters to pass validation requirements",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 201);

      const result = await response.json();
      assertEquals(result.status, "draft");
      assertEquals(result.publishedAt, undefined);

      // Verify publish endpoint was NOT called
      const publishCall = requestLog.find((req) => req.url.includes("/publish"));
      assertEquals(publishCall, undefined);
    });
  });
});

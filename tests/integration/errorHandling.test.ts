/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { setupIntegrationTest } from "../helpers/mock-app.ts";
import { assertAsyncThrows, createMockFetch, createMockResponse } from "../helpers/test-utils.ts";
import * as fixtures from "../fixtures/quill-delta.ts";
import * as webflowFixtures from "../fixtures/webflow-responses.ts";
import type { FormData } from "@/types/form.ts";

describe("Error Handling Integration Tests", () => {
  let originalFetch: typeof fetch;
  let mockResponses: Map<string, Response>;
  let errorLogs: Array<{ level: string; message: string; error?: any }>;
  const { app } = setupIntegrationTest();

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockResponses = new Map();
    globalThis.fetch = createMockFetch(mockResponses);
    errorLogs = [];

    // Intercept console errors for verification
    const originalError = console.error;
    console.error = (...args: any[]) => {
      errorLogs.push({ level: "error", message: args[0], error: args[1] });
      originalError(...args);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.error = console.error;
  });

  describe("Network Error Handling", () => {
    it("should handle complete network failure gracefully", async () => {
      // Simulate network failure
      globalThis.fetch = async (): Promise<Response> => {
        throw new TypeError("Failed to fetch");
      };

      const formData: FormData = {
        authorName: "Network Test",
        articleTitle: "Network Failure Test",
        metaDescription:
          "Testing network failure handling to ensure proper error responses when external services fail",
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

      assertEquals(response.status, 503);

      const error = await response.json();
      assertEquals(error.error, "Service temporarily unavailable");
      assertExists(error.message);
    });

    it("should handle DNS resolution failures", async () => {
      globalThis.fetch = async () => {
        throw new TypeError("getaddrinfo ENOTFOUND api.webflow.com");
      };

      const formData: FormData = {
        authorName: "DNS Test",
        articleTitle: "DNS Failure Test",
        metaDescription:
          "Testing DNS resolution failure to verify graceful handling of infrastructure issues",
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

      assertEquals(response.status, 503);

      const error = await response.json();
      assertExists(error.error);
    });

    it("should handle connection timeout", async () => {
      let attemptCount = 0;
      globalThis.fetch = async (): Promise<Response> => {
        attemptCount++;
        // Simulate timeout
        await new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), 100);
        });
        throw new Error("Request timeout"); // This line will never be reached but satisfies TypeScript
      };

      const formData: FormData = {
        authorName: "Timeout Test",
        articleTitle: "Connection Timeout Test",
        metaDescription:
          "Testing connection timeout handling to ensure requests fail gracefully when services are slow",
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

      assertEquals(response.status, 504);
      // Should have attempted retries
      assertEquals(attemptCount > 1, true);
    });
  });

  describe("API Error Recovery", () => {
    it("should handle intermittent API failures with retry", async () => {
      const baseUrl = "https://api.webflow.com/v2";
      let attemptCount = 0;

      globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;
        attemptCount++;

        // Fail first 2 attempts, succeed on 3rd
        if (attemptCount < 3 && url.includes("/items?limit=100")) {
          throw new Error("Temporary failure");
        }

        const mockFetch = createMockFetch(mockResponses);
        return mockFetch(input, init);
      };

      // Setup successful response for 3rd attempt
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE),
      );

      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
      );

      const formData: FormData = {
        authorName: "Retry Test",
        articleTitle: "Intermittent Failure Recovery",
        metaDescription:
          "Testing recovery from intermittent failures to validate retry logic and resilience mechanisms",
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

      // Should eventually succeed
      assertEquals(response.status, 201);
      assertEquals(attemptCount, 3);
    });

    it("should handle partial success scenarios", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // Item creation succeeds
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE),
      );

      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
      );

      // But publishing fails
      const itemId = webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE.id;
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items/${itemId}/publish`,
        createMockResponse(
          { error: "PublishError", message: "Unable to publish at this time" },
          { status: 500 },
        ),
      );

      const formData: FormData = {
        authorName: "Partial Success",
        articleTitle: "Article with Publishing Failure",
        metaDescription:
          "Testing partial success scenario when some API operations succeed while others fail",
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

      // Should return success but indicate draft status
      assertEquals(response.status, 201);

      const result = await response.json();
      assertEquals(result.status, "draft");
      assertExists(result.warning);
      assertEquals(result.warning.includes("publish"), true);
    });
  });

  describe("Validation Error Details", () => {
    it("should provide detailed validation errors for invalid content", async () => {
      const invalidData = {
        authorName: "", // Empty
        articleTitle: "a", // Too short
        metaDescription:
          "Testing validation with empty meta description to check field requirement handling", // Empty
        articleContent: { ops: [] }, // Empty content
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(invalidData),
      });

      assertEquals(response.status, 400);

      const error = await response.json();
      assertEquals(error.error, "Validation failed");
      assertExists(error.fields);

      // Should have errors for all invalid fields
      assertExists(error.fields.authorName);
      assertExists(error.fields.articleTitle);
      assertExists(error.fields.articleContent);
    });

    it("should validate content structure deeply", async () => {
      const malformedContent = {
        authorName: "Test Author",
        articleTitle: "Test Article",
        metaDescription:
          "Test description for validating content processing with minimal metadata provided",
        articleContent: {
          ops: [
            { insert: "Valid text" },
            { insert: null }, // Invalid null insert
            { insert: 123 }, // Invalid number insert
            { attributes: { bold: true } }, // Missing insert
            { insert: "More text", attributes: { invalid: true } }, // Invalid attribute
          ],
        },
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(malformedContent),
      });

      assertEquals(response.status, 400);

      const error = await response.json();
      assertExists(error.fields);
      assertExists(error.fields.articleContent);
    });
  });

  describe("Concurrent Error Scenarios", () => {
    it("should handle multiple simultaneous failures", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // All requests fail with different errors
      globalThis.fetch = async (input: string | Request | URL) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

        if (url.includes("/items?limit=100")) {
          throw new Error("Connection reset");
        } else if (url.includes("/items")) {
          return createMockResponse(
            { error: "ServerError", message: "Internal server error" },
            { status: 500 },
          );
        }

        throw new Error("Unknown error");
      };

      const submissions = [];
      for (let i = 0; i < 3; i++) {
        const formData: FormData = {
          authorName: `Concurrent Error ${i}`,
          articleTitle: `Concurrent Error Article ${i}`,
          metaDescription: `Testing concurrent error ${i}`,
          articleContent: fixtures.SIMPLE_DELTA,
          publishNow: false,
        };

        submissions.push(
          app.request("/api/webflow-form", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer test-token",
            },
            body: JSON.stringify(formData),
          }),
        );
      }

      const responses = await Promise.all(submissions);

      // All should fail gracefully
      responses.forEach((response: Response) => {
        assertEquals(response.status >= 500, true);
      });
    });
  });

  describe("Error Message Sanitization", () => {
    it("should sanitize sensitive information from error responses", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // Mock error with sensitive info
      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items?limit=100`,
        createMockResponse(
          {
            error: "DatabaseError",
            message: "Connection to mongodb://user:password@host:27017/db failed",
            stack:
              "Error: Connection failed\n    at internal/db.js:123\n    at /app/secret/path/file.js:456",
          },
          { status: 500 },
        ),
      );

      const formData: FormData = {
        authorName: "Security Test",
        articleTitle: "Testing Error Sanitization",
        metaDescription:
          "Ensuring no sensitive data leaks in error responses to maintain security best practices",
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
      // Should not contain sensitive information
      assertEquals(error.message?.includes("password"), false);
      assertEquals(error.message?.includes("mongodb://"), false);
      assertEquals(error.stack, undefined);
    });
  });

  describe("Recovery Mechanisms", () => {
    it("should implement circuit breaker pattern", async () => {
      let failureCount = 0;
      const baseUrl = "https://api.webflow.com/v2";

      globalThis.fetch = async (input: string | Request | URL) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

        if (url.includes("/items")) {
          failureCount++;
          throw new Error("Service unavailable");
        }

        return createMockResponse({});
      };

      // Make multiple failing requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        const formData: FormData = {
          authorName: `Circuit Test ${i}`,
          articleTitle: `Circuit Breaker Test ${i}`,
          metaDescription:
            "Testing circuit breaker pattern implementation to prevent cascading failures in the system",
          articleContent: fixtures.SIMPLE_DELTA,
          publishNow: false,
        };

        requests.push(
          app.request("/api/webflow-form", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer test-token",
            },
            body: JSON.stringify(formData),
          }),
        );
      }

      const responses = await Promise.all(requests);

      // After several failures, circuit should open
      const lastResponses = responses.slice(-2);
      lastResponses.forEach((response: Response) => {
        // Should fail fast without attempting request
        assertEquals(response.status, 503);
      });

      // Failure count should be less than total requests (circuit opened)
      assertEquals(failureCount < 5, true);
    });

    it("should gracefully degrade functionality", async () => {
      const baseUrl = "https://api.webflow.com/v2";

      // Slug checking fails, but creation succeeds
      let slugCheckAttempts = 0;
      globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

        if (url.includes("/items?limit=100")) {
          slugCheckAttempts++;
          throw new Error("Slug service unavailable");
        }

        const mockFetch = createMockFetch(mockResponses);
        return mockFetch(input, init);
      };

      mockResponses.set(
        `${baseUrl}/collections/test-collection-id/items`,
        createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
      );

      const formData: FormData = {
        authorName: "Degraded Service",
        articleTitle: "Testing Graceful Degradation",
        metaDescription:
          "Article created despite slug service failure to test graceful degradation of non-critical services",
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

      // Should succeed despite slug check failure
      assertEquals(response.status, 201);

      const result = await response.json();
      assertExists(result.itemId);
      // May have generated slug with timestamp to ensure uniqueness
      assertExists(result.slug);
    });
  });

  describe("Error Logging and Monitoring", () => {
    it("should log errors with appropriate context", async () => {
      globalThis.fetch = async () => {
        const error = new Error("Test error for logging");
        (error as any).code = "TEST_ERROR";
        throw error;
      };

      const formData: FormData = {
        authorName: "Log Test",
        articleTitle: "Error Logging Test",
        metaDescription:
          "Testing error logging to ensure all errors are properly captured and logged for debugging",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Request-ID": "test-request-123",
        },
        body: JSON.stringify(formData),
      });

      // Verify error was logged
      assertEquals(errorLogs.length > 0, true);
      const loggedError = errorLogs.find((log) => log.message.includes("error"));
      assertExists(loggedError);
    });
  });
});

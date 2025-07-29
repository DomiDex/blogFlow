/// <reference lib="deno.ns" />

// Setup test environment BEFORE any imports
import { setupTestEnvironment, restoreTestEnvironment } from "../helpers/test-env.ts";
setupTestEnvironment();

import { assertEquals, assertExists } from "@std/assert";
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { setupIntegrationTest } from "../helpers/mock-app.ts";
import { createMockFetch, createMockResponse } from "../helpers/test-utils.ts";
import * as fixtures from "../fixtures/quill-delta.ts";
import * as webflowFixtures from "../fixtures/webflow-responses.ts";
import type { FormData } from "@/types/form.ts";

describe("Form Submission Integration Tests (Mocked)", () => {
  let app: ReturnType<typeof setupIntegrationTest>["app"];
  let request: ReturnType<typeof setupIntegrationTest>["request"];
  let authenticatedRequest: ReturnType<typeof setupIntegrationTest>["authenticatedRequest"];
  let originalFetch: typeof fetch;
  let mockResponses: Map<string, Response>;
  
  beforeEach(() => {
    // Setup test app
    const testSetup = setupIntegrationTest();
    app = testSetup.app;
    request = testSetup.request;
    authenticatedRequest = testSetup.authenticatedRequest;
    
    // Mock external fetch calls (Webflow API)
    originalFetch = globalThis.fetch;
    mockResponses = new Map();
    globalThis.fetch = createMockFetch(mockResponses);
    
    // Setup default mock responses
    const baseUrl = "https://api.webflow.com/v2";
    
    // Mock collection list response (for slug checking)
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items?limit=100`,
      createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE)
    );
    
    // Mock item creation response
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items`,
      createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 })
    );
    
    // Mock item publish response
    const itemId = webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE.id;
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items/${itemId}/publish`,
      createMockResponse(webflowFixtures.PUBLISH_ITEM_SUCCESS_RESPONSE)
    );
  });
  
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("Valid Form Submission", () => {
    it("should successfully process a complete form submission", async () => {
      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "My Test Article About Deno Development",
        metaDescription: "This is a comprehensive test article about Deno development with sufficient content",
        articleContent: fixtures.COMPLEX_DELTA,
        publishNow: true
      };

      const response = await authenticatedRequest("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData)
      });

      assertEquals(response.status, 201);
      
      const result = await response.json();
      assertExists(result.itemId);
      assertEquals(result.status, "published");
      assertEquals(result.slug, "my-test-article-about-deno-development");
      assertExists(result.publishedAt);
    });

    it("should process form submission with minimal required fields", async () => {
      const formData = {
        authorName: "Jane Smith",
        articleTitle: "Minimal Article With Just Required Fields",
        metaDescription: "A minimal article description that meets the minimum requirements",
        articleContent: {
          ops: [
            { insert: "This is a minimal article with just enough content to pass validation. " },
            { insert: "It contains multiple sentences to ensure we meet the word count requirement. " },
            { insert: "The content is simple but valid for testing purposes." }
          ]
        }
      };

      const response = await authenticatedRequest("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData)
      });

      assertEquals(response.status, 201);
      
      const result = await response.json();
      assertExists(result.itemId);
      assertEquals(result.status, "draft"); // Default when publishNow is not specified
      assertEquals(result.slug, "minimal-article-with-just-required-fields");
    });

    it("should handle draft mode correctly", async () => {
      const formData: FormData = {
        authorName: "Draft Author",
        articleTitle: "Draft Article That Should Not Be Published",
        metaDescription: "This article should remain in draft status after creation",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      const response = await authenticatedRequest("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData)
      });

      assertEquals(response.status, 201);
      
      const result = await response.json();
      assertEquals(result.status, "draft");
      assertEquals(result.publishedAt, undefined);
    });
  });

  describe("Invalid Form Submissions", () => {
    it("should reject submission with missing required fields", async () => {
      const incompleteData = {
        authorName: "John Doe",
        // missing articleTitle
        metaDescription: "Description",
        articleContent: fixtures.SIMPLE_DELTA
      };

      const response = await authenticatedRequest("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(incompleteData)
      });

      assertEquals(response.status, 400);
      
      const error = await response.json();
      assertEquals(error.error, "Validation failed");
      assertExists(error.fields);
      assertExists(error.fields.articleTitle);
    });

    it("should reject submission with content too short", async () => {
      const shortContentData = {
        authorName: "John Doe",
        articleTitle: "Short Article",
        metaDescription: "Article with content that is too short to meet requirements",
        articleContent: {
          ops: [{ insert: "Too short." }]
        }
      };

      const response = await authenticatedRequest("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shortContentData)
      });

      assertEquals(response.status, 400);
      
      const error = await response.json();
      assertExists(error.fields);
    });
  });

  describe("Authorization", () => {
    it("should reject requests without authorization header", async () => {
      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Unauthorized Article",
        metaDescription: "This should fail due to missing auth header in the request",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      const response = await request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
          // Missing Authorization header
        },
        body: JSON.stringify(formData)
      });

      assertEquals(response.status, 401);
    });
  });

  describe("Webflow API Error Handling", () => {
    it("should handle Webflow API errors gracefully", async () => {
      // Mock Webflow API error
      mockResponses.set(
        "https://api.webflow.com/v2/collections/test-collection-id/items",
        createMockResponse({ error: "Invalid request" }, { status: 400 })
      );

      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Article That Will Fail",
        metaDescription: "This submission will fail due to Webflow API error response",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      const response = await authenticatedRequest("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData)
      });

      assertEquals(response.status, 502);
      
      const error = await response.json();
      assertEquals(error.error, "Failed to create CMS item");
    });
  });
});

// Cleanup after all tests
globalThis.addEventListener("unload", () => {
  restoreTestEnvironment();
});
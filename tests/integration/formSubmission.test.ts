/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { setupIntegrationTest } from "../helpers/mock-app.ts";
import { createMockFetch, createMockResponse, waitForPromises } from "../helpers/test-utils.ts";
import * as fixtures from "../fixtures/quill-delta.ts";
import * as webflowFixtures from "../fixtures/webflow-responses.ts";
import type { FormData } from "@/types/form.ts";

describe("Form Submission Integration Tests", () => {
  let originalFetch: typeof fetch;
  let mockResponses: Map<string, Response>;
  const { app } = setupIntegrationTest();

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockResponses = new Map();
    globalThis.fetch = createMockFetch(mockResponses);

    // Setup default mock responses
    const baseUrl = "https://api.webflow.com/v2";

    // Mock collection list response
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items?limit=100`,
      createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE),
    );

    // Mock item creation response
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items`,
      createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
    );

    // Mock item publish response
    const itemId = webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE.id;
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items/${itemId}/publish`,
      createMockResponse(webflowFixtures.PUBLISH_ITEM_SUCCESS_RESPONSE),
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
        metaDescription:
          "This is a comprehensive test article about Deno development with sufficient content",
        articleContent: fixtures.COMPLEX_DELTA,
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
            {
              insert:
                "It contains multiple sentences to ensure we meet the word count requirement. ",
            },
            { insert: "The content is simple but valid for testing purposes." },
          ],
        },
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
      assertExists(result.itemId);
      assertEquals(result.status, "draft");
      assertEquals(result.slug, "minimal-article-with-just-required-fields");
    });

    it("should handle draft mode correctly", async () => {
      const formData: FormData = {
        authorName: "Draft Author",
        articleTitle: "Draft Article That Should Not Be Published",
        metaDescription: "This article should remain in draft status after creation",
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
    });
  });

  describe("Invalid Form Submissions", () => {
    it("should reject submission with missing required fields", async () => {
      const incompleteData = {
        authorName: "John Doe",
        // missing articleTitle
        metaDescription:
          "This is a test article to validate missing field behavior in the form submission process",
        articleContent: fixtures.SIMPLE_DELTA,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(incompleteData),
      });

      assertEquals(response.status, 400);

      const error = await response.json();
      assertEquals(error.error, "Validation failed");
      assertExists(error.fields);
      assertExists(error.fields.articleTitle);
    });

    it("should reject submission with invalid Quill delta", async () => {
      const invalidData = {
        authorName: "John Doe",
        articleTitle: "Invalid Content Article",
        metaDescription:
          "Article with invalid content structure to test validation error handling and response formatting",
        articleContent: {
          ops: "not an array", // Invalid structure
        },
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
      assertExists(error.fields.articleContent);
    });

    it("should reject submission with content too short", async () => {
      const shortContentData = {
        authorName: "John Doe",
        articleTitle: "Short Article",
        metaDescription:
          "Article with content that is too short to test minimum word count validation requirements",
        articleContent: {
          ops: [{ insert: "Too short." }],
        },
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(shortContentData),
      });

      assertEquals(response.status, 400);

      const error = await response.json();
      assertExists(error.fields);
    });
  });

  describe("Large Content Handling", () => {
    it("should handle large article content", async () => {
      // Create large content
      const largeOps = [];
      for (let i = 0; i < 100; i++) {
        largeOps.push({
          insert: `This is paragraph ${
            i + 1
          } with substantial content to test large article handling. `,
        });
      }

      const largeContentData: FormData = {
        authorName: "Large Content Author",
        articleTitle: "Very Large Article With Extensive Content",
        metaDescription: "This article contains a large amount of content to test system limits",
        articleContent: { ops: largeOps },
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(largeContentData),
      });

      assertEquals(response.status, 201);

      const result = await response.json();
      assertExists(result.readingTime);
      // Should have a significant reading time
      const readingMinutes = parseInt(result.readingTime.split(" ")[0]);
      assertEquals(readingMinutes > 5, true);
    });
  });

  describe("Content Type Handling", () => {
    it("should handle form-encoded submissions", async () => {
      const formData = new URLSearchParams({
        authorName: "Form Author",
        articleTitle: "Form Encoded Article",
        metaDescription:
          "Article submitted via form encoding to test different content-type handling in the API",
        articleContent: JSON.stringify(fixtures.SIMPLE_DELTA),
      });

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": "Bearer test-token",
        },
        body: formData.toString(),
      });

      // Should reject non-JSON content type
      assertEquals(response.status, 400);
    });

    it("should reject invalid JSON", async () => {
      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: "{ invalid json",
      });

      assertEquals(response.status, 400);

      const error = await response.json();
      assertEquals(error.error, "Invalid JSON");
    });
  });

  describe("Authorization", () => {
    it("should reject requests without authorization header", async () => {
      const formData: FormData = {
        authorName: "John Doe",
        articleTitle: "Unauthorized Article",
        metaDescription:
          "This should fail due to missing auth to test authentication requirement enforcement",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Missing Authorization header
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 401);
    });
  });

  describe("Concurrent Submissions", () => {
    it("should handle multiple concurrent submissions", async () => {
      const submissions = [];

      for (let i = 0; i < 5; i++) {
        const formData: FormData = {
          authorName: `Author ${i}`,
          articleTitle: `Concurrent Article ${i}`,
          metaDescription: `Description for concurrent article ${i}`,
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

      // All should succeed
      responses.forEach((response, index) => {
        assertEquals(response.status, 201, `Request ${index} failed`);
      });

      // Verify each has unique slug
      const slugs = await Promise.all(
        responses.map(async (r) => (await r.json()).slug),
      );

      const uniqueSlugs = new Set(slugs);
      assertEquals(uniqueSlugs.size, slugs.length);
    });
  });

  describe("Special Characters and Unicode", () => {
    it("should handle special characters in content", async () => {
      const formData: FormData = {
        authorName: "Émilie Müller",
        articleTitle: "Café & Résumé: A Guide to Naïve Approaches",
        metaDescription: "Article with special characters like é, ü, ñ, and emojis 🎉",
        articleContent: {
          ops: [
            { insert: "This article contains special characters: " },
            { insert: "café, naïve, résumé, piñata, Zürich" },
            { insert: "\n\nAnd some emojis: =� <� d <" },
            { insert: "\n\nAnd various quotes: \"curly\" 'single' «guillemets»" },
          ],
        },
        publishNow: false,
      };

      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      assertEquals(response.status, 201);

      const result = await response.json();
      // Slug should be properly normalized
      assertEquals(result.slug, "cafe-resume-a-guide-to-naive-approaches");
    });
  });
});

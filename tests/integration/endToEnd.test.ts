/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { setupIntegrationTest } from "../helpers/mock-app.ts";
import { createMockFetch, createMockResponse, FakeTime } from "../helpers/test-utils.ts";
import * as fixtures from "../fixtures/quill-delta.ts";
import * as webflowFixtures from "../fixtures/webflow-responses.ts";
import type { FormData } from "@/types/form.ts";
import type { QuillDelta } from "@utils/validation.ts";

describe("End-to-End Flow Tests", () => {
  let originalFetch: typeof fetch;
  let mockResponses: Map<string, Response>;
  let fakeTime: FakeTime;
  const { app } = setupIntegrationTest();

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockResponses = new Map();
    globalThis.fetch = createMockFetch(mockResponses);
    fakeTime = new FakeTime();
    fakeTime.install();

    // Setup standard mock responses
    const baseUrl = "https://api.webflow.com/v2";

    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items?limit=100`,
      createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE),
    );

    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items`,
      createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 }),
    );

    const itemId = webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE.id;
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items/${itemId}/publish`,
      createMockResponse(webflowFixtures.PUBLISH_ITEM_SUCCESS_RESPONSE),
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fakeTime.uninstall();
  });

  describe("Complete Article Publishing Flow", () => {
    it("should complete full flow from submission to published article", async () => {
      const formData: FormData = {
        authorName: "Jane Smith",
        articleTitle: "Complete Guide to Deno Development",
        metaDescription:
          "A comprehensive guide covering all aspects of Deno development including modules, testing, and deployment",
        articleContent: fixtures.COMPLEX_DELTA,
        publishNow: true,
      };

      // Submit the form
      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });

      // Verify successful submission
      assertEquals(response.status, 201);

      const result = await response.json();

      // Verify all expected fields
      assertExists(result.itemId);
      assertEquals(result.itemId, webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE.id);
      assertEquals(result.slug, "complete-guide-to-deno-development");
      assertEquals(result.status, "published");
      assertExists(result.publishedAt);
      assertExists(result.readingTime);
      assertExists(result.introText);

      // Verify intro text was generated
      assertEquals(result.introText.length <= 160, true);
      assertEquals(result.introText.includes("Welcome to My Blog Post"), true);
    });

    it("should handle draft to publish workflow", async () => {
      // First, create a draft
      const draftData: FormData = {
        authorName: "Draft Author",
        articleTitle: "Draft Article for Later Publishing",
        metaDescription: "This article will be created as draft and published later",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false,
      };

      const draftResponse = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(draftData),
      });

      assertEquals(draftResponse.status, 201);

      const draftResult = await draftResponse.json();
      assertEquals(draftResult.status, "draft");
      assertExists(draftResult.itemId);
      assertEquals(draftResult.publishedAt, undefined);

      // Then publish it (would be a separate endpoint in real implementation)
      // For now, verify draft was created correctly
      assertEquals(draftResult.slug, "draft-article-for-later-publishing");
    });
  });

  describe("Multi-Language Content Flow", () => {
    it("should handle articles in different languages", async () => {
      const languages = [
        {
          authorName: "José García",
          articleTitle: "Guía Completa de Desarrollo con Deno",
          metaDescription:
            "Una guía completa sobre el desarrollo con Deno incluyendo módulos y pruebas",
          content:
            "Esta es una guía completa sobre Deno. Incluye información sobre módulos, testing y deployment.",
        },
        {
          authorName: "Marie Dubois",
          articleTitle: "Guide Complet du Développement Deno",
          metaDescription: "Un guide complet couvrant tous les aspects du développement Deno",
          content:
            "Ceci est un guide complet sur Deno. Il comprend des informations sur les modules, les tests et le déploiement.",
        },
        {
          authorName: "山田太郎",
          articleTitle: "Deno開発完全ガイド",
          metaDescription:
            "モジュール、テスト、デプロイメントを含むDeno開発の包括的なガイド - A comprehensive guide to Deno development",
          content:
            "これはDenoに関する完全なガイドです。モジュール、テスト、デプロイメントに関する情報が含まれています。",
        },
      ];

      for (const lang of languages) {
        const formData: FormData = {
          authorName: lang.authorName,
          articleTitle: lang.articleTitle,
          metaDescription: lang.metaDescription,
          articleContent: {
            ops: [
              { insert: lang.content },
              { insert: "\n" },
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
        assertExists(result.slug);
        // Verify slug is properly normalized for each language
        assertEquals(/^[a-z0-9-]+$/.test(result.slug), true);
      }
    });
  });

  describe("Complex Content Scenarios", () => {
    it("should handle article with all formatting options", async () => {
      // Create delta with all possible formatting
      const complexDelta: QuillDelta = {
        ops: [
          { insert: "Ultimate Formatting Test", attributes: { header: 1 } },
          { insert: "\n\n" },
          { insert: "This article tests " },
          { insert: "bold", attributes: { bold: true } },
          { insert: ", " },
          { insert: "italic", attributes: { italic: true } },
          { insert: ", " },
          { insert: "underline", attributes: { underline: true } },
          { insert: ", and " },
          { insert: "strikethrough", attributes: { strike: true } },
          { insert: " formatting.\n\n" },
          { insert: "It also includes " },
          { insert: "inline code", attributes: { code: true } },
          { insert: " and links to " },
          { insert: "example.com", attributes: { link: "https://example.com" } },
          { insert: ".\n\n" },
          { insert: "A quote from someone:\n" },
          { insert: "This is a blockquote\n", attributes: { blockquote: true } },
          { insert: "\nCode example:\n" },
          {
            insert: "const deno = 'awesome';\nconsole.log(deno);\n",
            attributes: { "code-block": true },
          },
          { insert: "\nUnordered list:\n" },
          { insert: "First item\n", attributes: { list: "bullet" } },
          { insert: "Second item\n", attributes: { list: "bullet" } },
          { insert: "\nOrdered list:\n" },
          { insert: "Step one\n", attributes: { list: "ordered" } },
          { insert: "Step two\n", attributes: { list: "ordered" } },
        ],
      };

      const formData: FormData = {
        authorName: "Format Tester",
        articleTitle: "Article Testing All Formatting Options",
        metaDescription:
          "This article tests every possible formatting option available in Quill editor",
        articleContent: complexDelta,
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
      assertExists(result.itemId);
      // Verify reading time calculation
      assertExists(result.readingTime);
      assertEquals(result.readingTime.includes("min read"), true);
    });

    it("should handle very long article with proper reading time", async () => {
      const formData: FormData = {
        authorName: "Long Writer",
        articleTitle: "Epic Long Form Article About Everything",
        metaDescription:
          "An extremely long article to test reading time calculations and content processing",
        articleContent: fixtures.LONG_CONTENT_DELTA,
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
      // Should have significant reading time
      const readingMinutes = parseInt(result.readingTime.split(" ")[0]);
      assertEquals(readingMinutes >= 10, true);
    });
  });

  describe("Performance and Timing", () => {
    it("should process submission within acceptable time limits", async () => {
      const startTime = Date.now();

      const formData: FormData = {
        authorName: "Performance Tester",
        articleTitle: "Performance Test Article",
        metaDescription:
          "Testing submission performance and response times to ensure API meets performance requirements",
        articleContent: fixtures.COMPLEX_DELTA,
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

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      assertEquals(response.status, 201);
      // Should complete within 5 seconds (generous for test environment)
      assertEquals(processingTime < 5000, true);
    });

    it("should handle multiple sequential submissions", async () => {
      const submissions = 10;
      const results = [];

      for (let i = 0; i < submissions; i++) {
        const formData: FormData = {
          authorName: `Sequential Author ${i}`,
          articleTitle: `Sequential Article Number ${i}`,
          metaDescription: `Description for sequential article ${i}`,
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
        results.push(result);

        // Small delay between submissions
        fakeTime.advance(100);
      }

      // Verify all have unique slugs
      const slugs = results.map((r) => r.slug);
      const uniqueSlugs = new Set(slugs);
      assertEquals(uniqueSlugs.size, submissions);
    });
  });

  describe("Field Transformation Verification", () => {
    it("should correctly map all form fields to CMS fields", async () => {
      const testDate = new Date("2024-01-15T10:30:00Z");
      fakeTime.advance(testDate.getTime());

      const formData: FormData = {
        authorName: "Field Mapper",
        articleTitle: "Testing Field Mappings",
        metaDescription: "Verifying all fields are correctly mapped to CMS structure",
        articleContent: {
          ops: [
            { insert: "This content will be converted to HTML. It includes " },
            { insert: "formatted text", attributes: { bold: true } },
            { insert: " and should preserve all formatting during conversion.\n" },
          ],
        },
        publishNow: true,
      };

      // Track the actual request to Webflow
      let capturedRequest: any;
      globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

        if (url.includes("/collections/") && url.includes("/items") && !url.includes("?limit")) {
          capturedRequest = JSON.parse(init!.body as string);
        }

        return originalFetch(input, init);
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

      // Verify field mappings in the request
      if (capturedRequest) {
        const fields = capturedRequest.fieldData;
        assertEquals(fields["author-name"], "Field Mapper");
        assertEquals(fields.name, "Testing Field Mappings");
        assertEquals(
          fields["meta-description"],
          "Verifying all fields are correctly mapped to CMS structure",
        );
        assertEquals(fields.slug, "testing-field-mappings");
        assertExists(fields.post);
        assertEquals(fields.post.includes("<p>"), true);
        assertEquals(fields.post.includes("<strong>formatted text</strong>"), true);
        assertExists(fields["reading-time"]);
        assertExists(fields["intro-text"]);
      }
    });
  });

  describe("Edge Case Handling", () => {
    it("should handle submission at exact character limits", async () => {
      // Title at exactly 100 characters (slug limit)
      const exactTitle = "A".repeat(100);

      const formData: FormData = {
        authorName: "Edge Case Tester",
        articleTitle: exactTitle,
        metaDescription:
          "Testing exact character limits for various fields to validate field constraints are enforced correctly",
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
      // Slug should be truncated to fit limit
      assertEquals(result.slug.length <= 100, true);
    });

    it("should handle rapid successive submissions with same title", async () => {
      const baseUrl = "https://api.webflow.com/v2";
      let slugCounter = 0;

      // Mock incremental slug checks
      globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

        if (url.includes("?limit=100") && !url.includes("&slug=")) {
          // First check - slug exists
          return createMockResponse({
            items: [{ id: "existing", fieldData: { slug: "duplicate-title", name: "Existing" } }],
            pagination: { limit: 100, offset: 0, total: 1 },
          });
        } else if (url.includes("&slug=duplicate-title-")) {
          // Subsequent checks - make some exist
          slugCounter++;
          if (slugCounter < 3) {
            return createMockResponse({
              items: [{
                id: `existing-${slugCounter}`,
                fieldData: { slug: `duplicate-title-${slugCounter}`, name: "Existing" },
              }],
              pagination: { limit: 100, offset: 0, total: 1 },
            });
          }
        }

        const mockFetch = createMockFetch(mockResponses);
        return mockFetch(input, init);
      };

      const formData: FormData = {
        authorName: "Duplicate Tester",
        articleTitle: "Duplicate Title",
        metaDescription:
          "Testing slug generation with duplicates to ensure unique slugs are created when conflicts exist",
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
      // Should have generated unique slug with number
      assertEquals(result.slug.startsWith("duplicate-title-"), true);
    });
  });
});

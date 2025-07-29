/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { setupIntegrationTest } from "../helpers/mock-app.ts";
import { createMockFetch, createMockResponse } from "../helpers/test-utils.ts";
import {
  FormDataBuilder,
  WebflowResponseBuilder,
  TestScenarios,
  ContentGenerator,
  makeUnique,
  cleanSensitiveData,
} from "../data/index.ts";

/**
 * Example of using the new test data management system
 */
describe("Form Submission with Test Data Management", () => {
  let originalFetch: typeof fetch;
  let mockResponses: Map<string, Response>;
  const { app } = setupIntegrationTest();
  
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockResponses = new Map();
    globalThis.fetch = createMockFetch(mockResponses);
    
    // Setup default mock responses using builders
    const baseUrl = "https://api.webflow.com/v2";
    
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items?limit=100`,
      createMockResponse(WebflowResponseBuilder.collection())
    );
    
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items`,
      createMockResponse(WebflowResponseBuilder.item(), { status: 201 })
    );
  });
  
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("Using Builders", () => {
    it("should submit article with custom data", async () => {
      // Use builder for custom test data
      const formData = new FormDataBuilder()
        .withAuthor("Jane Smith")
        .withTitle("Testing with Builders")
        .withMetaDescription("This demonstrates using the FormDataBuilder for creating test data")
        .published()
        .build();
      
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
      assertExists(result.data.id);
    });
    
    it("should use predefined builder methods", async () => {
      // Use predefined builder configurations
      const minimalArticle = FormDataBuilder.minimal();
      const completeArticle = FormDataBuilder.complete();
      
      // Test minimal article
      const response1 = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(minimalArticle),
      });
      
      assertEquals(response1.status, 201);
      
      // Test complete article
      const response2 = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(completeArticle),
      });
      
      assertEquals(response2.status, 201);
    });
  });

  describe("Using Scenarios", () => {
    it("should handle edge cases", async () => {
      // Test special characters
      const specialCharsData = TestScenarios.edgeCases.specialChars;
      
      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(specialCharsData),
      });
      
      assertEquals(response.status, 201);
    });
    
    it("should reject invalid scenarios", async () => {
      // Test invalid data
      const invalidData = TestScenarios.invalid.shortContent;
      
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
      assertExists(error.error);
    });
  });

  describe("Using Content Generators", () => {
    it("should handle generated content variations", async () => {
      // Generate content with specific features
      const richContent = ContentGenerator.quillDelta({
        paragraphs: 5,
        includeFormatting: true,
        includeLists: true,
        includeCode: true,
        includeLinks: true,
        includeHeaders: true,
      });
      
      const formData = new FormDataBuilder()
        .withTitle("Article with Rich Content")
        .withContent(richContent)
        .build();
      
      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });
      
      assertEquals(response.status, 201);
    });
    
    it("should process article batch", async () => {
      // Generate multiple articles
      const articles = ContentGenerator.articleSet(3);
      
      for (const article of articles) {
        // Make each article unique to avoid conflicts
        const uniqueArticle = makeUnique(article, ["articleTitle"]);
        
        const response = await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
          },
          body: JSON.stringify(uniqueArticle),
        });
        
        assertEquals(response.status, 201);
      }
    });
  });

  describe("Using Response Builders", () => {
    it("should handle various API responses", async () => {
      // Test error response
      mockResponses.set(
        "https://api.webflow.com/v2/collections/test-collection-id/items",
        createMockResponse(
          WebflowResponseBuilder.error(429, "Rate limit exceeded"),
          { status: 429 }
        )
      );
      
      const formData = FormDataBuilder.minimal();
      
      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(formData),
      });
      
      assertEquals(response.status, 429);
    });
    
    it("should handle published item response", async () => {
      // Mock published item response
      const publishedItem = WebflowResponseBuilder.publishedItem({
        fieldData: {
          name: "Published Article",
          slug: "published-article",
          "author-name": "Test Author",
        },
      });
      
      mockResponses.set(
        "https://api.webflow.com/v2/collections/test-collection-id/items",
        createMockResponse(publishedItem, { status: 201 })
      );
      
      const formData = new FormDataBuilder()
        .withTitle("Published Article")
        .published()
        .build();
      
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
      assertEquals(result.data.isPublished, true);
    });
  });

  describe("Security Testing", () => {
    it("should sanitize malicious content", async () => {
      // Test XSS attempt
      const xssData = TestScenarios.security.xssAttempt;
      
      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
        },
        body: JSON.stringify(xssData),
      });
      
      // Should succeed but with sanitized content
      assertEquals(response.status, 201);
    });
    
    it("should clean sensitive data from logs", () => {
      const dataWithSecrets = {
        articleTitle: "Test",
        apiKey: "secret-key-123",
        authorization: "Bearer token123",
      };
      
      const cleaned = cleanSensitiveData(dataWithSecrets);
      assertEquals(cleaned.apiKey, "[REDACTED]");
      assertEquals(cleaned.authorization, "[REDACTED]");
      assertEquals(cleaned.articleTitle, "Test");
    });
  });
});
/// <reference lib="deno.ns" />

import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  FormDataSchema,
  WebflowFieldDataSchema,
  QuillDeltaSchema,
  WebflowResponseSchema,
  validateContentRules,
  ContentValidationOptions,
} from "@utils/validation.ts";
import * as fixtures from "../../fixtures/quill-delta.ts";

describe("Validation Utils", () => {
  describe("FormDataSchema", () => {
    it("should validate correct form data", () => {
      const validData = {
        authorName: "John Doe",
        articleTitle: "Test Article",
        metaDescription: "A test article description",
        articleContent: fixtures.SIMPLE_DELTA,
      };

      const result = FormDataSchema.safeParse(validData);
      assertEquals(result.success, true);
      if (result.success) {
        assertEquals(result.data.authorName, "John Doe");
        assertEquals(result.data.articleTitle, "Test Article");
      }
    });

    it("should reject empty author name", () => {
      const invalidData = {
        authorName: "",
        articleTitle: "Test Article",
        metaDescription: "Description",
        articleContent: fixtures.SIMPLE_DELTA,
      };

      const result = FormDataSchema.safeParse(invalidData);
      assertEquals(result.success, false);
    });

    it("should reject empty article title", () => {
      const invalidData = {
        authorName: "John Doe",
        articleTitle: "",
        metaDescription: "Description",
        articleContent: fixtures.SIMPLE_DELTA,
      };

      const result = FormDataSchema.safeParse(invalidData);
      assertEquals(result.success, false);
    });

    it("should allow empty meta description", () => {
      const validData = {
        authorName: "John Doe",
        articleTitle: "Test Article",
        metaDescription: "",
        articleContent: fixtures.SIMPLE_DELTA,
      };

      const result = FormDataSchema.safeParse(validData);
      assertEquals(result.success, true);
    });

    it("should validate optional fields", () => {
      const validData = {
        authorName: "John Doe",
        articleTitle: "Test Article",
        metaDescription: "Description",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: true,
        slug: "custom-slug",
        categories: ["tech", "blog"],
        tags: ["javascript", "deno"],
      };

      const result = FormDataSchema.safeParse(validData);
      assertEquals(result.success, true);
      if (result.success) {
        assertEquals(result.data.publishNow, true);
        assertEquals(result.data.slug, "custom-slug");
        assertEquals(result.data.categories, ["tech", "blog"]);
        assertEquals(result.data.tags, ["javascript", "deno"]);
      }
    });

    it("should handle missing optional fields with defaults", () => {
      const validData = {
        authorName: "John Doe",
        articleTitle: "Test Article",
        metaDescription: "Description",
        articleContent: fixtures.SIMPLE_DELTA,
      };

      const result = FormDataSchema.safeParse(validData);
      assertEquals(result.success, true);
      if (result.success) {
        assertEquals(result.data.publishNow, false);
        assertEquals(result.data.categories, []);
        assertEquals(result.data.tags, []);
      }
    });
  });

  describe("QuillDeltaSchema", () => {
    it("should validate simple delta", () => {
      const result = QuillDeltaSchema.safeParse(fixtures.SIMPLE_DELTA);
      assertEquals(result.success, true);
    });

    it("should validate complex delta with formatting", () => {
      const result = QuillDeltaSchema.safeParse(fixtures.COMPLEX_DELTA);
      assertEquals(result.success, true);
    });

    it("should validate delta with images", () => {
      const result = QuillDeltaSchema.safeParse(fixtures.IMAGE_DELTA);
      assertEquals(result.success, true);
    });

    it("should validate delta with videos", () => {
      const result = QuillDeltaSchema.safeParse(fixtures.VIDEO_DELTA);
      assertEquals(result.success, true);
    });

    it("should reject malformed delta", () => {
      const result = QuillDeltaSchema.safeParse(fixtures.MALFORMED_DELTA);
      assertEquals(result.success, false);
    });

    it("should allow empty ops array", () => {
      const result = QuillDeltaSchema.safeParse(fixtures.EMPTY_DELTA);
      assertEquals(result.success, true);
    });

    it("should validate mixed formatting", () => {
      const result = QuillDeltaSchema.safeParse(fixtures.MIXED_FORMATTING_DELTA);
      assertEquals(result.success, true);
    });

    it("should handle retain and delete operations", () => {
      const deltaWithOps = {
        ops: [
          { insert: "Hello" },
          { retain: 5 },
          { delete: 3 },
          { insert: " World" },
        ],
      };

      const result = QuillDeltaSchema.safeParse(deltaWithOps);
      assertEquals(result.success, true);
    });
  });

  describe("WebflowFieldDataSchema", () => {
    it("should validate complete field data", () => {
      const fieldData = {
        name: "Test Article",
        slug: "test-article",
        "author-name": "John Doe",
        post: "<p>Test content</p>",
        "meta-description": "Test description",
        "reading-time": "2 min read",
        "intro-text": "Test intro",
        "created-on": "2024-01-01T00:00:00Z",
        "updated-on": "2024-01-01T00:00:00Z",
        "published-on": "2024-01-01T00:00:00Z",
      };

      const result = WebflowFieldDataSchema.safeParse(fieldData);
      assertEquals(result.success, true);
    });

    it("should validate minimal required fields", () => {
      const minimalData = {
        name: "Test",
        slug: "test",
        "author-name": "Author",
        post: "<p>Content</p>",
      };

      const result = WebflowFieldDataSchema.safeParse(minimalData);
      assertEquals(result.success, true);
    });

    it("should allow additional fields", () => {
      const dataWithExtras = {
        name: "Test",
        slug: "test",
        "author-name": "Author",
        post: "<p>Content</p>",
        "custom-field": "value",
        "another-field": 123,
      };

      const result = WebflowFieldDataSchema.safeParse(dataWithExtras);
      assertEquals(result.success, true);
    });
  });

  describe("WebflowResponseSchema", () => {
    it("should validate successful response", () => {
      const response = {
        id: "123",
        cmsLocaleId: "456",
        lastPublished: "2024-01-01T00:00:00Z",
        lastUpdated: "2024-01-01T00:00:00Z",
        createdOn: "2024-01-01T00:00:00Z",
        isArchived: false,
        isDraft: true,
        fieldData: {
          name: "Test",
          slug: "test",
          "author-name": "Author",
          post: "<p>Content</p>",
        },
      };

      const result = WebflowResponseSchema.safeParse(response);
      assertEquals(result.success, true);
    });

    it("should handle null lastPublished", () => {
      const response = {
        id: "123",
        cmsLocaleId: "456",
        lastPublished: null,
        lastUpdated: "2024-01-01T00:00:00Z",
        createdOn: "2024-01-01T00:00:00Z",
        isArchived: false,
        isDraft: true,
        fieldData: {
          name: "Test",
          slug: "test",
          "author-name": "Author",
          post: "<p>Content</p>",
        },
      };

      const result = WebflowResponseSchema.safeParse(response);
      assertEquals(result.success, true);
    });
  });

  describe("validateContentRules", () => {
    it("should pass with valid content length", () => {
      const delta = {
        ops: [{ insert: "Short content" }],
      };

      const result = validateContentRules(delta, {
        minWords: 1,
        maxWords: 100,
      });

      assertEquals(result.isValid, true);
      assertEquals(result.errors.length, 0);
    });

    it("should fail when content is too short", () => {
      const delta = {
        ops: [{ insert: "Too short" }],
      };

      const result = validateContentRules(delta, {
        minWords: 10,
      });

      assertEquals(result.isValid, false);
      assertEquals(result.errors.length, 1);
      assertEquals(result.errors[0].includes("at least 10 words"), true);
    });

    it("should fail when content is too long", () => {
      const longText = "word ".repeat(200);
      const delta = {
        ops: [{ insert: longText }],
      };

      const result = validateContentRules(delta, {
        maxWords: 100,
      });

      assertEquals(result.isValid, false);
      assertEquals(result.errors.length, 1);
      assertEquals(result.errors[0].includes("exceed 100 words"), true);
    });

    it("should check for required headings", () => {
      const deltaWithoutHeading = {
        ops: [{ insert: "Content without heading\n" }],
      };

      const result = validateContentRules(deltaWithoutHeading, {
        requireHeading: true,
      });

      assertEquals(result.isValid, false);
      assertEquals(result.errors.length, 1);
      assertEquals(result.errors[0].includes("heading"), true);
    });

    it("should pass with required heading present", () => {
      const deltaWithHeading = {
        ops: [
          { insert: "My Heading", attributes: { header: 1 } },
          { insert: "\nContent\n" },
        ],
      };

      const result = validateContentRules(deltaWithHeading, {
        requireHeading: true,
      });

      assertEquals(result.isValid, true);
      assertEquals(result.errors.length, 0);
    });

    it("should reject disallowed tags", () => {
      const deltaWithScript = {
        ops: [
          { insert: "Text with ", attributes: { script: true } },
          { insert: "script tag\n" },
        ],
      };

      const result = validateContentRules(deltaWithScript, {
        allowedFormats: ["bold", "italic"],
      });

      assertEquals(result.isValid, false);
      assertEquals(result.errors.length, 1);
      assertEquals(result.errors[0].includes("Disallowed format"), true);
    });

    it("should count images correctly", () => {
      const deltaWithImages = {
        ops: [
          { insert: "Text\n" },
          { insert: { image: "url1.jpg" } },
          { insert: "\n" },
          { insert: { image: "url2.jpg" } },
          { insert: "\n" },
        ],
      };

      const result = validateContentRules(deltaWithImages, {
        maxImages: 1,
      });

      assertEquals(result.isValid, false);
      assertEquals(result.errors.length, 1);
      assertEquals(result.errors[0].includes("Too many images"), true);
      assertEquals(result.metadata.imageCount, 2);
    });

    it("should provide accurate metadata", () => {
      const result = validateContentRules(fixtures.COMPLEX_DELTA);

      assertEquals(result.metadata.wordCount > 0, true);
      assertEquals(result.metadata.characterCount > 0, true);
      assertEquals(result.metadata.hasHeading, true);
      assertEquals(result.metadata.linkCount, 1);
      assertEquals(result.metadata.listCount, 2);
    });

    it("should validate custom rules", () => {
      const customValidator: ContentValidationOptions["customValidators"] = [
        (delta) => {
          const hasCode = delta.ops.some(
            (op) => op.attributes?.code || op.attributes?.["code-block"]
          );
          return hasCode ? { isValid: false, error: "Code not allowed" } : { isValid: true };
        },
      ];

      const result = validateContentRules(fixtures.COMPLEX_DELTA, {
        customValidators: [customValidator],
      });

      assertEquals(result.isValid, false);
      assertEquals(result.errors.length, 1);
      assertEquals(result.errors[0], "Code not allowed");
    });

    it("should handle empty content", () => {
      const result = validateContentRules(fixtures.EMPTY_DELTA, {
        minWords: 1,
      });

      assertEquals(result.isValid, false);
      assertEquals(result.errors.length, 1);
      assertEquals(result.metadata.wordCount, 0);
    });

    it("should handle special characters and unicode", () => {
      const result = validateContentRules(fixtures.SPECIAL_CHARS_DELTA);

      assertEquals(result.isValid, true);
      assertEquals(result.metadata.wordCount > 0, true);
    });
  });
});
/// <reference lib="deno.ns" />

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  type FormData,
  formDataSchema,
  type QuillDelta,
  validateContent,
  validateContentLength,
  validateContentUrls,
  validateFormData,
} from "@utils/validation.ts";
import * as fixtures from "../../fixtures/quill-delta.ts";

describe("Validation Utils", () => {
  describe("formDataSchema", () => {
    it("should validate correct form data", () => {
      const validData = {
        authorName: "John Doe",
        articleTitle: "Test Article About Writing Great Content",
        metaDescription:
          "A test article description that is long enough for validation requirements",
        articleContent: fixtures.COMPLEX_DELTA,
      };

      const result = formDataSchema.safeParse(validData);
      assertEquals(result.success, true);
      if (result.success) {
        assertEquals(result.data.authorName, "John Doe");
        assertEquals(result.data.articleTitle, "Test Article About Writing Great Content");
      }
    });

    it("should reject empty author name", () => {
      const invalidData = {
        authorName: "",
        articleTitle: "Test Article",
        metaDescription: "Description",
        articleContent: fixtures.SIMPLE_DELTA,
      };

      const result = formDataSchema.safeParse(invalidData);
      assertEquals(result.success, false);
    });

    it("should reject empty article title", () => {
      const invalidData = {
        authorName: "John Doe",
        articleTitle: "",
        metaDescription: "Description",
        articleContent: fixtures.SIMPLE_DELTA,
      };

      const result = formDataSchema.safeParse(invalidData);
      assertEquals(result.success, false);
    });

    it("should require at least 50 characters for meta description", () => {
      const invalidData = {
        authorName: "John Doe",
        articleTitle: "Test Article With Enough Characters For Validation",
        metaDescription: "Too short",
        articleContent: fixtures.COMPLEX_DELTA,
      };

      const result = formDataSchema.safeParse(invalidData);
      assertEquals(result.success, false);

      const validData = {
        ...invalidData,
        metaDescription:
          "This is a valid meta description with at least fifty characters for SEO purposes",
      };

      const validResult = formDataSchema.safeParse(validData);
      if (!validResult.success) {
        console.log("Validation errors for 'validData':", validResult.error.errors);
      }
      assertEquals(validResult.success, true);
    });

    it("should validate optional fields", () => {
      const validData = {
        authorName: "John Doe",
        articleTitle: "Test Article With Enough Characters For Validation Rules",
        metaDescription:
          "This is a valid meta description with at least fifty characters for SEO purposes",
        articleContent: fixtures.COMPLEX_DELTA,
        publishNow: true,
        slug: "custom-slug",
        categories: ["tech", "blog"],
        tags: ["javascript", "deno"],
      };

      const result = formDataSchema.safeParse(validData);
      if (!result.success) {
        console.log("Validation errors for optional fields:", result.error.errors);
      }
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
        articleTitle: "Test Article With Enough Characters For Validation Rules",
        metaDescription: "Description that meets the minimum character requirements for metadata",
        articleContent: fixtures.COMPLEX_DELTA,
      };

      const result = formDataSchema.safeParse(validData);
      assertEquals(result.success, true);
      if (result.success) {
        // Check defaults or undefined values
        assertEquals(
          result.data.publishNow === false || result.data.publishNow === undefined,
          true,
        );
        assertEquals(
          Array.isArray(result.data.categories) || result.data.categories === undefined,
          true,
        );
        assertEquals(Array.isArray(result.data.tags) || result.data.tags === undefined, true);
      }
    });
  });

  describe("validateFormData", () => {
    it("should validate and return parsed data", () => {
      const validData = {
        authorName: "John Doe",
        articleTitle: "Test Article With Enough Characters For Validation Rules",
        metaDescription: "Description that meets the minimum character requirements for metadata",
        articleContent: fixtures.COMPLEX_DELTA,
      };

      const result = validateFormData(validData);
      assertEquals(result.success, true);
      if (result.success && result.data) {
        assertEquals(result.data.authorName, "John Doe");
      }
    });

    it("should return errors for invalid data", () => {
      const invalidData = {
        authorName: "",
        articleTitle: "Test",
        metaDescription: "Description",
        articleContent: fixtures.SIMPLE_DELTA,
      };

      const result = validateFormData(invalidData);
      assertEquals(result.success, false);
      assertEquals((result.errors?.length ?? 0) > 0, true);
    });
  });

  describe("validateContentLength", () => {
    it("should pass with valid content length", () => {
      const delta = {
        ops: [{
          insert: "This is a test article with enough words to pass the minimum requirement.",
        }],
      };

      const result = validateContentLength(delta, 5);
      assertEquals(result.success, true);
    });

    it("should fail when content is too short", () => {
      const delta = {
        ops: [{ insert: "Too short" }],
      };

      const result = validateContentLength(delta, 10);
      assertEquals(result.success, false);
      assertEquals(result.errors?.length, 1);
      assertEquals(result.errors?.[0]?.message.includes("at least 10 words"), true);
    });
  });

  describe("validateContentUrls", () => {
    it("should pass with valid URLs", () => {
      const delta = {
        ops: [
          { insert: "Check out this " },
          { insert: "link", attributes: { link: "https://example.com" } },
          { insert: " and this " },
          { insert: "image", attributes: { image: "https://example.com/image.jpg" } },
        ],
      };

      const result = validateContentUrls(delta);
      assertEquals(result.success, true);
    });

    it("should fail with invalid URLs", () => {
      const delta = {
        ops: [
          { insert: "Bad link: " },
          { insert: "click here", attributes: { link: "not-a-valid-url" } },
          { insert: { image: "also-not-valid" } },
        ],
      };

      const result = validateContentUrls(delta);
      assertEquals(result.success, false);
      assertEquals((result.errors?.length ?? 0) > 0, true);
    });
  });

  describe("validateContent", () => {
    it("should validate content with multiple rules", () => {
      const delta = fixtures.COMPLEX_DELTA;

      const result = validateContent(delta, {
        minWords: 10,
        validateUrls: true,
      });

      assertEquals(result.success, true);
    });

    it("should fail when any validation rule fails", () => {
      const shortDelta = {
        ops: [{ insert: "Short" }],
      };

      const result = validateContent(shortDelta, {
        minWords: 10,
        validateUrls: true,
      });

      assertEquals(result.success, false);
      assertEquals((result.errors?.length ?? 0) > 0, true);
    });

    it("should validate images and videos", () => {
      const mediaResult = validateContent(fixtures.IMAGE_DELTA, {
        validateUrls: true,
        minWords: 0, // Image deltas might not have many words
      });
      assertEquals(mediaResult.success, true);

      const videoResult = validateContent(fixtures.VIDEO_DELTA, {
        validateUrls: true,
        minWords: 0, // Video deltas might not have many words
      });
      assertEquals(videoResult.success, true);
    });
  });
});

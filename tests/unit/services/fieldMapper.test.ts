import { assertEquals, assertThrows } from "@std/testing/asserts";
import {
  mapToWebflowFields,
  transformFieldValue,
  createPartialUpdate,
  getFieldMapping,
  isValidWebflowField,
  sanitizeFieldData,
  type WebflowFieldData,
  type WebflowCmsItem,
} from "@/services/fieldMapper.ts";
import type { ArticleMetadata } from "@/services/metadataGenerator.ts";
import type { FormData } from "@/utils/validation.ts";
import { ValidationError } from "@/utils/errors.ts";

// Test data
const mockFormData: FormData = {
  authorName: "John Doe",
  articleTitle: "Test Article Title",
  metaDescription: "This is a test article description",
  articleContent: { ops: [{ insert: "Test content\n" }] },
  publishNow: true,
};

const mockMetadata: ArticleMetadata = {
  slug: "test-article-title",
  readingTime: "2 min read",
  introText: "This is the intro text...",
  createdOn: "2024-01-01T00:00:00.000Z",
  updatedOn: "2024-01-01T00:00:00.000Z",
  publishedOn: "2024-01-01T00:00:00.000Z",
  wordCount: 100,
  characterCount: 500,
};

const mockHtmlContent = "<p>Test content</p>";

Deno.test("mapToWebflowFields - basic mapping", () => {
  const result = mapToWebflowFields(mockFormData, mockMetadata, mockHtmlContent);

  assertEquals(result.fieldData.name, "Test Article Title");
  assertEquals(result.fieldData["author-name"], "John Doe");
  assertEquals(result.fieldData["meta-description"], "This is a test article description");
  assertEquals(result.fieldData.post, "<p>Test content</p>");
  assertEquals(result.fieldData.slug, "test-article-title");
  assertEquals(result.fieldData["reading-time"], "2 min read");
  assertEquals(result.fieldData["intro-text"], "This is the intro text...");
  assertEquals(result.fieldData._archived, false);
  assertEquals(result.fieldData._draft, false);
  assertEquals(result.fieldData["created-on"], "2024-01-01T00:00:00.000Z");
  assertEquals(result.fieldData["published-on"], "2024-01-01T00:00:00.000Z");
});

Deno.test("mapToWebflowFields - draft article", () => {
  const draftFormData = { ...mockFormData, publishNow: false };
  const draftMetadata = { ...mockMetadata, publishedOn: undefined };
  
  const result = mapToWebflowFields(draftFormData, draftMetadata, mockHtmlContent);

  assertEquals(result.fieldData._draft, true);
  assertEquals(result.fieldData["published-on"], undefined);
});

Deno.test("mapToWebflowFields - with optional fields", () => {
  const formDataWithOptional: FormData = {
    ...mockFormData,
    categories: ["Technology", "Web Development"],
    tags: ["webflow", "cms", "api"],
    featuredImage: "https://example.com/image.jpg",
    authorEmail: "john@example.com",
    authorPhone: "+1234567890",
  };

  const result = mapToWebflowFields(formDataWithOptional, mockMetadata, mockHtmlContent);

  assertEquals(result.fieldData.categories, ["Technology", "Web Development"]);
  assertEquals(result.fieldData.tags, ["webflow", "cms", "api"]);
  assertEquals(result.fieldData["featured-image"], "https://example.com/image.jpg");
  assertEquals(result.fieldData["author-email"], "john@example.com");
  assertEquals(result.fieldData["author-phone"], "+1234567890");
});

Deno.test("mapToWebflowFields - handles missing optional fields", () => {
  const result = mapToWebflowFields(mockFormData, mockMetadata, mockHtmlContent);

  // Optional fields should be undefined when not provided
  assertEquals(result.fieldData["author-email"], undefined);
  assertEquals(result.fieldData["author-phone"], undefined);
  assertEquals(result.fieldData["featured-image"], undefined);
  assertEquals(result.fieldData.categories, undefined);
  assertEquals(result.fieldData.tags, undefined);
});

Deno.test("mapToWebflowFields - update mode", () => {
  const result = mapToWebflowFields(mockFormData, mockMetadata, mockHtmlContent, {
    isUpdate: true,
  });

  // Should include isDraft for updates
  assertEquals(result.isDraft, false);
  
  // Should not include created-on for updates
  assertEquals(result.fieldData["created-on"], undefined);
  
  // Should include updated-on
  assertEquals(result.fieldData["updated-on"], mockMetadata.updatedOn);
});

Deno.test("mapToWebflowFields - field length validation", () => {
  const longTitle = "a".repeat(300); // Exceeds 256 character limit
  const formDataWithLongTitle = { ...mockFormData, articleTitle: longTitle };

  assertThrows(
    () => mapToWebflowFields(formDataWithLongTitle, mockMetadata, mockHtmlContent),
    ValidationError,
    "exceeds maximum length"
  );
});

Deno.test("mapToWebflowFields - required field validation", () => {
  const incompleteFormData = {
    authorName: "",
    articleTitle: "Title",
    metaDescription: "Description",
    articleContent: { ops: [] },
    publishNow: true,
  } as FormData;

  assertThrows(
    () => mapToWebflowFields(incompleteFormData, mockMetadata, mockHtmlContent),
    ValidationError,
    "Missing required fields"
  );
});

Deno.test("transformFieldValue - string fields", () => {
  assertEquals(transformFieldValue("test", "name"), "test");
  assertEquals(transformFieldValue(123, "name"), "123");
  assertEquals(transformFieldValue(null, "name"), "");
  assertEquals(transformFieldValue(undefined, "name"), "");
});

Deno.test("transformFieldValue - boolean fields", () => {
  assertEquals(transformFieldValue(true, "_archived"), true);
  assertEquals(transformFieldValue(false, "_draft"), false);
  assertEquals(transformFieldValue("true", "_archived"), true);
  assertEquals(transformFieldValue(1, "_draft"), true);
  assertEquals(transformFieldValue(0, "_archived"), false);
});

Deno.test("transformFieldValue - array fields", () => {
  assertEquals(transformFieldValue(["tag1", "tag2"], "tags"), ["tag1", "tag2"]);
  assertEquals(transformFieldValue(["", "tag"], "categories"), ["tag"]);
  assertEquals(transformFieldValue(null, "tags"), []);
  assertEquals(transformFieldValue("not-array", "categories"), []);
});

Deno.test("transformFieldValue - date fields", () => {
  const date = new Date("2024-01-01T00:00:00.000Z");
  assertEquals(transformFieldValue(date, "created-on"), "2024-01-01T00:00:00.000Z");
  assertEquals(transformFieldValue("2024-01-01", "updated-on"), "2024-01-01T00:00:00.000Z");
  
  // Invalid date should return current date
  const result = transformFieldValue("invalid", "published-on");
  assertEquals(typeof result, "string");
  assertEquals(new Date(result as string).toString() !== "Invalid Date", true);
});

Deno.test("createPartialUpdate - detects changes", () => {
  const currentData: WebflowFieldData = {
    name: "Original Title",
    "author-name": "John Doe",
    "meta-description": "Original description",
    post: "<p>Original content</p>",
    slug: "original-title",
    "reading-time": "2 min read",
    "intro-text": "Original intro",
    _archived: false,
    _draft: false,
  };

  const newData: Partial<WebflowFieldData> = {
    name: "Updated Title",
    "author-name": "John Doe", // No change
    "meta-description": "Updated description",
  };

  const updates = createPartialUpdate(currentData, newData);

  assertEquals(updates.name, "Updated Title");
  assertEquals(updates["meta-description"], "Updated description");
  assertEquals(updates["author-name"], undefined); // No change, not included
  assertEquals(typeof updates["updated-on"], "string"); // Always included
});

Deno.test("createPartialUpdate - handles arrays and objects", () => {
  const currentData: WebflowFieldData = {
    name: "Title",
    "author-name": "Author",
    "meta-description": "Description",
    post: "<p>Content</p>",
    slug: "title",
    "reading-time": "1 min read",
    "intro-text": "Intro",
    _archived: false,
    _draft: false,
    categories: ["Tech", "Web"],
    tags: ["tag1", "tag2"],
  };

  const newData: Partial<WebflowFieldData> = {
    categories: ["Tech", "Web"], // Same array
    tags: ["tag1", "tag3"], // Different array
  };

  const updates = createPartialUpdate(currentData, newData);

  assertEquals(updates.categories, undefined); // No change
  assertEquals(updates.tags, ["tag1", "tag3"]); // Changed
});

Deno.test("getFieldMapping - returns complete mapping", () => {
  const mapping = getFieldMapping();

  assertEquals(mapping.authorName, "author-name");
  assertEquals(mapping.articleTitle, "name");
  assertEquals(mapping.metaDescription, "meta-description");
  assertEquals(mapping.articleContent, "post");
  assertEquals(mapping.slug, "slug");
  assertEquals(typeof mapping, "object");
});

Deno.test("isValidWebflowField - validates field names", () => {
  assertEquals(isValidWebflowField("author-name"), true);
  assertEquals(isValidWebflowField("name"), true);
  assertEquals(isValidWebflowField("_archived"), true);
  assertEquals(isValidWebflowField("_draft"), true);
  assertEquals(isValidWebflowField("invalid-field"), false);
  assertEquals(isValidWebflowField(""), false);
});

Deno.test("sanitizeFieldData - removes empty fields", () => {
  const fieldData: Partial<WebflowFieldData> = {
    name: "Title",
    "author-name": "",
    "meta-description": "",
    categories: [],
    tags: ["tag1"],
    "featured-image": null as any,
    "author-email": undefined as any,
  };

  const sanitized = sanitizeFieldData(fieldData);

  assertEquals(sanitized.name, "Title");
  assertEquals(sanitized["author-name"], ""); // Empty required field kept
  assertEquals(sanitized["meta-description"], undefined); // Empty optional field removed
  assertEquals(sanitized.categories, undefined); // Empty array removed
  assertEquals(sanitized.tags, ["tag1"]);
  assertEquals(sanitized["featured-image"], undefined); // null removed
  assertEquals(sanitized["author-email"], undefined); // undefined removed
});

Deno.test("sanitizeFieldData - preserves valid data", () => {
  const fieldData: Partial<WebflowFieldData> = {
    name: "Title",
    "author-name": "Author",
    _archived: false,
    _draft: true,
    categories: ["Tech"],
    "published-on": "2024-01-01T00:00:00.000Z",
  };

  const sanitized = sanitizeFieldData(fieldData);

  assertEquals(sanitized, fieldData); // All valid data preserved
});

Deno.test("mapToWebflowFields - without optional fields", () => {
  const result = mapToWebflowFields(mockFormData, mockMetadata, mockHtmlContent, {
    includeOptionalFields: false,
  });

  // Required fields should be present
  assertEquals(result.fieldData.name, "Test Article Title");
  assertEquals(result.fieldData["author-name"], "John Doe");
  
  // Optional fields should not be present
  assertEquals(result.fieldData["author-email"], undefined);
  assertEquals(result.fieldData["author-phone"], undefined);
  assertEquals(result.fieldData.categories, undefined);
  assertEquals(result.fieldData.tags, undefined);
});

Deno.test("Field mapping completeness", () => {
  // Ensure all required Webflow fields are mapped
  const requiredWebflowFields = [
    "name",
    "author-name",
    "meta-description",
    "post",
    "slug",
    "reading-time",
    "intro-text",
  ];

  const mapping = getFieldMapping();
  const mappedFields = Object.values(mapping);

  for (const field of requiredWebflowFields) {
    assertEquals(
      mappedFields.includes(field) || field === "_archived" || field === "_draft",
      true,
      `Required field '${field}' not found in mapping`
    );
  }
});
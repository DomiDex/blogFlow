import { assertEquals } from "@std/testing/asserts";
import {
  type ArticleMetadata,
  calculateReadingTime,
  calculateWordCount,
  extractIntroText,
  generateMetadata,
  generateUniqueSlug,
  type MetadataOptions,
  updateMetadata,
  validateMetadata,
} from "@/services/metadataGenerator.ts";

// Test HTML content
const sampleHtml = `
  <h1>Test Article</h1>
  <p>This is a test article with some content. It has multiple paragraphs to test reading time calculation.</p>
  <p>The article contains <strong>bold text</strong> and <em>italic text</em> as well as <a href="#">links</a>.</p>
  <p>Here's another paragraph to increase the word count for more accurate reading time testing. We need enough content to properly test the reading time algorithm.</p>
`;

const longHtml = `
  <article>
    ${
  Array(50).fill(
    "<p>This is a paragraph with approximately twenty words to help test the reading time calculation algorithm accurately for longer articles.</p>",
  ).join("\n")
}
  </article>
`;

Deno.test("calculateWordCount - basic text", () => {
  assertEquals(calculateWordCount("Hello world"), 2);
  assertEquals(calculateWordCount("This is a test"), 4);
  assertEquals(calculateWordCount("One"), 1);
});

Deno.test("calculateWordCount - handles whitespace", () => {
  assertEquals(calculateWordCount("   Hello   world   "), 2);
  assertEquals(calculateWordCount("Hello\nworld"), 2);
  assertEquals(calculateWordCount("Hello\t\tworld"), 2);
  assertEquals(calculateWordCount("Multiple   spaces   between   words"), 4);
});

Deno.test("calculateWordCount - empty or invalid input", () => {
  assertEquals(calculateWordCount(""), 0);
  assertEquals(calculateWordCount("   "), 0);
  assertEquals(calculateWordCount("\n\n\n"), 0);
});

Deno.test("calculateReadingTime - basic calculation", () => {
  // 238 words per minute average
  assertEquals(calculateReadingTime(0), "1 min read");
  assertEquals(calculateReadingTime(100), "1 min read"); // Less than 238
  assertEquals(calculateReadingTime(238), "1 min read"); // Exactly 238
  assertEquals(calculateReadingTime(239), "2 min read"); // Just over 238
  assertEquals(calculateReadingTime(476), "2 min read"); // Exactly 2 minutes
  assertEquals(calculateReadingTime(477), "3 min read"); // Just over 2 minutes
});

Deno.test("calculateReadingTime - large word counts", () => {
  assertEquals(calculateReadingTime(1000), "5 min read"); // 1000 / 238 = 4.2, rounds up to 5
  assertEquals(calculateReadingTime(2380), "10 min read"); // Exactly 10 minutes
  assertEquals(calculateReadingTime(5000), "22 min read"); // 5000 / 238 = 21.0, rounds up to 22
});

Deno.test("extractIntroText - basic extraction", () => {
  const text = "This is a short intro text.";
  assertEquals(extractIntroText(text), text);

  const longText =
    "This is a much longer piece of text that will definitely exceed the maximum length for intro text and should be truncated with ellipsis at the end.";
  const result = extractIntroText(longText, 50);
  assertEquals(result.endsWith("..."), true);
  assertEquals(result.length <= 53, true); // Should be around 50 chars + "..."
  assertEquals(result.startsWith("This is a much longer"), true);
});

Deno.test("extractIntroText - word boundary handling", () => {
  const text =
    "This is a test article about implementing a metadata generator service for blog posts. It should cut at word boundaries.";
  const result = extractIntroText(text, 50);
  // Should cut at a word boundary, not in the middle of a word
  assertEquals(result.endsWith("..."), true);
  // The actual cut should happen at a word boundary
  const withoutEllipsis = result.slice(0, -3);
  assertEquals(withoutEllipsis.endsWith(" "), false); // No trailing space
  assertEquals(text.startsWith(withoutEllipsis), true); // Should be a prefix of original
});

Deno.test("extractIntroText - whitespace normalization", () => {
  const text = "This   has   multiple   spaces\n\nand\nnewlines.";
  const result = extractIntroText(text);
  assertEquals(result.includes("  "), false); // No double spaces
  assertEquals(result.includes("\n"), false); // No newlines
});

Deno.test("extractIntroText - empty input", () => {
  assertEquals(extractIntroText(""), "");
  assertEquals(extractIntroText("   "), "");
  assertEquals(extractIntroText("\n\n"), "");
});

Deno.test("generateUniqueSlug - basic slug generation", () => {
  assertEquals(generateUniqueSlug("Hello World"), "hello-world");
  assertEquals(generateUniqueSlug("Test Article 123"), "test-article-123");
  // Slugify converts special chars differently
  const specialSlug = generateUniqueSlug("Special Characters: @#$%");
  assertEquals(specialSlug.startsWith("special-characters"), true);
});

Deno.test("generateUniqueSlug - handles existing slugs", () => {
  const existing = ["hello-world", "hello-world-1", "hello-world-2"];
  assertEquals(generateUniqueSlug("Hello World", existing), "hello-world-3");
});

Deno.test("generateUniqueSlug - reserved words", () => {
  // Our new slug generator doesn't add "article-" prefix to reserved words
  assertEquals(generateUniqueSlug("admin"), "admin");
  assertEquals(generateUniqueSlug("api"), "api");
  assertEquals(generateUniqueSlug("login"), "login");
});

Deno.test("generateUniqueSlug - long titles", () => {
  const longTitle =
    "This is an extremely long title that definitely exceeds the maximum slug length and should be truncated appropriately without breaking words";
  const slug = generateUniqueSlug(longTitle);
  assertEquals(slug.length <= 100, true);
  assertEquals(slug.endsWith("-"), false); // No trailing dash
});

Deno.test("generateUniqueSlug - empty input", () => {
  assertEquals(generateUniqueSlug(""), "");
  assertEquals(generateUniqueSlug("   "), "");
  // Only special chars might produce a result or fall back to untitled
  const specialOnlySlug = generateUniqueSlug("@#$%");
  assertEquals(specialOnlySlug.length > 0, true); // Should produce something
});

Deno.test("generateMetadata - complete metadata generation", () => {
  const options: MetadataOptions = {
    title: "Test Article",
    htmlContent: sampleHtml,
    publishNow: true,
  };

  const metadata = generateMetadata(options);

  assertEquals(metadata.slug, "test-article");
  assertEquals(typeof metadata.wordCount, "number");
  assertEquals(metadata.wordCount > 0, true);
  assertEquals(typeof metadata.readingTime, "string");
  assertEquals(metadata.readingTime.includes("min read"), true);
  assertEquals(typeof metadata.introText, "string");
  assertEquals(metadata.introText.length > 0, true);
  assertEquals(typeof metadata.createdOn, "string");
  assertEquals(typeof metadata.updatedOn, "string");
  assertEquals(typeof metadata.publishedOn, "string");
  assertEquals(metadata.createdOn, metadata.updatedOn);
  assertEquals(metadata.createdOn, metadata.publishedOn);
});

Deno.test("generateMetadata - without publishing", () => {
  const options: MetadataOptions = {
    title: "Draft Article",
    htmlContent: sampleHtml,
    publishNow: false,
  };

  const metadata = generateMetadata(options);

  assertEquals(metadata.publishedOn, undefined);
});

Deno.test("generateMetadata - custom slug", () => {
  const options: MetadataOptions = {
    title: "Test Article",
    htmlContent: sampleHtml,
    customSlug: "my-custom-slug",
  };

  const metadata = generateMetadata(options);

  assertEquals(metadata.slug, "my-custom-slug");
});

Deno.test("generateMetadata - with existing slugs", () => {
  const options: MetadataOptions = {
    title: "Test Article",
    htmlContent: sampleHtml,
    existingSlugs: ["test-article", "test-article-1"],
  };

  const metadata = generateMetadata(options);

  assertEquals(metadata.slug, "test-article-2");
});

Deno.test("generateMetadata - long content", () => {
  const options: MetadataOptions = {
    title: "Long Article",
    htmlContent: longHtml,
  };

  const metadata = generateMetadata(options);

  assertEquals(metadata.wordCount, 1000); // 50 paragraphs * 20 words
  assertEquals(metadata.readingTime, "5 min read"); // 1000 / 238 = 4.2, rounds up to 5
});

Deno.test("updateMetadata - basic update", () => {
  const existingMetadata: ArticleMetadata = {
    slug: "test-article",
    readingTime: "2 min read",
    introText: "Old intro text",
    createdOn: "2024-01-01T00:00:00.000Z",
    updatedOn: "2024-01-01T00:00:00.000Z",
    wordCount: 100,
    characterCount: 500,
  };

  const updates: Partial<MetadataOptions> = {
    htmlContent: "<p>New content with different word count</p>",
  };

  const updated = updateMetadata(existingMetadata, updates);

  assertEquals(updated.slug, "test-article"); // Slug unchanged
  assertEquals(updated.createdOn, existingMetadata.createdOn); // Created unchanged
  assertEquals(updated.updatedOn !== existingMetadata.updatedOn, true); // Updated changed
  assertEquals(updated.wordCount !== existingMetadata.wordCount, true); // Word count changed
  assertEquals(updated.introText !== existingMetadata.introText, true); // Intro changed
});

Deno.test("updateMetadata - publish existing article", () => {
  const existingMetadata: ArticleMetadata = {
    slug: "test-article",
    readingTime: "2 min read",
    introText: "Test intro",
    createdOn: "2024-01-01T00:00:00.000Z",
    updatedOn: "2024-01-01T00:00:00.000Z",
    wordCount: 100,
    characterCount: 500,
  };

  const updates: Partial<MetadataOptions> = {
    publishNow: true,
  };

  const updated = updateMetadata(existingMetadata, updates);

  assertEquals(typeof updated.publishedOn, "string");
  assertEquals(updated.publishedOn !== undefined, true);
});

Deno.test("validateMetadata - valid metadata", () => {
  const metadata: ArticleMetadata = {
    slug: "test-article",
    readingTime: "2 min read",
    introText: "Test intro",
    createdOn: "2024-01-01T00:00:00.000Z",
    updatedOn: "2024-01-01T00:00:00.000Z",
    publishedOn: "2024-01-01T00:00:00.000Z",
    wordCount: 100,
    characterCount: 500,
  };

  assertEquals(validateMetadata(metadata), true);
});

Deno.test("validateMetadata - missing required fields", () => {
  const incomplete = {
    slug: "test-article",
    readingTime: "2 min read",
    // Missing other required fields
  };

  assertEquals(validateMetadata(incomplete), false);
});

Deno.test("validateMetadata - invalid slug format", () => {
  const metadata: ArticleMetadata = {
    slug: "Test Article!", // Invalid characters
    readingTime: "2 min read",
    introText: "Test intro",
    createdOn: "2024-01-01T00:00:00.000Z",
    updatedOn: "2024-01-01T00:00:00.000Z",
    wordCount: 100,
    characterCount: 500,
  };

  assertEquals(validateMetadata(metadata), false);
});

Deno.test("validateMetadata - invalid timestamps", () => {
  const metadata: ArticleMetadata = {
    slug: "test-article",
    readingTime: "2 min read",
    introText: "Test intro",
    createdOn: "invalid-date",
    updatedOn: "2024-01-01T00:00:00.000Z",
    wordCount: 100,
    characterCount: 500,
  };

  assertEquals(validateMetadata(metadata), false);
});

Deno.test("generateMetadata - error handling", () => {
  const options: MetadataOptions = {
    title: "Test",
    htmlContent: "", // Empty content that might cause issues
  };

  // Should not throw, but handle gracefully
  const metadata = generateMetadata(options);
  assertEquals(metadata.wordCount, 0);
  assertEquals(metadata.readingTime, "1 min read"); // Minimum
  assertEquals(metadata.introText, "");
});

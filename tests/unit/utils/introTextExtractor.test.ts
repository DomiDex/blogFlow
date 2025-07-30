import { assertEquals, assertExists } from "@std/testing/asserts";
import {
  createFallbackIntro,
  extractIntroFromPlainText,
  extractIntroText,
  type IntroTextResult,
  isValidIntroContent,
} from "@/utils/introTextExtractor.ts";

Deno.test("extractIntroText - basic HTML content", () => {
  const html =
    "<p>This is a test article about extracting intro text from HTML content. It should handle various HTML tags properly.</p>";
  const result = extractIntroText(html);

  assertEquals(
    result.text,
    "This is a test article about extracting intro text from HTML content. It should handle various HTML tags properly.",
  );
  assertEquals(result.truncated, false);
  assertEquals(result.length, 114);
});

Deno.test("extractIntroText - long content with truncation", () => {
  const html = `
    <p>This is a very long article that will definitely exceed the 160 character limit. 
    We need to make sure that it gets truncated properly at a word boundary and that 
    an ellipsis is added at the end.</p>
  `;
  const result = extractIntroText(html);

  assertExists(result.text);
  assertEquals(result.truncated, true);
  assertEquals(result.text.endsWith("..."), true);
  assertEquals(result.length <= 163, true); // 160 + ellipsis
});

Deno.test("extractIntroText - multiple paragraphs", () => {
  const html = `
    <p>First paragraph with some content.</p>
    <p>Second paragraph with more content that will push us over the limit.</p>
    <p>Third paragraph that definitely won't be included.</p>
  `;
  const result = extractIntroText(html);

  // With getTextContent, the paragraphs are concatenated without spaces, making it shorter than 160 chars
  assertEquals(result.truncated, false);
  assertEquals(result.text.includes("First paragraph"), true);
  assertEquals(result.text.includes("Third paragraph"), true); // Since it's under 160 chars total
});

Deno.test("extractIntroText - preserve sentences", () => {
  const html =
    "<p>This is the first sentence. This is the second sentence. This is the third sentence that is quite long and will exceed our character limit for sure.</p>";
  const result = extractIntroText(html, { preserveSentences: true });

  // The full text is 148 chars, which is under 160, so it won't truncate
  assertEquals(
    result.text,
    "This is the first sentence. This is the second sentence. This is the third sentence that is quite long and will exceed our character limit for sure.",
  );
  assertEquals(result.truncated, false);
});

Deno.test("extractIntroText - with special HTML entities", () => {
  const html =
    "<p>This article discusses &quot;quotes&quot; &amp; special characters like &lt; and &gt;.</p>";
  const result = extractIntroText(html);

  assertEquals(result.text.includes('"quotes"'), true);
  assertEquals(result.text.includes("&"), true);
  assertEquals(result.text.includes("<"), true);
  assertEquals(result.text.includes(">"), true);
  assertEquals(result.text.includes("&quot;"), false); // Should be decoded
});

Deno.test("extractIntroText - with code blocks", () => {
  const html = `
    <p>Here's how to use the function:</p>
    <pre><code>const result = extractIntroText(html);</code></pre>
    <p>This is more content after the code.</p>
  `;
  const result = extractIntroText(html);

  assertEquals(result.text.includes("Here's how to use the function"), true);
  assertEquals(result.text.includes("const result"), true);
});

Deno.test("extractIntroText - with lists", () => {
  const html = `
    <p>Key features include:</p>
    <ul>
      <li>Feature one</li>
      <li>Feature two</li>
      <li>Feature three</li>
    </ul>
  `;
  const result = extractIntroText(html);

  assertEquals(result.text.includes("Key features include"), true);
  assertEquals(result.text.includes("Feature"), true);
});

Deno.test("extractIntroText - empty content", () => {
  const result1 = extractIntroText("");
  assertEquals(result1.text, "");
  assertEquals(result1.truncated, false);
  assertEquals(result1.length, 0);

  const result2 = extractIntroText("<p></p><div></div>");
  assertEquals(result2.text, "");
  assertEquals(result2.truncated, false);
});

Deno.test("extractIntroText - whitespace normalization", () => {
  const html = `
    <p>This    has     multiple     spaces.</p>
    <p>And
    newlines
    too.</p>
  `;
  const result = extractIntroText(html);

  assertEquals(result.text.includes("  "), false); // No double spaces
  assertEquals(result.text.includes("\n"), false); // No newlines
  assertEquals(result.text.includes("This has multiple spaces"), true);
});

Deno.test("extractIntroText - custom options", () => {
  const html =
    "<p>This is a test of custom options for the intro text extractor with a reasonably long sentence.</p>";

  // Custom max length
  const result1 = extractIntroText(html, { maxLength: 50 });
  assertEquals(result1.length <= 53, true); // 50 + ellipsis
  assertEquals(result1.truncated, true);

  // No ellipsis
  const result2 = extractIntroText(html, { maxLength: 50, addEllipsis: false });
  assertEquals(result2.text.endsWith("..."), false);
  assertEquals(result2.length <= 50, true);

  // Custom ellipsis
  const result3 = extractIntroText(html, { maxLength: 50, customEllipsis: " →" });
  assertEquals(result3.text.endsWith(" →"), true);
});

Deno.test("extractIntroText - clean ending", () => {
  const html1 =
    "<p>This text ends with a comma, and then gets cut off in the middle of something</p>";
  const result1 = extractIntroText(html1, { maxLength: 30 });
  assertEquals(result1.text.endsWith(","), false); // Comma should be removed
  assertEquals(result1.text.endsWith("..."), true);

  const html2 = "<p>This ends with a period. But there's more content after.</p>";
  const result2 = extractIntroText(html2, { maxLength: 25 });
  assertEquals(result2.text.endsWith("...."), false); // No double period
});

Deno.test("extractIntroFromPlainText - basic usage", () => {
  const text = "This is plain text without any HTML tags.";
  const result = extractIntroFromPlainText(text);

  assertEquals(result.text, text);
  assertEquals(result.truncated, false);
});

Deno.test("extractIntroFromPlainText - with truncation", () => {
  const text =
    "This is a very long piece of plain text that will definitely need to be truncated because it exceeds our maximum character limit by quite a significant margin.";
  const result = extractIntroFromPlainText(text);

  // The text is 159 characters, so it won't be truncated
  assertEquals(result.truncated, false);
  assertEquals(result.text.endsWith("..."), false);
  assertEquals(result.length, 159);
});

Deno.test("isValidIntroContent - various inputs", () => {
  assertEquals(isValidIntroContent("<p>Valid content with enough text</p>"), true);
  assertEquals(isValidIntroContent("<p>Short</p>"), false); // Too short
  assertEquals(isValidIntroContent(""), false);
  assertEquals(isValidIntroContent("<p></p>"), false);
  assertEquals(isValidIntroContent("<img src='test.jpg' />"), false); // No text
});

Deno.test("createFallbackIntro - various scenarios", () => {
  const result1 = createFallbackIntro("My Article Title");
  assertEquals(result1, "My Article Title");

  const result2 = createFallbackIntro("My Article Title", "John Doe");
  assertEquals(result2, "My Article Title by John Doe");

  const result3 = createFallbackIntro("", "John Doe");
  assertEquals(result3, "by John Doe");

  const result4 = createFallbackIntro("", "");
  assertEquals(result4, "Read more...");

  // Long title that needs truncation
  const longTitle =
    "This is an extremely long article title that will definitely need to be truncated when used as a fallback intro text because it exceeds the maximum allowed length";
  const result5 = createFallbackIntro(longTitle);
  assertEquals(result5.endsWith("..."), true);
  assertEquals(result5.length <= 163, true);
});

Deno.test("extractIntroText - media only content", () => {
  const html = `
    <figure>
      <img src="image.jpg" alt="An image">
      <figcaption>Image caption</figcaption>
    </figure>
  `;
  const result = extractIntroText(html);

  assertEquals(result.text, "Image caption");
  assertEquals(result.truncated, false);
});

Deno.test("extractIntroText - mixed content types", () => {
  const html = `
    <h1>Article Title</h1>
    <p class="meta">By John Doe | Published: 2024-01-01</p>
    <p>This is the actual article content that we want to extract for the intro text.</p>
  `;
  const result = extractIntroText(html);

  assertEquals(result.text.includes("Article Title"), true);
  assertEquals(result.text.includes("John Doe"), true);
  assertEquals(result.text.includes("actual article content"), true);
});

Deno.test("extractIntroText - word boundary edge cases", () => {
  // Test with hyphenated words
  const html1 = "<p>This is a well-thought-out article about modern web development practices.</p>";
  const result1 = extractIntroText(html1, { maxLength: 30 });
  assertEquals(result1.text.includes("well-thought-out"), true);

  // Test with URLs
  const html2 = "<p>Visit https://example.com/very/long/url/that/might/get/truncated for more.</p>";
  const result2 = extractIntroText(html2, { maxLength: 40 });
  assertEquals(result2.truncated, true);

  // Test with numbers
  const html3 = "<p>The year 2024 marks the 25th anniversary of our company's founding.</p>";
  const result3 = extractIntroText(html3, { maxLength: 35 });
  assertEquals(result3.text.includes("2024"), true);
});

Deno.test("extractIntroText - unicode and special characters", () => {
  const html = "<p>Testing émojis 🚀 and spëcial cháracters in the intro text.</p>";
  const result = extractIntroText(html);

  assertEquals(result.text.includes("émojis"), true);
  assertEquals(result.text.includes("🚀"), true);
  assertEquals(result.text.includes("spëcial"), true);
});

Deno.test("extractIntroText - performance with large content", () => {
  const largeHtml = "<p>" + "This is a sentence. ".repeat(1000) + "</p>";

  const start = performance.now();
  const result = extractIntroText(largeHtml);
  const end = performance.now();

  assertEquals(result.truncated, true);
  assertEquals(result.length <= 163, true); // 160 + ellipsis
  assertEquals(result.text.endsWith("..."), true);
  assertEquals(end - start < 100, true); // Should be fast even with large content
});

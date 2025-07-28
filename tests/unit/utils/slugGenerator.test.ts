import { assertEquals, assertExists } from "@std/testing/asserts";
import {
  generateSlug,
  isValidSlug,
  generateUniqueSlug,
  extractKeywords,
  createSlugFromKeywords,
  type SlugOptions,
} from "@/utils/slugGenerator.ts";

// Test basic slug generation
Deno.test("generateSlug - basic text", () => {
  assertEquals(generateSlug("Hello World"), "hello-world");
  assertEquals(generateSlug("This is a Test"), "this-is-a-test");
  assertEquals(generateSlug("Simple Title"), "simple-title");
});

Deno.test("generateSlug - special characters", () => {
  assertEquals(generateSlug("Hello & Goodbye"), "hello-and-goodbye");
  assertEquals(generateSlug("50% Off Sale!"), "50-percent-off-sale");
  assertEquals(generateSlug("Email me @ test@example.com"), "email-me-at-testatexample-com");
  assertEquals(generateSlug("Price: $99.99"), "price-dollar99-99");
  assertEquals(generateSlug("#1 Best Seller"), "number1-best-seller");
});

Deno.test("generateSlug - accented characters", () => {
  assertEquals(generateSlug("Café Résumé"), "cafe-resume");
  assertEquals(generateSlug("Naïve Björk"), "naive-bjork");
  assertEquals(generateSlug("Zürich São Paulo"), "zurich-sao-paulo");
  assertEquals(generateSlug("Mañana Señor"), "manana-senor");
  assertEquals(generateSlug("Český Français"), "cesky-francais");
});

Deno.test("generateSlug - unicode normalization", () => {
  // Combined characters vs precomposed
  assertEquals(generateSlug("café"), "cafe"); // é as single character
  assertEquals(generateSlug("café"), "cafe"); // e + combining acute
});

Deno.test("generateSlug - emojis and non-ASCII", () => {
  assertEquals(generateSlug("Hello 👋 World 🌍"), "hello-world");
  assertEquals(generateSlug("🚀 Rocket Launch 🚀"), "rocket-launch");
  assertEquals(generateSlug("I ❤️ Programming"), "i-programming");
  assertEquals(generateSlug("★★★ 5 Stars ★★★"), "5-stars");
});

Deno.test("generateSlug - edge cases", () => {
  assertEquals(generateSlug(""), "");
  assertEquals(generateSlug("   "), "");
  assertEquals(generateSlug("!!!"), "");
  assertEquals(generateSlug("---"), "");
  assertEquals(generateSlug("@#$%^&*()"), "atnumberdollar-percentandstar");
});

Deno.test("generateSlug - multiple spaces and hyphens", () => {
  assertEquals(generateSlug("Too   Many    Spaces"), "too-many-spaces");
  assertEquals(generateSlug("Already-Hyphenated-Text"), "already-hyphenated-text");
  assertEquals(generateSlug("Mixed - Hyphens - And Spaces"), "mixed-hyphens-and-spaces");
  assertEquals(generateSlug("   Leading and Trailing Spaces   "), "leading-and-trailing-spaces");
});

Deno.test("generateSlug - HTML content", () => {
  assertEquals(generateSlug("<h1>Hello World</h1>"), "hello-world");
  assertEquals(generateSlug("Text with <strong>bold</strong> and <em>italic</em>"), "text-with-bold-and-italic");
  assertEquals(generateSlug("<p>Paragraph</p><p>Content</p>"), "paragraph-content");
});

Deno.test("generateSlug - max length", () => {
  const longText = "This is a very long title that should be truncated at the specified maximum length";
  const slug = generateSlug(longText, { maxLength: 30 });
  assert(slug.length <= 30);
  assertEquals(slug, "this-is-a-very-long-title");
});

Deno.test("generateSlug - custom separator", () => {
  assertEquals(generateSlug("Hello World", { separator: "_" }), "hello_world");
  assertEquals(generateSlug("One Two Three", { separator: "--" }), "one--two--three");
  assertEquals(generateSlug("Test Case", { separator: "." }), "test.case");
});

Deno.test("generateSlug - preserve case", () => {
  assertEquals(generateSlug("Hello World", { preserveCase: true }), "Hello-World");
  assertEquals(generateSlug("iPhone Pro Max", { preserveCase: true }), "iPhone-Pro-Max");
  assertEquals(generateSlug("JavaScript ES6", { preserveCase: true }), "JavaScript-ES6");
});

Deno.test("generateSlug - remove stop words", () => {
  assertEquals(generateSlug("The Best of The World", { removeStopWords: true }), "best-world");
  assertEquals(generateSlug("How to Build a Website", { removeStopWords: true }), "build-website");
  assertEquals(generateSlug("This is the Way", { removeStopWords: true }), "way");
  // Should keep text if all words are stop words
  assertEquals(generateSlug("The And Of", { removeStopWords: true }), "the-and-of");
});

Deno.test("generateSlug - custom replacements", () => {
  const customReplacements = new Map([
    ["C\\+\\+", "cpp"],
    ["C#", "csharp"],
    ["\\.NET", "dotnet"],
  ]);
  
  assertEquals(generateSlug("C++ Programming", { customReplacements }), "cpp-programming");
  assertEquals(generateSlug("C# Tutorial", { customReplacements }), "csharp-tutorial");
  assertEquals(generateSlug(".NET Framework", { customReplacements }), "dotnet-framework");
});

Deno.test("generateSlug - complex scenarios", () => {
  const options: SlugOptions = {
    maxLength: 50,
    removeStopWords: true,
    separator: "-",
  };
  
  assertEquals(
    generateSlug("The Ultimate Guide to Building Modern Web Applications with React.js & Next.js!", options),
    "ultimate-guide-building-modern-web-applications"
  );
  
  assertEquals(
    generateSlug("10 Tips & Tricks for $$ Making Money $$ Online in 2024", options),
    "10-tips-tricks-dollardollar-making-money"
  );
});

Deno.test("isValidSlug - valid slugs", () => {
  assertEquals(isValidSlug("hello-world"), true);
  assertEquals(isValidSlug("test-123"), true);
  assertEquals(isValidSlug("valid-slug-example"), true);
  assertEquals(isValidSlug("a"), true);
  assertEquals(isValidSlug("1234567890"), true);
});

Deno.test("isValidSlug - invalid slugs", () => {
  assertEquals(isValidSlug(""), false);
  assertEquals(isValidSlug("Hello World"), false); // Space
  assertEquals(isValidSlug("hello_world"), false); // Underscore (in strict mode)
  assertEquals(isValidSlug("-hello"), false); // Leading hyphen
  assertEquals(isValidSlug("hello-"), false); // Trailing hyphen
  assertEquals(isValidSlug("hello--world"), false); // Double hyphen
  assertEquals(isValidSlug("CAPS-NOT-ALLOWED"), false); // Uppercase in strict mode
});

Deno.test("isValidSlug - with options", () => {
  assertEquals(isValidSlug("hello-world", { maxLength: 5 }), false); // Too long
  assertEquals(isValidSlug("HELLO-WORLD", { strict: false }), true); // Uppercase allowed
  assertEquals(isValidSlug("test", { maxLength: 10 }), true);
});

Deno.test("generateUniqueSlug - no conflicts", () => {
  const existing: string[] = ["hello", "world", "test"];
  assertEquals(generateUniqueSlug("new-slug", existing), "new-slug");
  assertEquals(generateUniqueSlug("Another Title", existing), "another-title");
});

Deno.test("generateUniqueSlug - with conflicts", () => {
  const existing = ["hello-world", "hello-world-1", "hello-world-2"];
  assertEquals(generateUniqueSlug("Hello World", existing), "hello-world-3");
  
  const existing2 = ["test", "test-1", "test-2", "test-3", "test-4"];
  assertEquals(generateUniqueSlug("Test", existing2), "test-5");
});

Deno.test("generateUniqueSlug - max length with suffix", () => {
  const existing = ["hello"];
  const slug = generateUniqueSlug("Hello", existing, { maxLength: 10 });
  assertEquals(slug, "hello-1");
  assert(slug.length <= 10);
  
  // Very long slug that needs truncation
  const longExisting = ["this-is-a-very-long-slug-that-exceeds"];
  const longSlug = generateUniqueSlug(
    "This is a very long slug that exceeds the maximum", 
    longExisting, 
    { maxLength: 40 }
  );
  assert(longSlug.length <= 40);
  assert(longSlug.includes("-1"));
});

Deno.test("extractKeywords - basic extraction", () => {
  const text = "JavaScript is a programming language for web development";
  const keywords = extractKeywords(text);
  assertExists(keywords);
  assert(keywords.includes("javascript"));
  assert(keywords.includes("programming"));
  assert(keywords.includes("web"));
  assert(!keywords.includes("is")); // Stop word
  assert(!keywords.includes("a")); // Stop word
});

Deno.test("extractKeywords - with HTML", () => {
  const html = "<h1>React Tutorial</h1><p>Learn React hooks and components</p>";
  const keywords = extractKeywords(html);
  assert(keywords.includes("react"));
  assert(keywords.includes("tutorial"));
  assert(keywords.includes("hooks"));
  assert(keywords.includes("components"));
});

Deno.test("extractKeywords - frequency ordering", () => {
  const text = "React React React Vue Vue Angular TypeScript TypeScript TypeScript TypeScript";
  const keywords = extractKeywords(text, 3);
  assertEquals(keywords[0], "typescript"); // 4 occurrences
  assertEquals(keywords[1], "react"); // 3 occurrences
  assertEquals(keywords[2], "vue"); // 2 occurrences
});

Deno.test("createSlugFromKeywords - basic", () => {
  assertEquals(createSlugFromKeywords(["react", "tutorial"]), "react-tutorial");
  assertEquals(createSlugFromKeywords(["web", "development", "guide"]), "web-development-guide");
  assertEquals(createSlugFromKeywords([]), "");
});

Deno.test("createSlugFromKeywords - with options", () => {
  const keywords = ["JavaScript", "ES6", "Features"];
  assertEquals(
    createSlugFromKeywords(keywords, { preserveCase: true }), 
    "JavaScript-ES6-Features"
  );
  assertEquals(
    createSlugFromKeywords(keywords, { separator: "_" }), 
    "javascript_es6_features"
  );
});

// Performance test
Deno.test("generateSlug - performance with long text", () => {
  const longText = "Lorem ipsum dolor sit amet ".repeat(100);
  const start = performance.now();
  const slug = generateSlug(longText, { maxLength: 100 });
  const end = performance.now();
  
  assertExists(slug);
  assert(slug.length <= 100);
  assert(end - start < 50); // Should complete in less than 50ms
});

// Unicode edge cases
Deno.test("generateSlug - various unicode scripts", () => {
  assertEquals(generateSlug("Hello 世界"), "hello"); // Chinese
  assertEquals(generateSlug("مرحبا بالعالم"), ""); // Arabic (all non-ASCII)  
  assertEquals(generateSlug("Привет мир"), ""); // Cyrillic (all non-ASCII)
  assertEquals(generateSlug("Hello こんにちは"), "hello"); // Japanese
  assertEquals(generateSlug("Mixed English 한글 Text"), "mixed-english-text"); // Korean
});

// Reserved slugs
Deno.test("generateSlug - handle reserved words", () => {
  // These might be reserved in some systems
  assertEquals(generateSlug("admin"), "admin");
  assertEquals(generateSlug("api"), "api");
  assertEquals(generateSlug("null"), "null");
  assertEquals(generateSlug("undefined"), "undefined");
});

// Helper function for assertions
function assert(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}
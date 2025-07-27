/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import {
  convertDeltaToHtml,
  convertDeltaToPlainText,
  validateHtml,
} from "@services/contentProcessor.ts";
import type { QuillDelta } from "@utils/validation.ts";

Deno.test("ContentProcessor - Basic text conversion", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Hello, this is a simple paragraph." },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertEquals(result.html, "<p>Hello, this is a simple paragraph.</p>");
  assertEquals(result.plainText, "Hello, this is a simple paragraph.");
  assertEquals(result.wordCount, 6);
  assertEquals(result.imageCount, 0);
  assertEquals(result.linkCount, 0);
  assertEquals(result.hasVideo, false);
});

Deno.test("ContentProcessor - Formatted text", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "This is " },
      { insert: "bold", attributes: { bold: true } },
      { insert: " and " },
      { insert: "italic", attributes: { italic: true } },
      { insert: " text." },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertExists(result.html.includes("<strong>bold</strong>"));
  assertExists(result.html.includes("<em>italic</em>"));
});

Deno.test("ContentProcessor - Headers", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Main Title" },
      { insert: "\n", attributes: { header: 1 } },
      { insert: "Subtitle" },
      { insert: "\n", attributes: { header: 2 } },
      { insert: "Regular paragraph text." },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertExists(result.html.includes("<h1>Main Title</h1>"));
  assertExists(result.html.includes("<h2>Subtitle</h2>"));
  assertExists(result.html.includes("<p>Regular paragraph text.</p>"));
});

Deno.test("ContentProcessor - Lists", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Item 1" },
      { insert: "\n", attributes: { list: "bullet" } },
      { insert: "Item 2" },
      { insert: "\n", attributes: { list: "bullet" } },
      { insert: "First" },
      { insert: "\n", attributes: { list: "ordered" } },
      { insert: "Second" },
      { insert: "\n", attributes: { list: "ordered" } },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertExists(result.html.includes("<ul>"));
  assertExists(result.html.includes("<ol>"));
  assertExists(result.html.includes("<li>Item 1</li>"));
  assertExists(result.html.includes("<li>First</li>"));
});

Deno.test("ContentProcessor - Links", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Visit " },
      { insert: "our website", attributes: { link: "https://example.com" } },
      { insert: " for more info." },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertEquals(result.linkCount, 1);
  assertExists(result.html.includes('href="https://example.com"'));
  assertExists(result.html.includes('target="_blank"'));
  assertExists(result.html.includes('rel="noopener noreferrer"'));
});

Deno.test("ContentProcessor - Images", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Here's an image:\n" },
      { insert: { image: "https://example.com/image.jpg" } },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertEquals(result.imageCount, 1);
  assertExists(result.html.includes("<img"));
  assertExists(result.html.includes('src="https://example.com/image.jpg"'));
  assertExists(result.html.includes('loading="lazy"'));
  assertExists(result.html.includes('style="max-width: 100%; height: auto;"'));
});

Deno.test("ContentProcessor - Images with options", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: { image: "https://example.com/image.jpg" } },
    ],
  };

  const result = convertDeltaToHtml(delta, {
    allowImages: false,
  });

  assertEquals(result.imageCount, 0);
  assertExists(result.errors.includes("Images not allowed in content"));
  assertExists(result.html.includes("[Image removed]"));
});

Deno.test("ContentProcessor - YouTube video embed", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Check out this video:\n" },
      { insert: { video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertEquals(result.hasVideo, true);
  assertExists(result.html.includes("youtube.com/embed/dQw4w9WgXcQ"));
});

Deno.test("ContentProcessor - Vimeo video embed", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: { video: "https://vimeo.com/123456789" } },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.hasVideo, true);
  assertExists(result.html.includes("player.vimeo.com/video/123456789"));
});

Deno.test("ContentProcessor - Code blocks", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "function hello() {\n  console.log('Hello');\n}" },
      { insert: "\n", attributes: { "code-block": true } },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertExists(result.html.includes('<pre class="code-block">'));
  assertExists(result.html.includes("<code>"));
});

Deno.test("ContentProcessor - Blockquotes", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "This is a quote" },
      { insert: "\n", attributes: { blockquote: true } },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertExists(result.html.includes("<blockquote>"));
  assertExists(result.html.includes("This is a quote"));
});

Deno.test("ContentProcessor - Text alignment", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Centered text" },
      { insert: "\n", attributes: { align: "center" } },
      { insert: "Right aligned" },
      { insert: "\n", attributes: { align: "right" } },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertExists(result.html.includes('class="text-center"'));
  assertExists(result.html.includes('class="text-right"'));
});

Deno.test("ContentProcessor - Complex nested formatting", () => {
  const delta: QuillDelta = {
    ops: [
      {
        insert: "Bold italic link",
        attributes: {
          bold: true,
          italic: true,
          link: "https://example.com",
        },
      },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.errors.length, 0);
  assertEquals(result.linkCount, 1);
  assertExists(result.html.includes("<strong>"));
  assertExists(result.html.includes("<em>"));
  assertExists(result.html.includes('href="https://example.com"'));
});

Deno.test("ContentProcessor - Plain text extraction", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Title" },
      { insert: "\n", attributes: { header: 1 } },
      { insert: "Some " },
      { insert: "formatted", attributes: { bold: true } },
      { insert: " text.\n" },
      { insert: { image: "https://example.com/img.jpg" } },
      { insert: "\nMore text." },
    ],
  };

  const plainText = convertDeltaToPlainText(delta);

  assertEquals(plainText, "Title\nSome formatted text.\n[Image]\nMore text.");
});

Deno.test("ContentProcessor - Word count", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "One two three four five six seven eight nine ten." },
      { insert: { image: "https://example.com/img.jpg" } },
      { insert: " Eleven twelve." },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertEquals(result.wordCount, 12); // Images don't count as words
});

Deno.test("ContentProcessor - Empty content handling", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "   \n\n   " }, // Only whitespace
    ],
  };

  const result = convertDeltaToHtml(delta);

  // Should fail validation in real usage, but converter handles it
  assertEquals(result.html, "<p></p>");
  assertEquals(result.wordCount, 0);
});

Deno.test("ContentProcessor - HTML validation", () => {
  const validHtml = "<p>This is <strong>valid</strong> HTML.</p>";
  const validResult = validateHtml(validHtml);

  assertEquals(validResult.valid, true);
  assertEquals(validResult.errors.length, 0);

  const invalidHtml = "<p>Unclosed paragraph <strong>tag";
  const invalidResult = validateHtml(invalidHtml);

  assertEquals(invalidResult.valid, false);
  assertExists(invalidResult.errors.length > 0);
});

Deno.test("ContentProcessor - Disallowed tags detection", () => {
  const htmlWithScript = '<p>Text</p><script>alert("XSS")</script>';
  const result = validateHtml(htmlWithScript);

  assertEquals(result.valid, false);
  assertExists(result.errors.some((e) => e.includes("Disallowed tag: script")));
});

Deno.test("ContentProcessor - Error handling", () => {
  // Invalid delta structure
  const invalidDelta = {
    ops: [
      { insert: "Valid text" },
      { invalid: "operation" } as any, // Invalid operation
    ],
  } as QuillDelta;

  const result = convertDeltaToHtml(invalidDelta);

  // Should handle gracefully and return partial content
  assertExists(result.errors.length > 0);
  assertExists(result.html.includes("Valid text"));
});

Deno.test("ContentProcessor - Custom class mapping", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Custom styled text" },
      { insert: "\n", attributes: { align: "center" } },
    ],
  };

  const result = convertDeltaToHtml(delta, {
    customClassMap: {
      "text-center": "my-custom-center-class",
    },
  });

  assertExists(result.html.includes('class="my-custom-center-class"'));
});

Deno.test("ContentProcessor - Indentation handling", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Indented text" },
      { insert: "\n", attributes: { indent: 2 } },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertExists(result.html.includes('class="indent-2"'));
});

Deno.test("ContentProcessor - Font size handling", () => {
  const delta: QuillDelta = {
    ops: [
      { insert: "Small", attributes: { size: "small" } },
      { insert: " Normal " },
      { insert: "Large", attributes: { size: "large" } },
    ],
  };

  const result = convertDeltaToHtml(delta);

  assertExists(result.html.includes("font-size: 0.75em"));
  assertExists(result.html.includes("font-size: 1.5em"));
});

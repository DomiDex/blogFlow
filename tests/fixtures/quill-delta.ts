/**
 * Quill Delta test fixtures
 */

import type { QuillDelta } from "@utils/validation.ts";

export const SIMPLE_DELTA: QuillDelta = {
  ops: [
    { insert: "This is a simple article with enough content to pass validation. It contains multiple sentences and paragraphs to ensure we meet the minimum word count requirement. The content is straightforward without any special formatting, making it ideal for basic testing scenarios. We need to have at least fifty words in total to pass the validation checks that are enforced by the middleware." },
    { insert: "\n" }
  ]
};

export const FORMATTED_DELTA = {
  ops: [
    { insert: "This is " },
    { insert: "bold", attributes: { bold: true } },
    { insert: " and " },
    { insert: "italic", attributes: { italic: true } },
    { insert: " text\n" }
  ]
};

export const COMPLEX_DELTA: QuillDelta = {
  ops: [
    { insert: "Welcome to My Blog Post", attributes: { header: 1 } },
    { insert: "\n\n" },
    { insert: "This is the first paragraph with " },
    { insert: "bold text", attributes: { bold: true } },
    { insert: " and " },
    { insert: "italic text", attributes: { italic: true } },
    { insert: ", as well as " },
    { insert: "a link", attributes: { link: "https://example.com" } },
    { insert: ". This paragraph contains additional content to ensure we meet the minimum word count requirement for article validation. We need at least fifty words to pass the content validation checks.\n\n" },
    { insert: "Here's a list of important points:\n" },
    { insert: "First item with some detailed explanation about why this point matters\n", attributes: { list: "bullet" } },
    { insert: "Second item that includes additional context and information\n", attributes: { list: "bullet" } },
    { insert: "Third item with supporting details and examples\n", attributes: { list: "bullet" } },
    { insert: "\n" },
    { insert: "And a numbered list of steps:\n" },
    { insert: "Step one: Initialize the project with proper configuration\n", attributes: { list: "ordered" } },
    { insert: "Step two: Set up the development environment\n", attributes: { list: "ordered" } },
    { insert: "Step three: Deploy to production\n", attributes: { list: "ordered" } },
    { insert: "\n" },
    { insert: "console.log('Code block example');\nconst result = performOperation();\n", attributes: { "code-block": true } },
    { insert: "\n" },
    { insert: "This final paragraph wraps up our discussion with " },
    { insert: "inline code examples", attributes: { code: true } },
    { insert: " and concludes the article with sufficient content to meet all validation requirements.\n" }
  ]
};

export const MIXED_FORMATTING_DELTA = {
  ops: [
    { insert: "Multiple ", attributes: { bold: true, italic: true } },
    { insert: "formats", attributes: { bold: true, italic: true, underline: true } },
    { insert: " in one", attributes: { strike: true } },
    { insert: "\n" }
  ]
};

export const IMAGE_DELTA: QuillDelta = {
  ops: [
    { insert: "Here's an image:\n" },
    { insert: { image: "https://example.com/image.jpg" }, attributes: { width: 600, alt: "Test image" } },
    { insert: "\n" }
  ]
};

export const VIDEO_DELTA = {
  ops: [
    { insert: "Check out this video:\n" },
    { insert: { video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } },
    { insert: "\n" }
  ]
};

export const BLOCKQUOTE_DELTA = {
  ops: [
    { insert: "As someone once said:\n" },
    { insert: "This is a blockquote\n", attributes: { blockquote: true } },
    { insert: "With multiple lines\n", attributes: { blockquote: true } },
    { insert: "Normal text again\n" }
  ]
};

export const EMPTY_DELTA = {
  ops: []
};

export const NEWLINES_ONLY_DELTA = {
  ops: [
    { insert: "\n\n\n" }
  ]
};

export const SPECIAL_CHARS_DELTA = {
  ops: [
    { insert: "Special chars: <>&\"'`\n" },
    { insert: "Unicode: 你好 مرحبا שלום\n" },
    { insert: "Emojis: 😀 🚀 ❤️\n" }
  ]
};

export const NESTED_LISTS_DELTA = {
  ops: [
    { insert: "Parent list:\n" },
    { insert: "Item 1\n", attributes: { list: "bullet" } },
    { insert: "Item 2\n", attributes: { list: "bullet", indent: 1 } },
    { insert: "Item 3\n", attributes: { list: "bullet", indent: 2 } },
    { insert: "Back to root\n", attributes: { list: "bullet" } }
  ]
};

export const LONG_CONTENT_DELTA = {
  ops: [
    { insert: "Title of the Article", attributes: { header: 1 } },
    { insert: "\n\n" },
    ...Array(50).fill(null).map((_, i) => ({
      insert: `This is paragraph ${i + 1}. It contains some text to make the article longer and test reading time calculations. `
    })),
    { insert: "\n" }
  ]
};

export const MALFORMED_DELTA = {
  ops: "not an array" // Invalid: ops should be an array
};

export const INVALID_ATTRIBUTES_DELTA = {
  ops: [
    { insert: "Text", attributes: { unknown: true, script: "alert('xss')" } },
    { insert: "\n" }
  ]
};

export const INVALID_INSERT_DELTA = {
  ops: [
    { insert: null },
    { insert: 123 },
    { insert: true },
    { insert: "\n" }
  ]
};
import { assertEquals, assertThrows } from "@std/testing/asserts";
import {
  sanitizeHtml,
  sanitizeUserContent,
  stripHtml,
  sanitizeUrl,
  getTextContent,
} from "@/utils/sanitizer.ts";
import { ValidationError } from "@/utils/errors.ts";

Deno.test("sanitizeHtml - basic text formatting", () => {
  const input = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
  const output = sanitizeHtml(input);
  assertEquals(output, '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>');
});

Deno.test("sanitizeHtml - removes script tags", () => {
  const input = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
  const output = sanitizeHtml(input);
  assertEquals(output, '<p>Hello</p><p>World</p>');
});

Deno.test("sanitizeHtml - removes event handlers", () => {
  const input = '<p onclick="alert(\'XSS\')">Click me</p>';
  const output = sanitizeHtml(input);
  assertEquals(output, '<p>Click me</p>');
});

Deno.test("sanitizeHtml - allows safe links", () => {
  const input = '<a href="https://example.com" target="_blank">Link</a>';
  const output = sanitizeHtml(input);
  assertEquals(output, '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>');
});

Deno.test("sanitizeHtml - removes javascript: URLs", () => {
  const input = '<a href="javascript:alert(\'XSS\')">Bad Link</a>';
  const output = sanitizeHtml(input);
  assertEquals(output, '<a>Bad Link</a>');
});

Deno.test("sanitizeHtml - allows safe images", () => {
  const input = '<img src="https://example.com/image.jpg" alt="Test">';
  const output = sanitizeHtml(input);
  assertEquals(output, '<img src="https://example.com/image.jpg" alt="Test" loading="lazy">');
});

Deno.test("sanitizeHtml - removes images with invalid extensions", () => {
  const input = '<img src="https://example.com/script.js" alt="Bad">';
  const output = sanitizeHtml(input);
  assertEquals(output, '<img alt="Bad">');
});

Deno.test("sanitizeHtml - removes data: URLs in images", () => {
  const input = '<img src="data:image/svg+xml;base64,PHN2ZyB..." alt="Bad">';
  const output = sanitizeHtml(input);
  assertEquals(output, '<img alt="Bad">');
});

Deno.test("sanitizeHtml - preserves allowed attributes", () => {
  const input = '<div class="container" id="main"><p class="text">Content</p></div>';
  const output = sanitizeHtml(input);
  assertEquals(output, '<div class="container" id="main"><p class="text">Content</p></div>');
});

Deno.test("sanitizeHtml - handles lists", () => {
  const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
  const output = sanitizeHtml(input);
  assertEquals(output, '<ul><li>Item 1</li><li>Item 2</li></ul>');
});

Deno.test("sanitizeHtml - handles code blocks", () => {
  const input = '<pre><code class="language-js">const x = 1;</code></pre>';
  const output = sanitizeHtml(input);
  assertEquals(output, '<pre><code class="language-js">const x = 1;</code></pre>');
});

Deno.test("sanitizeHtml - removes style tags", () => {
  const input = '<style>body { background: red; }</style><p>Text</p>';
  const output = sanitizeHtml(input);
  assertEquals(output, '<p>Text</p>');
});

Deno.test("sanitizeHtml - removes form elements", () => {
  const input = '<form><input type="text"><button>Submit</button></form>';
  const output = sanitizeHtml(input);
  assertEquals(output, '');
});

Deno.test("sanitizeHtml - handles empty input", () => {
  assertEquals(sanitizeHtml(""), "");
  assertEquals(sanitizeHtml("   "), "");
});

Deno.test("sanitizeHtml - handles null/undefined gracefully", () => {
  // @ts-ignore - testing runtime behavior
  assertEquals(sanitizeHtml(null), "");
  // @ts-ignore - testing runtime behavior
  assertEquals(sanitizeHtml(undefined), "");
});

Deno.test("sanitizeUserContent - more restrictive than sanitizeHtml", () => {
  const input = '<h1>Title</h1><img src="test.jpg"><p>Text</p>';
  const output = sanitizeUserContent(input);
  // When DOMPurify removes disallowed tags, it keeps their text content by default
  // So h1 content "Title" becomes text, img is removed completely, p is kept
  assertEquals(output, 'Title<p>Text</p>');
});

Deno.test("sanitizeUserContent - allows limited headings", () => {
  const input = '<h1>No</h1><h2>Yes</h2><h3>Yes</h3><h4>Yes</h4>';
  const output = sanitizeUserContent(input);
  // h1 content "No" becomes text, h2/h3/h4 are kept
  assertEquals(output, 'No<h2>Yes</h2><h3>Yes</h3><h4>Yes</h4>');
});

Deno.test("sanitizeUserContent - blocks media elements", () => {
  const input = '<img src="test.jpg"><video src="test.mp4"></video><audio src="test.mp3"></audio>';
  const output = sanitizeUserContent(input);
  assertEquals(output, '');
});

Deno.test("stripHtml - removes all HTML tags", () => {
  const input = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
  const output = stripHtml(input);
  assertEquals(output, 'This is bold and italic text.');
});

Deno.test("stripHtml - handles nested tags", () => {
  const input = '<div><p>Paragraph <span>with <strong>nested</strong> tags</span></p></div>';
  const output = stripHtml(input);
  assertEquals(output, 'Paragraph with nested tags');
});

Deno.test("stripHtml - handles empty input", () => {
  assertEquals(stripHtml(""), "");
  assertEquals(stripHtml("   "), "");
});

Deno.test("sanitizeUrl - allows valid URLs", () => {
  assertEquals(sanitizeUrl("https://example.com"), "https://example.com");
  assertEquals(sanitizeUrl("http://example.com/path"), "http://example.com/path");
  assertEquals(sanitizeUrl("mailto:test@example.com"), "mailto:test@example.com");
});

Deno.test("sanitizeUrl - trims whitespace", () => {
  assertEquals(sanitizeUrl("  https://example.com  "), "https://example.com");
});

Deno.test("sanitizeUrl - rejects javascript: URLs", () => {
  assertThrows(
    () => sanitizeUrl("javascript:alert('XSS')"),
    ValidationError,
    "Invalid URL format"
  );
});

Deno.test("sanitizeUrl - rejects data: URLs", () => {
  assertThrows(
    () => sanitizeUrl("data:text/html,<script>alert('XSS')</script>"),
    ValidationError,
    "Invalid URL format"
  );
});

Deno.test("sanitizeUrl - handles empty input", () => {
  assertEquals(sanitizeUrl(""), "");
  // @ts-ignore - testing runtime behavior
  assertEquals(sanitizeUrl(null), "");
});

Deno.test("getTextContent - extracts text and normalizes whitespace", () => {
  const input = '<p>Multiple   spaces</p>\n\n<p>And\nnewlines</p>';
  const output = getTextContent(input);
  assertEquals(output, 'Multiple spaces And newlines');
});

Deno.test("getTextContent - handles complex HTML", () => {
  const input = `
    <article>
      <h1>Title</h1>
      <p>First paragraph with <strong>bold</strong> text.</p>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    </article>
  `;
  const output = getTextContent(input);
  assertEquals(output, 'Title First paragraph with bold text. Item 1 Item 2');
});

// XSS attack vectors tests
Deno.test("sanitizeHtml - XSS vector: IMG onerror", () => {
  const input = '<img src="x" onerror="alert(\'XSS\')">';
  const output = sanitizeHtml(input);
  assertEquals(output, '<img>'); // src removed because 'x' is not valid
});

Deno.test("sanitizeHtml - XSS vector: SVG", () => {
  const input = '<svg onload="alert(\'XSS\')"></svg>';
  const output = sanitizeHtml(input);
  assertEquals(output, ''); // svg not in allowed tags
});

Deno.test("sanitizeHtml - XSS vector: iframe", () => {
  const input = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
  const output = sanitizeHtml(input);
  assertEquals(output, ''); // iframe not allowed
});

Deno.test("sanitizeHtml - XSS vector: object", () => {
  const input = '<object data="data:text/html,<script>alert(\'XSS\')</script>"></object>';
  const output = sanitizeHtml(input);
  assertEquals(output, ''); // object not allowed
});

Deno.test("sanitizeHtml - XSS vector: link tag", () => {
  const input = '<link rel="stylesheet" href="javascript:alert(\'XSS\')">';
  const output = sanitizeHtml(input);
  assertEquals(output, ''); // link not allowed
});

Deno.test("sanitizeHtml - preserves table structure", () => {
  const input = `
    <table>
      <thead>
        <tr><th>Header 1</th><th>Header 2</th></tr>
      </thead>
      <tbody>
        <tr><td>Cell 1</td><td>Cell 2</td></tr>
      </tbody>
    </table>
  `;
  const output = sanitizeHtml(input).replace(/\s+/g, ' ').trim();
  const expected = '<table> <thead> <tr><th>Header 1</th><th>Header 2</th></tr> </thead> <tbody> <tr><td>Cell 1</td><td>Cell 2</td></tr> </tbody> </table>';
  assertEquals(output, expected);
});
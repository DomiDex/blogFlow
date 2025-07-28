import { assertEquals, assertExists } from "@std/testing/asserts";
import {
  calculateReadingTime,
  calculatePlainTextReadingTime,
  analyzeContent,
  countWords,
  formatReadingTime,
  READING_SPEEDS,
  ELEMENT_TIMES,
} from "@/utils/readingTime.ts";

// Test data
const simpleHtml = `
  <p>This is a simple paragraph with some basic text content that should be easy to read.</p>
  <p>Another paragraph here with more content to increase the word count for testing purposes.</p>
`;

const technicalHtml = `
  <p>This article discusses the implementation of asynchronous JavaScript promises and callbacks.</p>
  <p>We'll explore how the algorithm optimizes performance through recursive function calls.</p>
  <p>The architecture uses microservices deployed with Docker and Kubernetes orchestration.</p>
`;

const codeHtml = `
  <p>Here's how to implement a fibonacci function:</p>
  <pre><code>
  function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
  }
  </code></pre>
  <p>This recursive implementation has exponential time complexity.</p>
`;

const listHtml = `
  <h2>Shopping List</h2>
  <ul>
    <li>Apples</li>
    <li>Bananas</li>
    <li>Oranges</li>
    <li>Grapes</li>
  </ul>
  <p>Don't forget to check the expiration dates.</p>
`;

const complexHtml = `
  <h1>Advanced Machine Learning Algorithms</h1>
  <p>This tutorial covers implementation of neural networks using TensorFlow and PyTorch frameworks.</p>
  
  <h2>Mathematical Foundation</h2>
  <div class="math">∇f(x) = lim(h→0) [f(x+h) - f(x)]/h</div>
  
  <pre><code>
  import tensorflow as tf
  import numpy as np
  
  class NeuralNetwork:
      def __init__(self, layers):
          self.layers = layers
          self.weights = self.initialize_weights()
      
      def forward_propagation(self, X):
          activation = X
          for w in self.weights:
              activation = tf.nn.relu(tf.matmul(activation, w))
          return activation
  </code></pre>
  
  <img src="diagram1.png" alt="Network Architecture">
  <img src="diagram2.png" alt="Training Process">
  
  <table>
    <tr><th>Algorithm</th><th>Complexity</th></tr>
    <tr><td>Gradient Descent</td><td>O(n)</td></tr>
  </table>
`;

Deno.test("countWords - basic text", () => {
  assertEquals(countWords("Hello world"), 2);
  assertEquals(countWords("This is a test sentence"), 5);
  assertEquals(countWords("   Multiple   spaces   between   words   "), 4);
});

Deno.test("countWords - edge cases", () => {
  assertEquals(countWords(""), 0);
  assertEquals(countWords("   "), 0);
  assertEquals(countWords("\n\t\r"), 0);
  assertEquals(countWords("SingleWord"), 1);
});

Deno.test("formatReadingTime - various durations", () => {
  assertEquals(formatReadingTime(0), "1 min read");
  assertEquals(formatReadingTime(1), "1 min read");
  assertEquals(formatReadingTime(2), "2 min read");
  assertEquals(formatReadingTime(15), "15 min read");
  assertEquals(formatReadingTime(60), "60 min read");
});

Deno.test("calculatePlainTextReadingTime - basic calculation", () => {
  const text = "Lorem ipsum ".repeat(238); // 476 words, ~2 minutes at 238 WPM
  const result = calculatePlainTextReadingTime(text);
  
  assertEquals(result.minutes, 2);
  assertEquals(result.time, "2 min read");
  assertEquals(result.words, 476);
  assertExists(result.analysis);
});

Deno.test("calculatePlainTextReadingTime - custom WPM", () => {
  const text = "word ".repeat(200); // 200 words
  const result = calculatePlainTextReadingTime(text, 100); // 100 WPM
  
  assertEquals(result.minutes, 2);
  assertEquals(result.time, "2 min read");
});

Deno.test("calculatePlainTextReadingTime - minimum time", () => {
  const result = calculatePlainTextReadingTime("Short text");
  
  assertEquals(result.minutes, 1);
  assertEquals(result.time, "1 min read");
});

Deno.test("analyzeContent - simple HTML", () => {
  const analysis = analyzeContent(simpleHtml);
  
  assertExists(analysis);
  assertEquals(analysis.complexity, "simple");
  assertEquals(analysis.imageCount, 0);
  assertEquals(analysis.codeBlockCount, 0);
  assertEquals(analysis.hasMath, false);
  assert(analysis.totalWords > 0);
  assert(analysis.textWords > 0);
});

Deno.test("analyzeContent - technical content", () => {
  const analysis = analyzeContent(technicalHtml);
  
  assertEquals(analysis.complexity, "complex");
  assert(analysis.technicalWords > 0);
  assert(analysis.technicalWords < analysis.totalWords);
});

Deno.test("analyzeContent - code blocks", () => {
  const analysis = analyzeContent(codeHtml);
  
  assertEquals(analysis.codeBlockCount, 1);
  assert(analysis.codeWords > 0);
  assert(["moderate", "complex"].includes(analysis.complexity));
});

Deno.test("analyzeContent - lists", () => {
  const analysis = analyzeContent(listHtml);
  
  assert(analysis.listWords > 0);
  assertEquals(analysis.listWords, 4); // 4 list items
});

Deno.test("analyzeContent - complex content", () => {
  const analysis = analyzeContent(complexHtml);
  
  assertEquals(analysis.complexity, "complex");
  assertEquals(analysis.imageCount, 2);
  assertEquals(analysis.tableCount, 1);
  assertEquals(analysis.codeBlockCount, 1);
  assertEquals(analysis.hasMath, true);
  assert(analysis.technicalWords > 0);
});

Deno.test("calculateReadingTime - simple content", () => {
  const result = calculateReadingTime(simpleHtml);
  
  assertExists(result);
  assertEquals(result.minutes, 1); // Short content, minimum 1 minute
  assertEquals(result.time, "1 min read");
  assert(result.words > 0);
});

Deno.test("calculateReadingTime - with images", () => {
  const htmlWithImages = `
    <p>${"word ".repeat(100)}</p>
    <img src="image1.jpg">
    <img src="image2.jpg">
    <img src="image3.jpg">
  `;
  
  const result = calculateReadingTime(htmlWithImages);
  
  // 100 words (~0.42 min) + 3 images (36 seconds = 0.6 min) = ~1 min
  assert(result.minutes >= 1);
});

Deno.test("calculateReadingTime - with code blocks", () => {
  const result = calculateReadingTime(codeHtml);
  
  // Code reads slower than regular text
  assert(result.minutes >= 1);
  assertExists(result.analysis);
  assertEquals(result.analysis.codeBlockCount, 1);
});

Deno.test("calculateReadingTime - complex content timing", () => {
  const result = calculateReadingTime(complexHtml);
  
  // Complex content with images, tables, code, and math should take longer
  assert(result.minutes >= 2);
  assertEquals(result.analysis.complexity, "complex");
});

Deno.test("calculateReadingTime - custom options", () => {
  const text = `<p>${"word ".repeat(200)}</p>`;
  
  const result = calculateReadingTime(text, {
    wordsPerMinute: 100,
    minimumTime: 3,
  });
  
  // 200 words at 100 WPM = 2 minutes, but minimum is 3
  assertEquals(result.minutes, 3);
});

Deno.test("calculateReadingTime - error handling", () => {
  // Invalid HTML should still return a result
  const result = calculateReadingTime("<p>Invalid <strong>HTML");
  
  assertExists(result);
  assert(result.minutes >= 1);
  assert(result.words >= 0);
});

Deno.test("calculateReadingTime - empty content", () => {
  const result = calculateReadingTime("");
  
  assertEquals(result.minutes, 1);
  assertEquals(result.time, "1 min read");
  assertEquals(result.words, 0);
});

Deno.test("calculateReadingTime - without analysis", () => {
  const result = calculateReadingTime(simpleHtml, { includeAnalysis: false });
  
  assertExists(result);
  assertExists(result.minutes);
  assertExists(result.time);
  assertExists(result.words);
  assertEquals(result.analysis, undefined);
});

Deno.test("Reading speeds configuration", () => {
  assertEquals(READING_SPEEDS.text, 238);
  assertEquals(READING_SPEEDS.technical, 200);
  assertEquals(READING_SPEEDS.code, 150);
  assertEquals(READING_SPEEDS.list, 250);
});

Deno.test("Element times configuration", () => {
  assertEquals(ELEMENT_TIMES.image, 12);
  assertEquals(ELEMENT_TIMES.table, 15);
});

Deno.test("calculateReadingTime - long article", () => {
  const longArticle = `
    <h1>Long Technical Article</h1>
    <p>${"This is a sentence about programming and algorithms. ".repeat(100)}</p>
    <pre><code>${"const code = 'example';\n".repeat(20)}</code></pre>
    <p>${"More content about implementation and architecture. ".repeat(50)}</p>
    <img src="diagram.png">
    <table><tr><td>Data</td></tr></table>
  `;
  
  const result = calculateReadingTime(longArticle);
  
  // Should be several minutes for this long content
  assert(result.minutes >= 5);
  assert(result.analysis.totalWords > 500);
  // Article has technical terms and code, should be moderate or complex
  assert(["moderate", "complex"].includes(result.analysis.complexity));
});

// Helper function for assertions
function assert(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}
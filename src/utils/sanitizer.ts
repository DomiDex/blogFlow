import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { ContentProcessingError, ValidationError } from "./errors.ts";

const window = new JSDOM("").window;
// @ts-ignore - DOMPurify types don't perfectly match JSDOM window
const purify = DOMPurify(window);

/**
 * Allowed HTML tags for article content
 */
const ALLOWED_TAGS = [
  // Text formatting
  "p", "br", "strong", "em", "u", "s", "mark", "small", "sub", "sup",
  // Headings
  "h1", "h2", "h3", "h4", "h5", "h6",
  // Lists
  "ul", "ol", "li",
  // Quotes and code
  "blockquote", "pre", "code", "kbd",
  // Links and media
  "a", "img",
  // Semantic elements
  "div", "span", "section", "article", "aside", "nav",
  // Tables (if needed for articles)
  "table", "thead", "tbody", "tr", "th", "td",
];

/**
 * Allowed HTML attributes per tag
 */
const ALLOWED_ATTR: Record<string, string[]> = {
  a: ["href", "target", "rel", "title"],
  img: ["src", "alt", "width", "height", "loading", "title"],
  blockquote: ["cite"],
  code: ["class"], // For syntax highlighting
  pre: ["class"], // For syntax highlighting
  "*": ["class", "id"], // Allow class and id on all elements
};

/**
 * URL schemes allowed in href and src attributes
 */
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

/**
 * Image file extensions allowed
 */
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

/**
 * Validate if a URL is safe for use in href attributes
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http, https, and mailto protocols
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    // Relative URLs are allowed
    return !url.startsWith("javascript:") && !url.startsWith("data:");
  }
}

/**
 * Validate if an image URL is safe and has allowed extension
 */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http and https for images
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }
    // Check file extension
    const pathname = parsed.pathname.toLowerCase();
    return ALLOWED_IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    // For relative URLs, just check extension
    const lowerUrl = url.toLowerCase();
    return ALLOWED_IMAGE_EXTENSIONS.some(ext => lowerUrl.endsWith(ext)) &&
           !url.startsWith("javascript:") && !url.startsWith("data:");
  }
}

/**
 * DOMPurify configuration
 */
// Build flat array of allowed attributes
const allowedAttrs: string[] = [];
for (const [tag, attrs] of Object.entries(ALLOWED_ATTR)) {
  if (tag === "*") {
    allowedAttrs.push(...attrs);
  } else {
    attrs.forEach(attr => allowedAttrs.push(attr));
  }
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: allowedAttrs,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SAFE_FOR_TEMPLATES: true,
  WHOLE_DOCUMENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  FORCE_BODY: true,
  SANITIZE_DOM: true,
  KEEP_CONTENT: true,
  ALLOWED_URI_REGEXP,
};

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }
  
  // Handle whitespace-only strings
  if (!html.trim()) {
    return "";
  }

  try {
    // Add custom hooks for additional validation
    purify.addHook("uponSanitizeAttribute", (node, data) => {
      // Validate URLs in href attributes
      if (data.attrName === "href" && data.attrValue) {
        if (!isValidUrl(data.attrValue)) {
          data.keepAttr = false;
        }
      }

      // Validate image URLs
      if (data.attrName === "src" && node.tagName === "IMG" && data.attrValue) {
        if (!isValidImageUrl(data.attrValue)) {
          data.keepAttr = false;
        }
      }

      // Add rel="noopener noreferrer" to external links
      if (data.attrName === "target" && data.attrValue === "_blank") {
        node.setAttribute("rel", "noopener noreferrer");
      }

      // Add loading="lazy" to images only if src is valid
      if (node.tagName === "IMG" && data.attrName === "src" && data.keepAttr !== false) {
        node.setAttribute("loading", "lazy");
      }
    });

    // Remove dangerous elements even if they're in allowed tags
    purify.addHook("uponSanitizeElement", (node, data) => {
      // Remove script tags completely
      if (data.tagName === "script") {
        node.remove();
      }

      // Remove style tags
      if (data.tagName === "style") {
        node.remove();
      }

      // Remove meta tags
      if (data.tagName === "meta") {
        node.remove();
      }

      // Remove form elements
      if (["form", "input", "button", "select", "textarea"].includes(data.tagName)) {
        node.remove();
      }
    });

    // Sanitize the HTML
    const clean = purify.sanitize(html, PURIFY_CONFIG);

    // Remove all hooks after sanitization
    purify.removeAllHooks();

    return String(clean);
  } catch (error) {
    throw new ContentProcessingError(
      "Failed to sanitize HTML content",
      "SANITIZATION_ERROR",
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Sanitize HTML with strict settings for user-generated content
 */
export function sanitizeUserContent(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }
  
  // Handle whitespace-only strings
  if (!html.trim()) {
    return "";
  }

  // Create a separate DOMPurify instance for user content
  const userWindow = new JSDOM("").window;
  // @ts-ignore - DOMPurify types don't perfectly match JSDOM window
  const userPurify = DOMPurify(userWindow);

  // More restrictive config for user content
  const strictConfig = {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s",
      "h2", "h3", "h4", // No h1 for user content
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "a", // No images in user content
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "title", "class", "id", "cite"],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    FORCE_BODY: true,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true, // Let DOMPurify handle content normally
    ALLOWED_URI_REGEXP,
  };

  try {
    const clean = userPurify.sanitize(html, strictConfig);
    return String(clean);
  } catch (error) {
    throw new ContentProcessingError(
      "Failed to sanitize user content",
      "SANITIZATION_ERROR",
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Strip all HTML tags and return plain text
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  try {
    // Use DOMPurify to parse HTML safely, then extract text content
    const doc = new JSDOM(html).window.document;
    return doc.body.textContent || "";
  } catch {
    // Fallback: basic regex stripping
    return html.replace(/<[^>]*>/g, "").trim();
  }
}

/**
 * Sanitize and validate a single URL
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim();
  if (!isValidUrl(trimmed)) {
    throw new ValidationError(
      "Invalid URL format",
      "url",
      trimmed
    );
  }

  return trimmed;
}

/**
 * Get text content from HTML with normalized whitespace
 */
export function getTextContent(html: string): string {
  const text = stripHtml(html);
  // Normalize whitespace: multiple spaces/newlines to single space
  return text.replace(/\s+/g, " ").trim();
}
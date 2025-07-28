/// <reference lib="deno.ns" />
import { logger } from "@utils/logger.ts";

/**
 * Options for slug generation
 */
export interface SlugOptions {
  maxLength?: number;
  separator?: string;
  lowercase?: boolean;
  removeStopWords?: boolean;
  preserveCase?: boolean;
  customReplacements?: Map<string, string>;
  strict?: boolean;
  locale?: string;
}

/**
 * Default configuration
 */
const DEFAULT_OPTIONS: Required<SlugOptions> = {
  maxLength: 80,
  separator: "-",
  lowercase: true,
  removeStopWords: false,
  preserveCase: false,
  customReplacements: new Map(),
  strict: true,
  locale: "en",
};

/**
 * Common English stop words to remove for SEO optimization
 */
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
  "to", "was", "will", "with", "the", "this", "but", "they", "have",
  "had", "what", "when", "where", "who", "which", "why", "how",
  "can", "could", "should", "would", "may", "might", "must", "shall",
  "will", "do", "does", "did", "has", "have", "had", "having",
]);

/**
 * Character replacement map for common special characters
 */
const CHAR_REPLACEMENTS = new Map([
  // Currency symbols
  ["$", "dollar"],
  ["€", "euro"],
  ["£", "pound"],
  ["¥", "yen"],
  ["¢", "cent"],
  
  // Common symbols
  ["&", "and"],
  ["+", "plus"],
  ["@", "at"],
  ["%", " percent"],
  ["#", "number"],
  ["*", "star"],
  
  // Punctuation that should become spaces
  [".", " "],
  [",", " "],
  [":", " "],
  [";", " "],
  ["!", " "],
  ["?", " "],
  ["(", " "],
  [")", " "],
  ["[", " "],
  ["]", " "],
  ["{", " "],
  ["}", " "],
  ["<", " "],
  [">", " "],
  ["|", " "],
  ["\\", " "],
  ["/", " "],
  ["\"", " "],
  ["'", " "],
  ["`", " "],
  ["~", " "],
  ["=", " "],
]);

/**
 * Accent character map for normalization
 */
const ACCENT_MAP = new Map([
  ["à", "a"], ["á", "a"], ["ä", "a"], ["â", "a"], ["ã", "a"], ["å", "a"], ["ā", "a"],
  ["è", "e"], ["é", "e"], ["ë", "e"], ["ê", "e"], ["ē", "e"], ["ė", "e"], ["ę", "e"],
  ["ì", "i"], ["í", "i"], ["ï", "i"], ["î", "i"], ["ī", "i"], ["į", "i"],
  ["ò", "o"], ["ó", "o"], ["ö", "o"], ["ô", "o"], ["õ", "o"], ["ø", "o"], ["ō", "o"],
  ["ù", "u"], ["ú", "u"], ["ü", "u"], ["û", "u"], ["ū", "u"], ["ů", "u"],
  ["ñ", "n"], ["ň", "n"], ["ń", "n"],
  ["ç", "c"], ["č", "c"], ["ć", "c"],
  ["ž", "z"], ["ź", "z"], ["ż", "z"],
  ["š", "s"], ["ś", "s"], ["ș", "s"],
  ["ł", "l"], ["ľ", "l"], ["ĺ", "l"],
  ["ý", "y"], ["ÿ", "y"],
  ["đ", "d"], ["ď", "d"],
  ["ř", "r"], ["ŕ", "r"],
  ["ť", "t"], ["ț", "t"],
  ["ß", "ss"],
  ["æ", "ae"],
  ["œ", "oe"],
]);

/**
 * Generate a SEO-friendly slug from text
 */
export function generateSlug(text: string, options: SlugOptions = {}): string {
  if (!text || typeof text !== "string") {
    logger.warn("Invalid input for slug generation", { input: text });
    return "";
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  let slug = text.trim();

  // Apply custom replacements first
  if (opts.customReplacements.size > 0) {
    opts.customReplacements.forEach((replacement, pattern) => {
      slug = slug.replace(new RegExp(pattern, "g"), replacement);
    });
  }

  // Normalize Unicode characters
  slug = normalizeUnicode(slug);

  // Remove HTML tags if present
  slug = removeHtmlTags(slug);

  // Replace accented characters
  slug = replaceAccents(slug);

  // Apply character replacements
  slug = applyCharReplacements(slug);

  // Remove emojis and other non-ASCII characters
  if (opts.strict) {
    slug = removeNonAscii(slug);
  }

  // Convert to lowercase
  if (opts.lowercase && !opts.preserveCase) {
    slug = slug.toLowerCase();
  }

  // Remove stop words if requested
  if (opts.removeStopWords) {
    slug = removeStopWords(slug);
  }

  // Replace spaces and clean up
  slug = slug
    .trim()
    .replace(/\s+/g, opts.separator) // Replace spaces with separator
    .replace(new RegExp(`\\${opts.separator}+`, "g"), opts.separator) // Remove multiple separators
    .replace(new RegExp(`^\\${opts.separator}+|\\${opts.separator}+$`, "g"), ""); // Remove leading/trailing separators

  // Remove any remaining special characters
  if (opts.strict) {
    const allowedChars = `[^a-z0-9\\${opts.separator}]`;
    slug = slug.replace(new RegExp(allowedChars, "gi"), "");
  }

  // Clean up multiple separators again after character removal
  slug = slug
    .replace(new RegExp(`\\${opts.separator}+`, "g"), opts.separator)
    .replace(new RegExp(`^\\${opts.separator}+|\\${opts.separator}+$`, "g"), "");

  // Truncate to max length
  if (opts.maxLength && slug.length > opts.maxLength) {
    slug = truncateSlug(slug, opts.maxLength, opts.separator);
  }

  // Final cleanup
  slug = slug.replace(new RegExp(`\\${opts.separator}+$`, "g"), "");

  logger.debug("Generated slug", {
    original: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
    slug,
    length: slug.length,
    options: {
      maxLength: opts.maxLength,
      removeStopWords: opts.removeStopWords,
    },
  });

  return slug;
}

/**
 * Normalize Unicode characters
 */
function normalizeUnicode(text: string): string {
  // Normalize to NFD (Canonical Decomposition)
  // This separates base characters from combining characters
  return text.normalize("NFD");
}

/**
 * Remove HTML tags from text
 */
function removeHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Replace accented characters with their ASCII equivalents
 */
function replaceAccents(text: string): string {
  // First, handle characters from the accent map
  let result = text;
  ACCENT_MAP.forEach((replacement, char) => {
    result = result.replace(new RegExp(char, "g"), replacement);
  });

  // Then remove any remaining combining diacritical marks
  // This handles cases not in our map
  result = result.replace(/[\u0300-\u036f]/g, "");

  return result;
}

/**
 * Apply character replacements
 */
function applyCharReplacements(text: string): string {
  let result = text;
  CHAR_REPLACEMENTS.forEach((replacement, char) => {
    // Escape special regex characters
    const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escapedChar, "g"), replacement);
  });
  return result;
}

/**
 * Remove non-ASCII characters (including emojis)
 */
function removeNonAscii(text: string): string {
  // Keep only printable ASCII characters (0x20-0x7E), spaces, and hyphens
  return text.replace(/[^\x20-\x7E\s-]/g, "");
}

/**
 * Remove stop words from text
 */
function removeStopWords(text: string): string {
  const words = text.split(/\s+/);
  const filtered = words.filter(word => {
    const lowercaseWord = word.toLowerCase();
    return !STOP_WORDS.has(lowercaseWord) || word.length === 0;
  });
  
  // If all words were stop words, return original text
  if (filtered.length === 0) {
    return text;
  }
  
  return filtered.join(" ");
}

/**
 * Truncate slug intelligently at word boundaries
 */
function truncateSlug(slug: string, maxLength: number, separator: string): string {
  if (slug.length <= maxLength) {
    return slug;
  }

  // Try to cut at a separator
  const truncated = slug.substring(0, maxLength);
  const lastSeparator = truncated.lastIndexOf(separator);
  
  // If we found a separator and it's not too far from the end
  if (lastSeparator > maxLength * 0.7) {
    return truncated.substring(0, lastSeparator);
  }
  
  // Otherwise, just truncate at maxLength
  return truncated;
}

/**
 * Validate if a string is a valid slug
 */
export function isValidSlug(slug: string, options: SlugOptions = {}): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (!slug || typeof slug !== "string") {
    return false;
  }

  // Check length
  if (opts.maxLength && slug.length > opts.maxLength) {
    return false;
  }

  // Check for valid characters
  const validPattern = opts.strict
    ? /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    : /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;
    
  return validPattern.test(slug);
}

/**
 * Generate a unique slug by appending a number if needed
 */
export function generateUniqueSlug(
  text: string,
  existingSlugs: string[],
  options: SlugOptions = {}
): string {
  const baseSlug = generateSlug(text, options);
  
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  // Find a unique slug by appending numbers
  let counter = 1;
  let uniqueSlug = baseSlug;
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  while (existingSlugs.includes(uniqueSlug)) {
    const suffix = `${opts.separator}${counter}`;
    const maxBaseLength = opts.maxLength - suffix.length;
    
    // Truncate base slug if needed to accommodate suffix
    const truncatedBase = baseSlug.length > maxBaseLength
      ? truncateSlug(baseSlug, maxBaseLength, opts.separator)
      : baseSlug;
      
    uniqueSlug = `${truncatedBase}${suffix}`;
    counter++;

    // Safety check to prevent infinite loops
    if (counter > 1000) {
      // Use timestamp as last resort
      uniqueSlug = `${truncatedBase}${opts.separator}${Date.now()}`;
      break;
    }
  }

  return uniqueSlug;
}

/**
 * Extract keywords from text for SEO-friendly slugs
 */
export function extractKeywords(text: string, maxKeywords: number = 5): string[] {
  // Remove HTML tags
  const cleanText = removeHtmlTags(text);
  
  // Split into words and normalize
  const words = cleanText
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^a-z0-9]/g, ""))
    .filter(word => word.length > 2); // Remove very short words
  
  // Remove stop words
  const keywords = words.filter(word => !STOP_WORDS.has(word));
  
  // Count frequency
  const frequency = new Map<string, number>();
  keywords.forEach(word => {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  });
  
  // Sort by frequency and return top keywords
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Create a slug from keywords
 */
export function createSlugFromKeywords(
  keywords: string[],
  options: SlugOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const text = keywords.join(" ");
  return generateSlug(text, opts);
}
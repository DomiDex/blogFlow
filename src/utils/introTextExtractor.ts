/// <reference lib="deno.ns" />
import { logger } from "@utils/logger.ts";
import { getTextContent } from "@utils/sanitizer.ts";

/**
 * Configuration constants for intro text extraction
 */
const CONFIG = {
  // Maximum length for intro text
  MAX_LENGTH: 160,
  // Minimum length to consider adding ellipsis
  MIN_LENGTH_FOR_ELLIPSIS: 20,
  // Characters to trim from the end before ellipsis
  TRIM_CHARS: [".", ",", ":", ";", "!", "?", "-", "—"],
  // Default ellipsis
  ELLIPSIS: "...",
};

/**
 * Options for intro text extraction
 */
export interface IntroTextOptions {
  maxLength?: number;
  addEllipsis?: boolean;
  preserveSentences?: boolean;
  customEllipsis?: string;
}

/**
 * Result of intro text extraction
 */
export interface IntroTextResult {
  text: string;
  length: number;
  truncated: boolean;
  sourceLength: number;
}

/**
 * Extract intro text from HTML content
 */
export function extractIntroText(
  htmlContent: string,
  options: IntroTextOptions = {},
): IntroTextResult {
  const {
    maxLength = CONFIG.MAX_LENGTH,
    addEllipsis = true,
    preserveSentences = true,
    customEllipsis = CONFIG.ELLIPSIS,
  } = options;

  try {
    // Get text content with proper spacing preserved
    const plainText = getTextContent(htmlContent);

    // Normalize whitespace
    const normalizedText = normalizeWhitespace(plainText);

    // Handle empty or short content
    if (!normalizedText || normalizedText.length <= maxLength) {
      return {
        text: normalizedText,
        length: normalizedText.length,
        truncated: false,
        sourceLength: normalizedText.length,
      };
    }

    // Extract and truncate text
    let introText = normalizedText;
    let truncated = false;

    if (preserveSentences) {
      // Try to preserve complete sentences
      const sentenceEnd = findSentenceEnd(normalizedText, maxLength);
      if (sentenceEnd > 0 && sentenceEnd <= maxLength) {
        introText = normalizedText.substring(0, sentenceEnd);
        truncated = sentenceEnd < normalizedText.length;
      } else {
        // Fall back to word boundary truncation
        introText = truncateAtWordBoundary(normalizedText, maxLength);
        truncated = true;
      }
    } else {
      // Simple word boundary truncation
      introText = truncateAtWordBoundary(normalizedText, maxLength);
      truncated = true;
    }

    // Clean up the ending
    introText = cleanEnding(introText);

    // Add ellipsis if needed
    if (truncated && addEllipsis && introText.length >= CONFIG.MIN_LENGTH_FOR_ELLIPSIS) {
      introText = introText + customEllipsis;
    }

    return {
      text: introText,
      length: introText.length,
      truncated,
      sourceLength: normalizedText.length,
    };
  } catch (error) {
    logger.error("Failed to extract intro text", {
      error: error instanceof Error ? error : new Error(String(error)),
      htmlLength: htmlContent.length,
    });

    // Return empty result on error
    return {
      text: "",
      length: 0,
      truncated: false,
      sourceLength: 0,
    };
  }
}

/**
 * Normalize whitespace in text
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .replace(/\t+/g, " ") // Replace tabs with spaces
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Find the end of a sentence within the max length
 */
function findSentenceEnd(text: string, maxLength: number): number {
  // Look for sentence endings within the limit
  const sentenceEndRegex = /[.!?](?:\s|$)/g;
  let lastMatch = -1;
  let match;

  while ((match = sentenceEndRegex.exec(text)) !== null) {
    if (match.index < maxLength) {
      lastMatch = match.index + 1; // Include the punctuation
    } else {
      break;
    }
  }

  return lastMatch;
}

/**
 * Truncate text at word boundary
 */
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find the last space before maxLength
  let cutIndex = maxLength;
  const lastSpace = text.lastIndexOf(" ", maxLength);

  // If we found a space reasonably close to the max length, use it
  if (lastSpace > maxLength * 0.8) {
    cutIndex = lastSpace;
  } else {
    // Otherwise, look for other word boundaries
    const boundaries = [" ", "-", "—", "/", "\\"];
    for (const boundary of boundaries) {
      const index = text.lastIndexOf(boundary, maxLength);
      if (index > cutIndex * 0.8 && index < cutIndex) {
        cutIndex = index;
        break;
      }
    }
  }

  return text.substring(0, cutIndex).trim();
}

/**
 * Clean up the ending of truncated text
 */
function cleanEnding(text: string): string {
  let cleaned = text.trim();

  // Remove trailing punctuation that shouldn't come before ellipsis
  for (const char of CONFIG.TRIM_CHARS) {
    if (cleaned.endsWith(char)) {
      cleaned = cleaned.slice(0, -1).trim();
    }
  }

  // Remove incomplete words at the end (e.g., "somethi")
  const lastSpace = cleaned.lastIndexOf(" ");
  if (lastSpace > 0) {
    const lastWord = cleaned.substring(lastSpace + 1);
    // Check if the last word looks incomplete (ends with lowercase letter)
    if (lastWord.length > 0 && /[a-z]$/.test(lastWord) && lastWord.length < 3) {
      cleaned = cleaned.substring(0, lastSpace).trim();
    }
  }

  return cleaned;
}

/**
 * Extract intro text from plain text (no HTML)
 */
export function extractIntroFromPlainText(
  plainText: string,
  options: IntroTextOptions = {},
): IntroTextResult {
  const normalizedText = normalizeWhitespace(plainText);
  const {
    maxLength = CONFIG.MAX_LENGTH,
    addEllipsis = true,
    customEllipsis = CONFIG.ELLIPSIS,
  } = options;

  if (!normalizedText || normalizedText.length <= maxLength) {
    return {
      text: normalizedText,
      length: normalizedText.length,
      truncated: false,
      sourceLength: normalizedText.length,
    };
  }

  let introText = truncateAtWordBoundary(normalizedText, maxLength);
  introText = cleanEnding(introText);

  if (addEllipsis && introText.length >= CONFIG.MIN_LENGTH_FOR_ELLIPSIS) {
    introText = introText + customEllipsis;
  }

  return {
    text: introText,
    length: introText.length,
    truncated: true,
    sourceLength: normalizedText.length,
  };
}

/**
 * Check if content is suitable for intro text
 */
export function isValidIntroContent(htmlContent: string): boolean {
  const plainText = getTextContent(htmlContent);
  const normalized = normalizeWhitespace(plainText);

  // Check if we have meaningful text content
  return normalized.length >= CONFIG.MIN_LENGTH_FOR_ELLIPSIS;
}

/**
 * Create a fallback intro text
 */
export function createFallbackIntro(title: string, author?: string): string {
  const parts = [];

  if (title) {
    parts.push(title);
  }

  if (author) {
    parts.push(`by ${author}`);
  }

  if (parts.length === 0) {
    return "Read more...";
  }

  const fallback = parts.join(" ");
  return extractIntroFromPlainText(fallback).text;
}

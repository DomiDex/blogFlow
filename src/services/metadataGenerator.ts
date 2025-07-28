/// <reference lib="deno.ns" />
import { getTextContent } from "@utils/sanitizer.ts";
import { calculateReadingTime as calculateAdvancedReadingTime } from "@utils/readingTime.ts";
import {
  generateUniqueSlug as generateUniqueSlugUtil,
} from "@utils/slugGenerator.ts";
import { logger } from "@utils/logger.ts";
import { ContentProcessingError } from "@utils/errors.ts";

/**
 * Article metadata interface
 */
export interface ArticleMetadata {
  slug: string;
  readingTime: string;
  introText: string;
  createdOn: string;
  updatedOn: string;
  publishedOn?: string;
  wordCount: number;
  characterCount: number;
}

/**
 * Options for metadata generation
 */
export interface MetadataOptions {
  title: string;
  htmlContent: string;
  plainTextContent?: string;
  publishNow?: boolean;
  customSlug?: string;
  existingSlugs?: string[];
}

/**
 * Configuration constants
 */
const CONFIG = {
  // Average adult reading speed in words per minute
  WORDS_PER_MINUTE: 238,
  // Minimum reading time in minutes
  MIN_READING_TIME: 1,
  // Maximum intro text length
  INTRO_TEXT_LENGTH: 160,
  // Maximum slug length
  MAX_SLUG_LENGTH: 100,
};

/**
 * Generate all metadata for an article
 */
export function generateMetadata(options: MetadataOptions): ArticleMetadata {
  try {
    const {
      title,
      htmlContent,
      plainTextContent,
      publishNow = false,
      customSlug,
      existingSlugs = [],
    } = options;

    // Extract plain text if not provided
    const plainText = plainTextContent || getTextContent(htmlContent);

    // Calculate reading time using advanced algorithm
    const readingTimeResult = calculateAdvancedReadingTime(htmlContent, {
      includeAnalysis: true,
    });

    // Extract counts from analysis
    const wordCount = readingTimeResult.words;
    const characterCount = plainText.length;
    const readingTime = readingTimeResult.time;

    // Extract intro text
    const introText = extractIntroText(plainText);

    // Generate slug
    const slug = generateUniqueSlug(
      customSlug || title,
      existingSlugs,
    );

    // Generate timestamps
    const now = new Date().toISOString();
    const metadata: ArticleMetadata = {
      slug,
      readingTime,
      introText,
      createdOn: now,
      updatedOn: now,
      wordCount,
      characterCount,
    };

    // Add published timestamp if publishing now
    if (publishNow) {
      metadata.publishedOn = now;
    }

    logger.info("Generated article metadata", {
      slug,
      wordCount,
      readingTime,
      introLength: introText.length,
      publishNow,
    });

    return metadata;
  } catch (error) {
    logger.error("Failed to generate metadata", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw new ContentProcessingError(
      "Failed to generate article metadata",
      "METADATA_GENERATION_ERROR",
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
}

/**
 * Calculate word count from plain text
 */
export function calculateWordCount(text: string): number {
  if (!text || !text.trim()) {
    return 0;
  }

  // Split by whitespace and filter out empty strings
  const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
  return words.length;
}

/**
 * Calculate reading time based on word count
 */
export function calculateReadingTime(wordCount: number): string {
  if (wordCount === 0) {
    return `${CONFIG.MIN_READING_TIME} min read`;
  }

  // Calculate raw reading time
  const minutes = Math.ceil(wordCount / CONFIG.WORDS_PER_MINUTE);

  // Apply minimum reading time
  const readingTime = Math.max(minutes, CONFIG.MIN_READING_TIME);

  // Format with proper singular/plural
  return `${readingTime} min${readingTime === 1 ? "" : ""} read`;
}

/**
 * Extract intro text from plain text content
 */
export function extractIntroText(
  text: string,
  maxLength: number = CONFIG.INTRO_TEXT_LENGTH,
): string {
  if (!text || !text.trim()) {
    return "";
  }

  // Clean up the text
  const cleanText = text
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/\n+/g, " "); // Replace newlines with spaces

  // If text is shorter than max length, return as is
  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  // Find the last space before maxLength to avoid cutting words
  let cutIndex = maxLength;
  const lastSpace = cleanText.lastIndexOf(" ", maxLength);

  // If we found a space reasonably close to the max length, use it
  if (lastSpace > maxLength * 0.8) {
    cutIndex = lastSpace;
  }

  // Extract and add ellipsis
  return cleanText.substring(0, cutIndex).trim() + "...";
}

/**
 * Generate a unique slug from title
 */
export function generateUniqueSlug(
  input: string,
  existingSlugs: string[] = [],
): string {
  return generateUniqueSlugUtil(input, existingSlugs, {
    maxLength: CONFIG.MAX_SLUG_LENGTH,
    removeStopWords: false,
    strict: true,
  });
}

/**
 * Update metadata for an existing article
 */
export function updateMetadata(
  existingMetadata: ArticleMetadata,
  updates: Partial<MetadataOptions>,
): ArticleMetadata {
  const updatedMetadata = { ...existingMetadata };

  // Always update the updatedOn timestamp
  updatedMetadata.updatedOn = new Date().toISOString();

  // Update word count and reading time if content changed
  if (updates.htmlContent) {
    const plainText = updates.plainTextContent || getTextContent(updates.htmlContent);
    updatedMetadata.wordCount = calculateWordCount(plainText);
    updatedMetadata.characterCount = plainText.length;
    updatedMetadata.readingTime = calculateReadingTime(updatedMetadata.wordCount);
    updatedMetadata.introText = extractIntroText(plainText);
  }

  // Update published timestamp if publishing
  if (updates.publishNow && !updatedMetadata.publishedOn) {
    updatedMetadata.publishedOn = new Date().toISOString();
  }

  return updatedMetadata;
}

/**
 * Validate metadata object
 */
export function validateMetadata(metadata: Partial<ArticleMetadata>): boolean {
  const required: (keyof ArticleMetadata)[] = [
    "slug",
    "readingTime",
    "introText",
    "createdOn",
    "updatedOn",
    "wordCount",
    "characterCount",
  ];

  for (const field of required) {
    if (metadata[field] === undefined || metadata[field] === null) {
      return false;
    }
  }

  // Validate slug format
  if (metadata.slug && !/^[a-z0-9-]+$/.test(metadata.slug)) {
    return false;
  }

  // Validate timestamps
  const timestamps = ["createdOn", "updatedOn", "publishedOn"].filter(
    (field) => metadata[field as keyof ArticleMetadata],
  );

  for (const timestamp of timestamps) {
    const value = metadata[timestamp as keyof ArticleMetadata];
    if (value && isNaN(Date.parse(value as string))) {
      return false;
    }
  }

  return true;
}

/// <reference lib="deno.ns" />
import { logger } from "@utils/logger.ts";
import { ValidationError } from "@utils/errors.ts";
import type { ArticleMetadata } from "./metadataGenerator.ts";
import type { FormData } from "@utils/validation.ts";

/**
 * Webflow CMS field structure
 */
export interface WebflowFieldData {
  // Content fields
  name: string;
  "author-name": string;
  "meta-description": string;
  post: string;
  slug: string;
  "reading-time": string;
  "intro-text": string;

  // System fields
  _archived: boolean;
  _draft: boolean;

  // Timestamps
  "created-on"?: string;
  "updated-on"?: string;
  "published-on"?: string;

  // Optional fields
  "featured-image"?: string;
  categories?: string[];
  tags?: string[];
  "author-email"?: string;
  "author-phone"?: string;
}

/**
 * Webflow CMS item structure
 */
export interface WebflowCmsItem {
  fieldData: WebflowFieldData;
  // Only include isDraft for updates, not creates
  isDraft?: boolean;
}

/**
 * Field mapping configuration
 */
const FIELD_MAPPING = {
  // Direct mappings from form to CMS
  authorName: "author-name",
  articleTitle: "name",
  metaDescription: "meta-description",
  articleContent: "post", // This will be HTML, not Delta

  // Metadata mappings
  slug: "slug",
  readingTime: "reading-time",
  introText: "intro-text",
  createdOn: "created-on",
  updatedOn: "updated-on",
  publishedOn: "published-on",

  // Optional field mappings
  featuredImage: "featured-image",
  categories: "categories",
  tags: "tags",
  authorEmail: "author-email",
  authorPhone: "author-phone",
} as const;

/**
 * Required fields for Webflow CMS
 */
const REQUIRED_FIELDS = [
  "name",
  "author-name",
  "post",
  "slug",
] as const;

/**
 * Maximum field lengths (Webflow limits)
 */
const FIELD_LENGTH_LIMITS = {
  name: 256,
  "author-name": 256,
  "meta-description": 300,
  slug: 256,
  "reading-time": 50,
  "intro-text": 300,
  "author-email": 256,
  "author-phone": 50,
} as const;

/**
 * Map form data and metadata to Webflow CMS fields
 */
export function mapToWebflowFields(
  formData: FormData,
  metadata: ArticleMetadata,
  htmlContent: string,
  options: {
    isUpdate?: boolean;
    includeOptionalFields?: boolean;
  } = {},
): WebflowCmsItem {
  const { isUpdate = false, includeOptionalFields = true } = options;

  // Start with required fields
  const fieldData: Partial<WebflowFieldData> = {
    name: formData.articleTitle,
    "author-name": formData.authorName,
    "meta-description": formData.metaDescription || "",
    post: htmlContent,
    slug: metadata.slug,
    "reading-time": metadata.readingTime,
    "intro-text": metadata.introText,
    _archived: false,
    _draft: !formData.publishNow,
  };

  // Add timestamps
  if (!isUpdate) {
    fieldData["created-on"] = metadata.createdOn;
  }
  fieldData["updated-on"] = metadata.updatedOn;

  if (metadata.publishedOn) {
    fieldData["published-on"] = metadata.publishedOn;
  }

  // Add optional fields if they exist
  if (includeOptionalFields) {
    // Categories and tags
    if (formData.categories && formData.categories.length > 0) {
      fieldData.categories = formData.categories;
    }
    if (formData.tags && formData.tags.length > 0) {
      fieldData.tags = formData.tags;
    }

    // Featured image
    if (formData.featuredImage) {
      fieldData["featured-image"] = formData.featuredImage;
    }

    // Author contact info
    if (formData.authorEmail) {
      fieldData["author-email"] = formData.authorEmail;
    }
    if (formData.authorPhone) {
      fieldData["author-phone"] = formData.authorPhone;
    }
  }

  // Validate field lengths
  validateFieldLengths(fieldData);

  // Validate required fields
  validateRequiredFields(fieldData as WebflowFieldData);

  // Log the mapping
  logger.info("Mapped fields to Webflow format", {
    formFields: Object.keys(formData).length,
    cmsFields: Object.keys(fieldData).length,
    isUpdate,
    isDraft: fieldData._draft,
  });

  // Return the appropriate structure
  const cmsItem: WebflowCmsItem = {
    fieldData: fieldData as WebflowFieldData,
  };

  // Only include isDraft for updates
  if (isUpdate) {
    cmsItem.isDraft = fieldData._draft;
  }

  return cmsItem;
}

/**
 * Transform a single field value based on type
 */
export function transformFieldValue(value: unknown, fieldName: string): unknown {
  // Boolean fields
  if (fieldName === "_archived" || fieldName === "_draft") {
    return Boolean(value);
  }

  // Array fields
  if (fieldName === "categories" || fieldName === "tags") {
    if (Array.isArray(value)) {
      return value.filter((v) => typeof v === "string" && v.trim() !== "");
    }
    return [];
  }

  // Handle null/undefined for other fields
  if (value === null || value === undefined) {
    return "";
  }

  // Date fields
  if (fieldName.endsWith("-on")) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string" && !isNaN(Date.parse(value))) {
      return new Date(value).toISOString();
    }
    return new Date().toISOString();
  }

  // String fields
  return String(value);
}

/**
 * Validate field lengths against Webflow limits
 */
function validateFieldLengths(fieldData: Partial<WebflowFieldData>): void {
  for (const [field, limit] of Object.entries(FIELD_LENGTH_LIMITS)) {
    const value = fieldData[field as keyof WebflowFieldData];
    if (typeof value === "string" && value.length > limit) {
      throw new ValidationError(
        `Field '${field}' exceeds maximum length of ${limit} characters`,
        field,
        value,
        { actualLength: value.length, maxLength: limit },
      );
    }
  }
}

/**
 * Validate that all required fields are present
 */
function validateRequiredFields(fieldData: WebflowFieldData): void {
  const missingFields: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    const value = fieldData[field];
    if (value === undefined || value === null || value === "") {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missingFields.join(", ")}`,
      "fieldData",
      fieldData,
      { missingFields },
    );
  }
}

/**
 * Create a partial update object with only changed fields
 */
export function createPartialUpdate(
  currentData: WebflowFieldData,
  newData: Partial<WebflowFieldData>,
): Partial<WebflowFieldData> {
  const updates: Partial<WebflowFieldData> = {};

  for (const [key, newValue] of Object.entries(newData)) {
    const currentValue = currentData[key as keyof WebflowFieldData];

    // Check if value has changed
    if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
      // Type-safe assignment using proper type assertion
      const typedKey = key as keyof WebflowFieldData;
      (updates as Record<string, unknown>)[typedKey] = newValue;
    }
  }

  // Always update the updated-on timestamp
  updates["updated-on"] = new Date().toISOString();

  return updates;
}

/**
 * Get field mapping for debugging/documentation
 */
export function getFieldMapping(): Record<string, string> {
  return { ...FIELD_MAPPING };
}

/**
 * Check if a field name is valid for Webflow CMS
 */
export function isValidWebflowField(fieldName: string): boolean {
  const validFields = new Set([
    ...Object.values(FIELD_MAPPING),
    "_archived",
    "_draft",
  ]);

  return validFields.has(fieldName);
}

/**
 * Sanitize field data by removing invalid or empty fields
 */
export function sanitizeFieldData(fieldData: Partial<WebflowFieldData>): Partial<WebflowFieldData> {
  const sanitized: Partial<WebflowFieldData> = {};

  for (const [key, value] of Object.entries(fieldData)) {
    // Skip empty strings for optional fields
    if (value === "" && !REQUIRED_FIELDS.includes(key as typeof REQUIRED_FIELDS[number])) {
      continue;
    }

    // Skip empty arrays
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // Type-safe assignment to sanitized object
    const typedKey = key as keyof WebflowFieldData;
    (sanitized as Record<string, unknown>)[typedKey] = value;
  }

  return sanitized;
}

/// <reference lib="deno.ns" />
import { z } from "zod";

/**
 * Comprehensive form data validation using Zod schemas
 */

// Custom validation functions
const profanityWords = [
  // Basic profanity list - you can expand this
  "damn", "hell", "shit", "fuck", "bitch", "ass", "crap"
];

function containsProfanity(text: string): boolean {
  const lowercaseText = text.toLowerCase();
  return profanityWords.some(word => lowercaseText.includes(word));
}

function isValidURL(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

// Custom Zod validators
const _createNoProfanityString = (field: string) => 
  z.string().refine(
    (val) => !containsProfanity(val),
    { message: `${field} contains inappropriate language` }
  );

const urlString = z.string()
  .refine(
    (val) => val === "" || isValidURL(val),
    { message: "Must be a valid URL" }
  );

// Quill.js Delta operation schema
const quillOpSchema = z.object({
  // Text insertion
  insert: z.union([
    z.string(),
    z.object({
      // Embeds like images, videos, etc.
      image: z.string().optional(),
      video: z.string().optional(),
      link: z.string().optional(),
    }).passthrough()
  ]).optional(),

  // Operation attributes (formatting)
  attributes: z.object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strike: z.boolean().optional(),
    color: z.string().optional(),
    background: z.string().optional(),
    font: z.string().optional(),
    size: z.union([z.string(), z.number()]).optional(),
    link: urlString.optional(),
    align: z.enum(["left", "center", "right", "justify"]).optional(),
    direction: z.enum(["ltr", "rtl"]).optional(),
    indent: z.number().optional(),
    list: z.enum(["ordered", "bullet"]).optional(),
    script: z.enum(["sub", "super"]).optional(),
    header: z.union([z.number(), z.boolean()]).optional(),
    blockquote: z.boolean().optional(),
    "code-block": z.boolean().optional(),
  }).passthrough().optional(),

  // Operation retain (for cursor position)
  retain: z.number().optional(),

  // Operation delete
  delete: z.number().optional(),
}).refine(
  (op) => {
    // At least one operation type must be present
    return op.insert !== undefined || op.retain !== undefined || op.delete !== undefined;
  },
  { message: "Invalid Quill operation: must have insert, retain, or delete" }
);

// Quill.js Delta content schema
const quillDeltaSchema = z.object({
  ops: z.array(quillOpSchema).min(1, "Content cannot be empty")
}).refine(
  (delta) => {
    // Check if there's actual text content (not just formatting operations)
    const hasTextContent = delta.ops.some(op => 
      typeof op.insert === "string" && op.insert.trim().length > 0
    );
    return hasTextContent;
  },
  { message: "Content must contain actual text, not just formatting" }
);

// Email validation schema
const emailSchema = z.string()
  .email("Must be a valid email address")
  .max(320, "Email address too long");

// Phone number validation schema  
const phoneSchema = z.string()
  .regex(
    /^[\+]?[1-9][\d]{0,15}$/,
    "Must be a valid phone number (international format supported)"
  );

// Main form data schema
export const formDataSchema = z.object({
  // Author information
  authorName: z.string()
    .min(2, "Author name must be at least 2 characters")
    .max(100, "Author name must be less than 100 characters")
    .regex(
      /^[a-zA-Z\s\-'\.]+$/,
      "Author name can only contain letters, spaces, hyphens, apostrophes, and periods"
    )
    .refine(
      (val) => !containsProfanity(val),
      { message: "Author name contains inappropriate language" }
    ),

  // Author contact (optional)
  authorEmail: emailSchema.optional(),
  authorPhone: phoneSchema.optional(),

  // Article content
  articleTitle: z.string()
    .min(10, "Article title must be at least 10 characters")
    .max(200, "Article title must be less than 200 characters")
    .regex(
      /^[a-zA-Z0-9\s\-_:!?\.,'"()&]+$/,
      "Article title contains invalid characters"
    )
    .refine(
      (val) => !containsProfanity(val),
      { message: "Article title contains inappropriate language" }
    ),

  metaDescription: z.string()
    .min(50, "Meta description must be at least 50 characters for SEO")
    .max(300, "Meta description must be less than 300 characters")
    .refine(
      (val) => val.trim().length >= 50,
      { message: "Meta description must have at least 50 non-whitespace characters" }
    )
    .refine(
      (val) => !containsProfanity(val),
      { message: "Meta description contains inappropriate language" }
    ),

  // Quill.js Delta content
  articleContent: quillDeltaSchema,

  // Optional fields
  publishNow: z.boolean().optional().default(false),
  
  // SEO fields (optional)
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be less than 100 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    )
    .optional(),

  // Categories/tags (optional)
  categories: z.array(z.string().min(1).max(50)).max(10, "Maximum 10 categories").optional(),
  tags: z.array(z.string().min(1).max(30)).max(20, "Maximum 20 tags").optional(),

  // Scheduling (optional)
  publishAt: z.string().datetime("Must be a valid ISO datetime").optional(),

  // Featured image (optional)
  featuredImage: urlString.optional(),
}).refine(
  (data) => {
    // Additional cross-field validation
    if (data.publishAt) {
      const publishDate = new Date(data.publishAt);
      const now = new Date();
      return publishDate > now;
    }
    return true;
  },
  {
    message: "Publish date must be in the future",
    path: ["publishAt"]
  }
);

// Schema for updates (most fields optional)
export const updateFormDataSchema = z.object({
  authorName: z.string().min(2).max(100).optional(),
  authorEmail: emailSchema.optional(),
  authorPhone: phoneSchema.optional(),
  articleTitle: z.string().min(10).max(200).optional(),
  metaDescription: z.string().min(50).max(300).optional(),
  articleContent: quillDeltaSchema, // Required for updates
  publishNow: z.boolean().optional(),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
  categories: z.array(z.string()).max(10).optional(),
  tags: z.array(z.string()).max(20).optional(),
  publishAt: z.string().datetime().optional(),
  featuredImage: urlString.optional(),
});

// Schema for draft saving (more lenient)
export const draftFormDataSchema = z.object({
  authorName: z.string().min(1).max(100).optional(),
  articleTitle: z.string().min(1).max(200).optional(),
  metaDescription: z.string().max(300).optional(),
  articleContent: z.object({
    ops: z.array(quillOpSchema).optional()
  }).optional(),
  slug: z.string().regex(/^[a-z0-9-]*$/).max(100).optional(),
}).refine(
  (data) => {
    // At least one field must be present for draft
    return Object.values(data).some(value => value !== undefined && value !== "");
  },
  { message: "At least one field must be provided to save draft" }
);

// Type inference from schemas
export type FormData = z.infer<typeof formDataSchema>;
export type UpdateFormData = z.infer<typeof updateFormDataSchema>;
export type DraftFormData = z.infer<typeof draftFormDataSchema>;
export type QuillDelta = z.infer<typeof quillDeltaSchema>;
export type QuillOp = z.infer<typeof quillOpSchema>;

// Validation result type
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  received?: unknown;
}

/**
 * Validate form data and return structured result
 */
export function validateFormData(data: unknown): ValidationResult<FormData> {
  try {
    const result = formDataSchema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    // Format Zod errors into user-friendly format
    const errors: ValidationError[] = result.error.issues.map(issue => ({
      field: issue.path.join('.') || 'root',
      message: issue.message,
      code: issue.code,
      received: 'received' in issue ? issue.received : undefined,
    }));

    return {
      success: false,
      errors,
    };
  } catch (_error) {
    return {
      success: false,
      errors: [{
        field: 'root',
        message: 'Invalid data format',
        code: 'invalid_type',
      }],
    };
  }
}

/**
 * Validate update form data
 */
export function validateUpdateFormData(data: unknown): ValidationResult<UpdateFormData> {
  try {
    const result = updateFormDataSchema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    const errors: ValidationError[] = result.error.issues.map(issue => ({
      field: issue.path.join('.') || 'root',
      message: issue.message,
      code: issue.code,
      received: 'received' in issue ? issue.received : undefined,
    }));

    return {
      success: false,
      errors,
    };
  } catch (_error) {
    return {
      success: false,
      errors: [{
        field: 'root',
        message: 'Invalid data format',
        code: 'invalid_type',
      }],
    };
  }
}

/**
 * Validate draft form data (more lenient)
 */
export function validateDraftFormData(data: unknown): ValidationResult<DraftFormData> {
  try {
    const result = draftFormDataSchema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    const errors: ValidationError[] = result.error.issues.map(issue => ({
      field: issue.path.join('.') || 'root',
      message: issue.message,
      code: issue.code,
      received: 'received' in issue ? issue.received : undefined,
    }));

    return {
      success: false,
      errors,
    };
  } catch (_error) {
    return {
      success: false,
      errors: [{
        field: 'root',
        message: 'Invalid data format',
        code: 'invalid_type',
      }],
    };
  }
}

/**
 * Extract text content from Quill Delta for length validation
 */
export function extractTextFromDelta(delta: QuillDelta): string {
  return delta.ops
    .map(op => typeof op.insert === 'string' ? op.insert : '')
    .join('')
    .trim();
}

/**
 * Get minimum content length for validation
 */
export function validateContentLength(delta: QuillDelta, minWords: number = 50): ValidationResult<QuillDelta> {
  const text = extractTextFromDelta(delta);
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  
  if (wordCount < minWords) {
    return {
      success: false,
      errors: [{
        field: 'articleContent',
        message: `Article must contain at least ${minWords} words. Current: ${wordCount} words`,
        code: 'too_small',
      }],
    };
  }

  return {
    success: true,
    data: delta,
  };
}

/**
 * Validate URLs in Quill content
 */
export function validateContentUrls(delta: QuillDelta): ValidationResult<QuillDelta> {
  const errors: ValidationError[] = [];
  
  delta.ops.forEach((op, index) => {
    // Check link in attributes
    if (op.attributes?.link && !isValidURL(op.attributes.link)) {
      errors.push({
        field: `articleContent.ops[${index}].attributes.link`,
        message: 'Invalid URL in link',
        code: 'invalid_url',
        received: op.attributes.link,
      });
    }

    // Check embedded URLs
    if (typeof op.insert === 'object') {
      if (op.insert.image && !isValidURL(op.insert.image)) {
        errors.push({
          field: `articleContent.ops[${index}].insert.image`,
          message: 'Invalid image URL',
          code: 'invalid_url',
          received: op.insert.image,
        });
      }

      if (op.insert.video && !isValidURL(op.insert.video)) {
        errors.push({
          field: `articleContent.ops[${index}].insert.video`,
          message: 'Invalid video URL',
          code: 'invalid_url',
          received: op.insert.video,
        });
      }
    }
  });

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: delta,
  };
}

/**
 * Comprehensive content validation
 */
export function validateContent(delta: QuillDelta, options: {
  minWords?: number;
  validateUrls?: boolean;
} = {}): ValidationResult<QuillDelta> {
  const { minWords = 50, validateUrls = true } = options;

  // Basic structure validation
  const basicValidation = quillDeltaSchema.safeParse(delta);
  if (!basicValidation.success) {
    return {
      success: false,
      errors: basicValidation.error.issues.map(issue => ({
        field: issue.path.join('.') || 'articleContent',
        message: issue.message,
        code: issue.code,
        received: 'received' in issue ? issue.received : undefined,
      })),
    };
  }

  // Length validation
  const lengthValidation = validateContentLength(delta, minWords);
  if (!lengthValidation.success) {
    return lengthValidation;
  }

  // URL validation
  if (validateUrls) {
    const urlValidation = validateContentUrls(delta);
    if (!urlValidation.success) {
      return urlValidation;
    }
  }

  return {
    success: true,
    data: delta,
  };
}

/**
 * Format validation errors for client response
 */
export function formatValidationErrors(errors: ValidationError[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  
  for (const error of errors) {
    if (!fieldErrors[error.field]) {
      fieldErrors[error.field] = [];
    }
    fieldErrors[error.field].push(error.message);
  }
  
  return fieldErrors;
}

/**
 * Get user-friendly validation summary
 */
export function getValidationSummary(errors: ValidationError[]): string {
  const fieldCount = new Set(errors.map(e => e.field)).size;
  const errorCount = errors.length;
  
  if (errorCount === 1) {
    return `1 validation error in ${errors[0].field}`;
  } else if (fieldCount === 1) {
    return `${errorCount} validation errors in ${errors[0].field}`;
  } else {
    return `${errorCount} validation errors across ${fieldCount} fields`;
  }
}
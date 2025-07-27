/// <reference lib="deno.ns" />

// Re-export types from validation to maintain backwards compatibility
export type {
  FormData,
  UpdateFormData,
  DraftFormData,
  QuillDelta,
  QuillOp,
  ValidationResult,
  ValidationError
} from "@utils/validation.ts";

// Raw form data as received from Webflow (before validation)
export interface RawFormData {
  [key: string]: unknown;
}

// Legacy validation result (deprecated - use ValidationResult instead)
export interface FormValidationResult {
  isValid: boolean;
  errors: string[];
  formData?: Record<string, unknown>;
}

// Processed form data with metadata (after validation and processing)
export interface ProcessedFormData {
  // Original validated data
  authorName: string;
  articleTitle: string;
  metaDescription: string;
  articleContent: { ops: Array<{ insert?: unknown; attributes?: unknown; retain?: number; delete?: number }> };
  publishNow?: boolean;
  
  // Optional validated fields
  authorEmail?: string;
  authorPhone?: string;
  slug?: string;
  categories?: string[];
  tags?: string[];
  publishAt?: string;
  featuredImage?: string;

  // Generated metadata
  readingTime?: number;
  introText?: string;
  htmlContent?: string; // Converted from Quill Delta
  wordCount?: number;
  
  // Processing metadata
  processedAt: string;
  requestId?: string;
}
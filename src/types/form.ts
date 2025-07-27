/// <reference lib="deno.ns" />

// Form submission data from Webflow
export interface FormData {
  articleTitle: string;
  authorName: string;
  metaDescription: string;
  articleContent: string; // HTML content from Quill.js
  slug?: string; // Generated or provided
  readingTime?: number;
  introText?: string;
}

// Raw form data as received from Webflow
export interface RawFormData {
  [key: string]: unknown;
}

// Validation result for form data
export interface FormValidationResult {
  isValid: boolean;
  errors: string[];
  formData?: FormData;
}
/// <reference lib="deno.ns" />
import type { Context, Next } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { logger } from "@utils/logger.ts";
import { 
  validateFormData as validateFormDataFn,
  validateUpdateFormData as validateUpdateFormDataFn, 
  validateDraftFormData as validateDraftFormDataFn,
  validateContent,
  formatValidationErrors,
  getValidationSummary,
  type FormData,
  type UpdateFormData,
  type DraftFormData,
  type ValidationError as _ValidationError
} from "@utils/validation.ts";

export interface ValidationOptions {
  mode?: 'create' | 'update' | 'draft';
  validateContent?: boolean;
  minWords?: number;
  allowPartial?: boolean;
}

export interface ValidationErrorResponse {
  error: string;
  message: string;
  fields: Record<string, string[]>;
  summary: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Middleware for validating form data with Zod schemas
 */
export function validateFormData(options: ValidationOptions = {}) {
  const {
    mode = 'create',
    validateContent: shouldValidateContent = true,
    minWords = 50,
    allowPartial: _allowPartial = false
  } = options;

  return async (c: Context, next: Next) => {
    const requestId = c.get("requestId") as string;
    
    try {
      // Parse request body
      let body: unknown;
      
      try {
        body = await c.req.json();
      } catch (error) {
        logger.warn("Failed to parse request body as JSON", {
          requestId,
          contentType: c.req.header("content-type"),
          error: error instanceof Error ? error : new Error(String(error)),
        });

        return c.json({
          error: "Invalid JSON",
          message: "Request body must be valid JSON",
          fields: {},
          summary: "Invalid request format",
          timestamp: new Date().toISOString(),
          requestId,
        } satisfies ValidationErrorResponse, 400);
      }

      // Preprocess form data to fix common serialization issues
      if (body && typeof body === 'object' && 'articleContent' in body) {
        // deno-lint-ignore no-explicit-any
        const bodyTyped = body as any;
        if (bodyTyped.articleContent && bodyTyped.articleContent.ops) {
          // Convert ops from object to array if needed (happens with some JSON serialization)
          if (!Array.isArray(bodyTyped.articleContent.ops) && typeof bodyTyped.articleContent.ops === 'object') {
            const opsObj = bodyTyped.articleContent.ops as Record<string, unknown>;
            const opsArray = [];
            
            // Convert numeric keys to array
            const keys = Object.keys(opsObj).sort((a, b) => parseInt(a) - parseInt(b));
            for (const key of keys) {
              if (!isNaN(parseInt(key))) {
                opsArray.push(opsObj[key]);
              }
            }
            
            if (opsArray.length > 0) {
              bodyTyped.articleContent.ops = opsArray;
            logger.debug("Converted ops object to array", {
              requestId,
              originalType: "object",
              convertedLength: opsArray.length,
            });
            }
          }
        }
      }

      // Log incoming validation request
      logger.debug("Validating form data", {
        requestId,
        mode,
        validateContent: shouldValidateContent,
        minWords,
        bodyKeys: typeof body === 'object' && body !== null ? Object.keys(body) : [],
      });

      // Validate based on mode
      let validationResult;
      
      switch (mode) {
        case 'create':
          validationResult = validateFormDataFn(body);
          break;
        case 'update':
          validationResult = validateUpdateFormDataFn(body);
          break;
        case 'draft':
          validationResult = validateDraftFormDataFn(body);
          break;
        default:
          throw new Error(`Invalid validation mode: ${mode}`);
      }

      if (!validationResult.success) {
        const fieldErrors = formatValidationErrors(validationResult.errors!);
        const summary = getValidationSummary(validationResult.errors!);

        logger.warn("Form validation failed", {
          requestId,
          mode,
          errorCount: validationResult.errors!.length,
          fields: Object.keys(fieldErrors),
          summary,
        });

        return c.json({
          error: "Validation failed",
          message: "The submitted data contains validation errors",
          fields: fieldErrors,
          summary,
          timestamp: new Date().toISOString(),
          requestId,
        } satisfies ValidationErrorResponse, 400);
      }

      // Additional content validation if enabled
      if (shouldValidateContent && validationResult.data?.articleContent) {
        const articleContent = validationResult.data.articleContent;
        if (articleContent && articleContent.ops) {
          // deno-lint-ignore no-explicit-any
          const contentValidation = validateContent(articleContent as any, {
            minWords,
            validateUrls: true,
          });

        if (!contentValidation.success) {
          const fieldErrors = formatValidationErrors(contentValidation.errors!);
          const summary = getValidationSummary(contentValidation.errors!);

          logger.warn("Content validation failed", {
            requestId,
            mode,
            minWords,
            errorCount: contentValidation.errors!.length,
            summary,
          });

          return c.json({
            error: "Content validation failed",
            message: "The article content contains validation errors",
            fields: fieldErrors,
            summary,
            timestamp: new Date().toISOString(),
            requestId,
          } satisfies ValidationErrorResponse, 400);
          }
        }
      }

      // Store validated data in context
      c.set("validatedData", validationResult.data);

      logger.info("Form validation successful", {
        requestId,
        mode,
        authorName: validationResult.data?.authorName,
        articleTitle: validationResult.data?.articleTitle?.substring(0, 50) + "...",
        contentLength: validationResult.data?.articleContent ? 
          extractTextLength(validationResult.data.articleContent) : 0,
      });

      await next();

    } catch (error) {
      logger.error("Validation middleware error", {
        requestId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      // Return generic error for unexpected issues
      return c.json({
        error: "Validation error",
        message: "An error occurred while validating the request",
        fields: {},
        summary: "Internal validation error",
        timestamp: new Date().toISOString(),
        requestId,
      } satisfies ValidationErrorResponse, 500);
    }
  };
}

/**
 * Middleware for JSON body parsing with validation
 */
export function parseJsonBody() {
  return async (c: Context, next: Next) => {
    const requestId = c.get("requestId") as string;
    
    // Only parse JSON for POST/PUT/PATCH requests
    if (!['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
      await next();
      return;
    }

    const contentType = c.req.header("content-type");
    
    if (!contentType?.includes("application/json")) {
      logger.warn("Non-JSON content type for body parsing", {
        requestId,
        contentType,
        method: c.req.method,
      });

      return c.json({
        error: "Invalid content type",
        message: "Content-Type must be application/json",
        fields: {},
        summary: "Invalid request format",
        timestamp: new Date().toISOString(),
        requestId,
      } satisfies ValidationErrorResponse, 400);
    }

    try {
      const body = await c.req.json();
      c.set("requestBody", body);
      
      logger.debug("JSON body parsed successfully", {
        requestId,
        bodySize: JSON.stringify(body).length,
        topLevelKeys: typeof body === 'object' && body !== null ? Object.keys(body) : [],
      });

      await next();
    } catch (error) {
      logger.warn("Failed to parse JSON body", {
        requestId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return c.json({
        error: "Invalid JSON",
        message: "Request body contains invalid JSON",
        fields: {},
        summary: "JSON parsing failed",
        timestamp: new Date().toISOString(),
        requestId,
      } satisfies ValidationErrorResponse, 400);
    }
  };
}

/**
 * Content length validation middleware
 */
export function validateContentLength(options: { minWords?: number; maxWords?: number } = {}) {
  const { minWords = 50, maxWords = 10000 } = options;

  return async (c: Context, next: Next) => {
    const requestId = c.get("requestId") as string;
    const validatedData = c.get("validatedData") as FormData | UpdateFormData | DraftFormData;

    if (!validatedData?.articleContent) {
      await next();
      return;
    }

    const textLength = extractTextLength(validatedData.articleContent);
    const wordCount = textLength.split(/\s+/).filter(word => word.length > 0).length;

    logger.debug("Content length validation", {
      requestId,
      textLength: textLength.length,
      wordCount,
      minWords,
      maxWords,
    });

    if (wordCount < minWords) {
      return c.json({
        error: "Content too short",
        message: `Article must contain at least ${minWords} words`,
        fields: {
          articleContent: [`Content too short: ${wordCount} words (minimum: ${minWords})`]
        },
        summary: `Content too short: ${wordCount}/${minWords} words`,
        timestamp: new Date().toISOString(),
        requestId,
      } satisfies ValidationErrorResponse, 400);
    }

    if (wordCount > maxWords) {
      return c.json({
        error: "Content too long",
        message: `Article must contain no more than ${maxWords} words`,
        fields: {
          articleContent: [`Content too long: ${wordCount} words (maximum: ${maxWords})`]
        },
        summary: `Content too long: ${wordCount}/${maxWords} words`,
        timestamp: new Date().toISOString(),
        requestId,
      } satisfies ValidationErrorResponse, 400);
    }

    await next();
  };
}

/**
 * Rate limiting for validation (prevent spam validation requests)
 */
export function validationRateLimit() {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  const windowMs = 60000; // 1 minute
  const maxRequests = 10; // 10 validation requests per minute per IP

  return async (c: Context, next: Next) => {
    const requestId = c.get("requestId") as string;
    const clientIP = c.req.header("x-forwarded-for") || 
                     c.req.header("x-real-ip") || 
                     "unknown";

    const now = Date.now();
    const key = `validation:${clientIP}`;
    const current = requestCounts.get(key);

    if (!current || now > current.resetTime) {
      // Reset or initialize counter
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
    } else {
      // Increment counter
      current.count++;
      
      if (current.count > maxRequests) {
        logger.warn("Validation rate limit exceeded", {
          requestId,
          clientIP,
          count: current.count,
          limit: maxRequests,
        });

        return c.json({
          error: "Rate limit exceeded",
          message: "Too many validation requests. Please try again later.",
          fields: {},
          summary: "Rate limit exceeded",
          timestamp: new Date().toISOString(),
          requestId,
        } satisfies ValidationErrorResponse, 429, {
          "Retry-After": Math.ceil((current.resetTime - now) / 1000).toString(),
        });
      }
    }

    await next();
  };
}

/**
 * Helper function to extract text from Quill Delta
 */
function extractTextLength(delta: { ops?: Array<{ insert?: unknown }> }): string {
  if (!delta.ops) return "";
  
  return delta.ops
    .map(op => typeof op.insert === 'string' ? op.insert : '')
    .join('')
    .trim();
}

/**
 * Get validated data from context with type safety
 */
export function getValidatedData<T = FormData>(c: Context): T {
  const data = c.get("validatedData");
  if (!data) {
    throw new HTTPException(500, { message: "No validated data found in context" });
  }
  return data as T;
}

/**
 * Custom validation middleware for specific fields
 */
export function validateField<T>(
  fieldName: string,
  validator: (value: T) => boolean | string,
  errorMessage?: string
) {
  return async (c: Context, next: Next) => {
    const requestId = c.get("requestId") as string;
    const validatedData = c.get("validatedData") as FormData | UpdateFormData | DraftFormData;

    if (!validatedData || !(fieldName in validatedData)) {
      await next();
      return;
    }

    // deno-lint-ignore no-explicit-any
    const fieldValue = (validatedData as any)[fieldName];
    const result = validator(fieldValue);

    if (result === false || typeof result === 'string') {
      const message = typeof result === 'string' ? result : errorMessage || `Invalid ${fieldName}`;

      logger.warn("Custom field validation failed", {
        requestId,
        fieldName,
        message,
      });

      return c.json({
        error: "Field validation failed",
        message: `Validation failed for ${fieldName}`,
        fields: {
          [fieldName]: [message]
        },
        summary: `Invalid ${fieldName}`,
        timestamp: new Date().toISOString(),
        requestId,
      } satisfies ValidationErrorResponse, 400);
    }

    await next();
  };
}

// Export commonly used validation middleware combinations
export const createFormValidation = validateFormData({ mode: 'create' });
export const updateFormValidation = validateFormData({ mode: 'update' });
export const draftFormValidation = validateFormData({ mode: 'draft', validateContent: false });

// Export for route-specific validation
export {
  validateContentLength as contentLengthValidation,
};
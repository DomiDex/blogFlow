/// <reference lib="deno.ns" />

/**
 * Webflow-specific error classes and utilities
 */

export enum WebflowErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = "unauthorized",
  FORBIDDEN = "forbidden", 
  INVALID_TOKEN = "invalid_token",
  MISSING_SCOPES = "missing_scopes",

  // Validation Errors
  VALIDATION_ERROR = "validation_error",
  INVALID_FIELD_DATA = "invalid_field_data",
  REQUIRED_FIELD_MISSING = "required_field_missing",
  FIELD_TYPE_MISMATCH = "field_type_mismatch",

  // Resource Errors
  NOT_FOUND = "not_found",
  COLLECTION_NOT_FOUND = "collection_not_found",
  ITEM_NOT_FOUND = "item_not_found",
  SITE_NOT_FOUND = "site_not_found",

  // Rate Limiting
  RATE_LIMITED = "rate_limited",
  TOO_MANY_REQUESTS = "too_many_requests",

  // Server Errors
  INTERNAL_ERROR = "internal_error",
  SERVICE_UNAVAILABLE = "service_unavailable",
  TIMEOUT = "timeout",

  // Content Errors
  CONTENT_TOO_LARGE = "content_too_large",
  INVALID_SLUG = "invalid_slug",
  DUPLICATE_SLUG = "duplicate_slug",

  // Publishing Errors
  PUBLISH_ERROR = "publish_error",
  UNPUBLISHED_CHANGES = "unpublished_changes",

  // Network Errors
  NETWORK_ERROR = "network_error",
  CONNECTION_ERROR = "connection_error",

  // Unknown
  UNKNOWN_ERROR = "unknown_error",
}

export interface WebflowErrorDetails {
  code: WebflowErrorCode;
  message: string;
  httpStatus: number;
  field?: string;
  param?: string;
  description?: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  context?: Record<string, unknown>;
}

export interface WebflowRateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter: number; // seconds
}

/**
 * Base Webflow error class
 */
export class WebflowError extends Error {
  public readonly code: WebflowErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;
  public readonly field?: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(details: WebflowErrorDetails) {
    super(details.message);
    this.name = "WebflowError";
    this.code = details.code;
    this.httpStatus = details.httpStatus;
    this.retryable = details.retryable;
    this.retryAfter = details.retryAfter;
    this.field = details.field;
    this.context = details.context;
    this.timestamp = new Date();
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(): number {
    return (this.retryAfter || 1) * 1000;
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      field: this.field,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Authentication/Authorization errors
 */
export class WebflowAuthError extends WebflowError {
  constructor(message: string, code: WebflowErrorCode = WebflowErrorCode.UNAUTHORIZED, context?: Record<string, unknown>) {
    super({
      code,
      message,
      httpStatus: code === WebflowErrorCode.FORBIDDEN ? 403 : 401,
      retryable: false,
      context,
    });
    this.name = "WebflowAuthError";
  }
}

/**
 * Validation errors
 */
export class WebflowValidationError extends WebflowError {
  public readonly fieldErrors: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;

  constructor(
    message: string, 
    fieldErrors: Array<{ field: string; message: string; value?: unknown }> = [],
    context?: Record<string, unknown>
  ) {
    super({
      code: WebflowErrorCode.VALIDATION_ERROR,
      message,
      httpStatus: 400,
      retryable: false,
      context,
    });
    this.name = "WebflowValidationError";
    this.fieldErrors = fieldErrors;
  }

  /**
   * Get errors for a specific field
   */
  getFieldErrors(fieldName: string): string[] {
    return this.fieldErrors
      .filter(error => error.field === fieldName)
      .map(error => error.message);
  }

  /**
   * Get all field names with errors
   */
  getErrorFields(): string[] {
    return [...new Set(this.fieldErrors.map(error => error.field))];
  }
}

/**
 * Rate limiting errors
 */
export class WebflowRateLimitError extends WebflowError {
  public readonly rateLimitInfo: WebflowRateLimitInfo;

  constructor(rateLimitInfo: WebflowRateLimitInfo, context?: Record<string, unknown>) {
    super({
      code: WebflowErrorCode.RATE_LIMITED,
      message: `Rate limit exceeded. ${rateLimitInfo.remaining}/${rateLimitInfo.limit} requests remaining. Reset at ${rateLimitInfo.reset.toISOString()}`,
      httpStatus: 429,
      retryable: true,
      retryAfter: rateLimitInfo.retryAfter,
      context,
    });
    this.name = "WebflowRateLimitError";
    this.rateLimitInfo = rateLimitInfo;
  }
}

/**
 * Resource not found errors
 */
export class WebflowNotFoundError extends WebflowError {
  constructor(resource: string, id?: string, context?: Record<string, unknown>) {
    const message = id ? `${resource} with ID "${id}" not found` : `${resource} not found`;
    super({
      code: WebflowErrorCode.NOT_FOUND,
      message,
      httpStatus: 404,
      retryable: false,
      context,
    });
    this.name = "WebflowNotFoundError";
  }
}

/**
 * Server errors (5xx)
 */
export class WebflowServerError extends WebflowError {
  constructor(message: string, httpStatus: number = 500, context?: Record<string, unknown>) {
    super({
      code: WebflowErrorCode.INTERNAL_ERROR,
      message,
      httpStatus,
      retryable: true,
      retryAfter: 5, // Default 5 second retry
      context,
    });
    this.name = "WebflowServerError";
  }
}

/**
 * Network/Connection errors
 */
export class WebflowNetworkError extends WebflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super({
      code: WebflowErrorCode.NETWORK_ERROR,
      message,
      httpStatus: 0, // Network errors don't have HTTP status
      retryable: true,
      retryAfter: 3,
      context,
    });
    this.name = "WebflowNetworkError";
  }
}

/**
 * Parse Webflow API error response
 */
export function parseWebflowError(response: Response, responseBody?: unknown): WebflowError {
  const status = response.status;
  const url = response.url;
  
  // Extract rate limit headers
  const rateLimitInfo = extractRateLimitInfo(response);
  
  // Parse response body
  let errorData: Record<string, unknown> = {};
  if (responseBody && typeof responseBody === 'object') {
    errorData = responseBody as Record<string, unknown>;
  }

  const context = {
    url,
    status,
    headers: (() => {
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return headers;
    })(),
    responseBody: errorData,
  };

  // Rate limiting (429)
  if (status === 429) {
    return new WebflowRateLimitError(
      rateLimitInfo || {
        limit: 0,
        remaining: 0,
        reset: new Date(Date.now() + 60000), // Default 1 minute
        retryAfter: 60,
      },
      context
    );
  }

  // Authentication errors (401, 403)
  if (status === 401 || status === 403) {
    const code = status === 403 ? WebflowErrorCode.FORBIDDEN : WebflowErrorCode.UNAUTHORIZED;
    const message = typeof errorData.message === 'string' ? errorData.message : 
      (status === 403 ? "Forbidden: Insufficient permissions" : "Unauthorized: Invalid API token");
    
    // Check for missing scopes
    if (typeof errorData.message === 'string' && 
        errorData.message.toLowerCase().includes("missing") && 
        errorData.message.toLowerCase().includes("scopes")) {
      return new WebflowAuthError(errorData.message, WebflowErrorCode.MISSING_SCOPES, context);
    }
    
    return new WebflowAuthError(message, code, context);
  }

  // Not found errors (404)
  if (status === 404) {
    const _message = typeof errorData.message === 'string' ? errorData.message : "Resource not found";
    return new WebflowNotFoundError("Resource", undefined, context);
  }

  // Validation errors (400)
  if (status === 400) {
    const message = typeof errorData.message === 'string' ? errorData.message : "Validation error";
    
    // Parse field-specific validation errors
    const fieldErrors: Array<{ field: string; message: string; value?: unknown }> = [];
    
    if (errorData.details) {
      // Handle validation details
      for (const [key, detail] of Object.entries(errorData.details)) {
        if (typeof detail === 'object' && detail !== null) {
          const detailObj = detail as Record<string, unknown>;
          fieldErrors.push({
            field: typeof detailObj.param === 'string' ? detailObj.param : key,
            message: (typeof detailObj.description === 'string' ? detailObj.description : 
                     typeof detailObj.message === 'string' ? detailObj.message : 'Invalid value'),
            value: detailObj.value,
          });
        }
      }
    }

    return new WebflowValidationError(message, fieldErrors, context);
  }

  // Server errors (5xx)
  if (status >= 500) {
    const message = typeof errorData.message === 'string' ? errorData.message : `Server error: ${response.statusText}`;
    return new WebflowServerError(message, status, context);
  }

  // Client errors (4xx)
  if (status >= 400) {
    const message = typeof errorData.message === 'string' ? errorData.message : `Client error: ${response.statusText}`;
    return new WebflowError({
      code: WebflowErrorCode.UNKNOWN_ERROR,
      message,
      httpStatus: status,
      retryable: false,
      context,
    });
  }

  // Unknown error
  return new WebflowError({
    code: WebflowErrorCode.UNKNOWN_ERROR,
    message: typeof errorData.message === 'string' ? errorData.message : "Unknown Webflow API error",
    httpStatus: status,
    retryable: false,
    context,
  });
}

/**
 * Parse network/fetch errors
 */
export function parseNetworkError(error: Error): WebflowNetworkError {
  let message = "Network error occurred";
  
  if (error.message.includes("timeout")) {
    message = "Request timeout - Webflow API took too long to respond";
  } else if (error.message.includes("AbortError")) {
    message = "Request was aborted";
  } else if (error.message.includes("Failed to fetch")) {
    message = "Failed to connect to Webflow API";
  } else if (error.message.includes("NetworkError")) {
    message = "Network connection error";
  } else {
    message = `Network error: ${error.message}`;
  }

  return new WebflowNetworkError(message, {
    originalError: error.message,
    errorType: error.constructor.name,
  });
}

/**
 * Extract rate limit information from response headers
 */
function extractRateLimitInfo(response: Response): WebflowRateLimitInfo | null {
  const limit = response.headers.get("x-ratelimit-limit");
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");
  const retryAfter = response.headers.get("retry-after");

  if (!limit && !remaining && !reset && !retryAfter) {
    return null;
  }

  return {
    limit: limit ? parseInt(limit, 10) : 0,
    remaining: remaining ? parseInt(remaining, 10) : 0,
    reset: reset ? new Date(reset) : new Date(Date.now() + 60000),
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : 60,
  };
}

/**
 * Check if an error is a Webflow error
 */
export function isWebflowError(error: unknown): error is WebflowError {
  return error instanceof WebflowError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isWebflowError(error)) {
    return error.isRetryable();
  }
  
  // Network errors are generally retryable
  if (error instanceof Error) {
    return error.message.includes("timeout") || 
           error.message.includes("NetworkError") ||
           error.message.includes("Failed to fetch");
  }
  
  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: WebflowError): string {
  switch (error.code) {
    case WebflowErrorCode.UNAUTHORIZED:
      return "Authentication failed. Please check your API credentials.";
    
    case WebflowErrorCode.FORBIDDEN:
      return "Access denied. Your API token may not have sufficient permissions.";
    
    case WebflowErrorCode.MISSING_SCOPES:
      return "Your API token is missing required permissions. Please regenerate your token with the necessary scopes.";
    
    case WebflowErrorCode.RATE_LIMITED:
      return `Rate limit exceeded. Please wait ${error.retryAfter || 60} seconds before trying again.`;
    
    case WebflowErrorCode.NOT_FOUND:
      return "The requested resource could not be found.";
    
    case WebflowErrorCode.VALIDATION_ERROR:
      if (error instanceof WebflowValidationError && error.fieldErrors.length > 0) {
        const fieldNames = error.getErrorFields().join(", ");
        return `Validation failed for fields: ${fieldNames}. Please check your input data.`;
      }
      return "The submitted data contains validation errors. Please check your input.";
    
    case WebflowErrorCode.DUPLICATE_SLUG:
      return "This URL slug is already in use. Please choose a different one.";
    
    case WebflowErrorCode.CONTENT_TOO_LARGE:
      return "The content is too large. Please reduce the size and try again.";
    
    case WebflowErrorCode.NETWORK_ERROR:
      return "Network connection error. Please check your internet connection and try again.";
    
    case WebflowErrorCode.INTERNAL_ERROR:
    case WebflowErrorCode.SERVICE_UNAVAILABLE:
      return "Webflow service is temporarily unavailable. Please try again in a few minutes.";
    
    default:
      return error.message || "An unexpected error occurred. Please try again.";
  }
}

/**
 * Error recovery strategies
 */
export interface ErrorRecoveryStrategy {
  shouldRetry: boolean;
  retryDelay: number; // milliseconds
  maxRetries: number;
  backoffMultiplier: number;
}

export function getErrorRecoveryStrategy(error: WebflowError, attempt: number = 1): ErrorRecoveryStrategy {
  const baseDelay = error.getRetryDelay();
  
  // Rate limiting - respect the retry-after header
  if (error instanceof WebflowRateLimitError) {
    return {
      shouldRetry: true,
      retryDelay: Math.max(baseDelay, 1000), // At least 1 second
      maxRetries: 3,
      backoffMultiplier: 1, // Don't increase delay for rate limits
    };
  }
  
  // Server errors - exponential backoff
  if (error instanceof WebflowServerError) {
    return {
      shouldRetry: attempt <= 3,
      retryDelay: baseDelay * Math.pow(2, attempt - 1), // Exponential backoff
      maxRetries: 3,
      backoffMultiplier: 2,
    };
  }
  
  // Network errors - quick retry with backoff
  if (error instanceof WebflowNetworkError) {
    return {
      shouldRetry: attempt <= 2,
      retryDelay: baseDelay * Math.pow(1.5, attempt - 1),
      maxRetries: 2,
      backoffMultiplier: 1.5,
    };
  }
  
  // Other retryable errors
  if (error.isRetryable()) {
    return {
      shouldRetry: attempt <= 2,
      retryDelay: baseDelay,
      maxRetries: 2,
      backoffMultiplier: 1,
    };
  }
  
  // Non-retryable errors
  return {
    shouldRetry: false,
    retryDelay: 0,
    maxRetries: 0,
    backoffMultiplier: 1,
  };
}
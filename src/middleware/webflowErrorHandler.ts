/// <reference lib="deno.ns" />
import type { Context, Next } from "@hono/hono";
import { logger } from "@utils/logger.ts";
import {
  getErrorRecoveryStrategy,
  getUserFriendlyMessage,
  isWebflowError,
  WebflowAuthError,
  WebflowError,
  WebflowNetworkError,
  WebflowNotFoundError,
  WebflowRateLimitError,
  WebflowServerError,
  WebflowValidationError,
} from "@utils/webflowErrors.ts";

export interface WebflowErrorResponse {
  error: string;
  message: string;
  code?: string;
  field?: string;
  details?: unknown;
  retryable?: boolean;
  retryAfter?: number;
  timestamp: string;
  requestId?: string;
}

/**
 * Middleware to handle Webflow-specific errors
 */
export function webflowErrorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error) {
      const requestId = c.get("requestId") as string;

      // Handle Webflow-specific errors
      if (isWebflowError(error)) {
        return handleWebflowError(c, error, requestId);
      }

      // Handle other errors
      logger.error("Non-Webflow error in webflow handler", {
        requestId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      // Re-throw for the main error handler
      throw error;
    }
  };
}

/**
 * Handle Webflow-specific errors
 */
function handleWebflowError(c: Context, error: WebflowError, requestId?: string): Response {
  // Log the error with context
  logger.error("Webflow API error occurred", {
    requestId,
    errorCode: error.code,
    httpStatus: error.httpStatus,
    retryable: error.retryable,
    field: error.field,
    error: error instanceof Error ? error : new Error(String(error)),
  });

  // Create base error response
  const errorResponse: WebflowErrorResponse = {
    error: "Webflow API Error",
    message: getUserFriendlyMessage(error),
    code: error.code,
    retryable: error.retryable,
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Add specific error details
  if (error instanceof WebflowValidationError) {
    return handleValidationError(c, error, errorResponse);
  } else if (error instanceof WebflowRateLimitError) {
    return handleRateLimitError(c, error, errorResponse);
  } else if (error instanceof WebflowAuthError) {
    return handleAuthError(c, error, errorResponse);
  } else if (error instanceof WebflowNotFoundError) {
    return handleNotFoundError(c, error, errorResponse);
  } else if (error instanceof WebflowServerError) {
    return handleServerError(c, error, errorResponse);
  } else if (error instanceof WebflowNetworkError) {
    return handleNetworkError(c, error, errorResponse);
  }

  // Generic Webflow error
  // Map to appropriate status codes
  const statusCode = error.httpStatus === 400
    ? 400
    : error.httpStatus === 401
    ? 401
    : error.httpStatus === 403
    ? 403
    : error.httpStatus === 404
    ? 404
    : error.httpStatus === 429
    ? 429
    : error.httpStatus === 500
    ? 500
    : error.httpStatus === 502
    ? 502
    : error.httpStatus === 503
    ? 503
    : 500;
  return c.json(errorResponse, statusCode);
}

/**
 * Handle validation errors with field-specific details
 */
function handleValidationError(
  c: Context,
  error: WebflowValidationError,
  response: WebflowErrorResponse,
): Response {
  // Add field-specific validation errors
  const fieldErrors: Record<string, string[]> = {};

  for (const fieldError of error.fieldErrors) {
    if (!fieldErrors[fieldError.field]) {
      fieldErrors[fieldError.field] = [];
    }
    fieldErrors[fieldError.field].push(fieldError.message);
  }

  const validationResponse = {
    ...response,
    error: "Validation Error",
    message: "The submitted data contains validation errors",
    details: {
      fieldErrors,
      fields: error.getErrorFields(),
    },
  };

  logger.warn("Validation error details", {
    requestId: response.requestId,
    fieldErrors,
    errorCount: error.fieldErrors.length,
  });

  return c.json(validationResponse, 400);
}

/**
 * Handle rate limiting with retry information
 */
function handleRateLimitError(
  c: Context,
  error: WebflowRateLimitError,
  response: WebflowErrorResponse,
): Response {
  const rateLimitResponse = {
    ...response,
    error: "Rate Limit Exceeded",
    message: `Too many requests. Please wait ${error.rateLimitInfo.retryAfter} seconds`,
    retryAfter: error.rateLimitInfo.retryAfter,
    details: {
      limit: error.rateLimitInfo.limit,
      remaining: error.rateLimitInfo.remaining,
      reset: error.rateLimitInfo.reset.toISOString(),
    },
  };

  // Set standard rate limiting headers
  c.header("Retry-After", error.rateLimitInfo.retryAfter.toString());
  c.header("X-RateLimit-Limit", error.rateLimitInfo.limit.toString());
  c.header("X-RateLimit-Remaining", error.rateLimitInfo.remaining.toString());
  c.header("X-RateLimit-Reset", error.rateLimitInfo.reset.toISOString());

  logger.warn("Rate limit exceeded", {
    requestId: response.requestId,
    limit: error.rateLimitInfo.limit,
    remaining: error.rateLimitInfo.remaining,
    reset: error.rateLimitInfo.reset.toISOString(),
  });

  return c.json(rateLimitResponse, 429);
}

/**
 * Handle authentication/authorization errors
 */
function handleAuthError(
  c: Context,
  error: WebflowAuthError,
  response: WebflowErrorResponse,
): Response {
  const authResponse = {
    ...response,
    error: error.httpStatus === 403 ? "Forbidden" : "Unauthorized",
    message: getUserFriendlyMessage(error),
    details: {
      suggestion: error.code === "missing_scopes"
        ? "Please regenerate your API token with the required scopes"
        : "Please check your API credentials and try again",
    },
  };

  logger.warn("Authentication error", {
    requestId: response.requestId,
    errorCode: error.code,
    httpStatus: error.httpStatus,
  });

  return c.json(authResponse, error.httpStatus === 403 ? 403 : 401);
}

/**
 * Handle not found errors
 */
function handleNotFoundError(
  c: Context,
  error: WebflowNotFoundError,
  response: WebflowErrorResponse,
): Response {
  const notFoundResponse = {
    ...response,
    error: "Not Found",
    message: getUserFriendlyMessage(error),
    details: {
      suggestion: "Please verify the resource ID and your permissions",
    },
  };

  return c.json(notFoundResponse, 404);
}

/**
 * Handle server errors with retry information
 */
function handleServerError(
  c: Context,
  error: WebflowServerError,
  response: WebflowErrorResponse,
): Response {
  const strategy = getErrorRecoveryStrategy(error);

  const serverResponse = {
    ...response,
    error: "Server Error",
    message: "Webflow service is temporarily unavailable",
    retryAfter: Math.ceil(strategy.retryDelay / 1000),
    details: {
      suggestion: "Please try again in a few minutes",
      canRetry: strategy.shouldRetry,
    },
  };

  if (strategy.shouldRetry) {
    c.header("Retry-After", Math.ceil(strategy.retryDelay / 1000).toString());
  }

  logger.error("Webflow server error", {
    requestId: response.requestId,
    httpStatus: error.httpStatus,
    canRetry: strategy.shouldRetry,
    retryDelay: strategy.retryDelay,
  });

  return c.json(
    serverResponse,
    error.httpStatus === 502 ? 502 : error.httpStatus === 503 ? 503 : 500,
  );
}

/**
 * Handle network errors
 */
function handleNetworkError(
  c: Context,
  error: WebflowNetworkError,
  response: WebflowErrorResponse,
): Response {
  const strategy = getErrorRecoveryStrategy(error);

  const networkResponse = {
    ...response,
    error: "Network Error",
    message: "Unable to connect to Webflow service",
    retryAfter: Math.ceil(strategy.retryDelay / 1000),
    details: {
      suggestion: "Please check your internet connection and try again",
      canRetry: strategy.shouldRetry,
    },
  };

  logger.error("Network error communicating with Webflow", {
    requestId: response.requestId,
    canRetry: strategy.shouldRetry,
    retryDelay: strategy.retryDelay,
  });

  return c.json(networkResponse, 503); // Service Unavailable
}

/**
 * Helper to format error for client consumption
 */
export function formatErrorForClient(error: WebflowError): WebflowErrorResponse {
  return {
    error: error.constructor.name.replace("Webflow", "").replace("Error", ""),
    message: getUserFriendlyMessage(error),
    code: error.code,
    field: error.field,
    retryable: error.retryable,
    retryAfter: error.retryAfter,
    timestamp: error.timestamp.toISOString(),
  };
}

/**
 * Helper to check if operation should be retried
 */
export function shouldRetryOperation(error: WebflowError, attempt: number = 1): boolean {
  const strategy = getErrorRecoveryStrategy(error, attempt);
  return strategy.shouldRetry && attempt <= strategy.maxRetries;
}

/**
 * Helper to get retry delay for an operation
 */
export function getRetryDelay(error: WebflowError, attempt: number = 1): number {
  const strategy = getErrorRecoveryStrategy(error, attempt);
  return strategy.retryDelay;
}

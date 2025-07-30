/// <reference lib="deno.ns" />

// Base error class with additional context
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    isOperational = true,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

// Validation errors (400)
export class ValidationError extends BaseError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(message, "VALIDATION_ERROR", 400, true, context);
    this.field = field;
    this.value = value;
  }
}

// Webflow API errors
export class WebflowError extends BaseError {
  public readonly webflowCode?: string;
  public readonly webflowMessage?: string;

  constructor(
    message: string,
    statusCode: number,
    webflowCode?: string,
    webflowMessage?: string,
    context?: Record<string, unknown>,
  ) {
    super(
      message,
      `WEBFLOW_${webflowCode || "ERROR"}`,
      statusCode,
      true,
      context,
    );
    this.webflowCode = webflowCode;
    this.webflowMessage = webflowMessage;
  }
}

// Authentication errors (401)
export class AuthenticationError extends BaseError {
  constructor(message = "Authentication required", context?: Record<string, unknown>) {
    super(message, "AUTHENTICATION_ERROR", 401, true, context);
  }
}

// Authorization errors (403)
export class AuthorizationError extends BaseError {
  constructor(message = "Insufficient permissions", context?: Record<string, unknown>) {
    super(message, "AUTHORIZATION_ERROR", 403, true, context);
  }
}

// Not found errors (404)
export class NotFoundError extends BaseError {
  public readonly resource?: string;

  constructor(resource?: string, message?: string, context?: Record<string, unknown>) {
    const defaultMessage = resource ? `${resource} not found` : "Resource not found";
    super(message || defaultMessage, "NOT_FOUND", 404, true, context);
    this.resource = resource;
  }
}

// Conflict errors (409)
export class ConflictError extends BaseError {
  public readonly conflictingResource?: string;

  constructor(
    message: string,
    conflictingResource?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, "CONFLICT", 409, true, context);
    this.conflictingResource = conflictingResource;
  }
}

// Rate limit errors (429)
export class RateLimitError extends BaseError {
  public readonly retryAfter?: number;
  public readonly limit?: number;
  public readonly remaining?: number;
  public readonly reset?: Date;

  constructor(
    message = "Too many requests",
    retryAfter?: number,
    limit?: number,
    remaining?: number,
    reset?: Date,
    context?: Record<string, unknown>,
  ) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, true, context);
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.remaining = remaining;
    this.reset = reset;
  }
}

// External service errors (502)
export class ExternalServiceError extends BaseError {
  public readonly service: string;

  constructor(
    service: string,
    message?: string,
    context?: Record<string, unknown>,
  ) {
    const defaultMessage = `External service ${service} is unavailable`;
    super(
      message || defaultMessage,
      "EXTERNAL_SERVICE_ERROR",
      502,
      true,
      context,
    );
    this.service = service;
  }
}

// Timeout errors (504)
export class TimeoutError extends BaseError {
  public readonly timeout: number;

  constructor(
    timeout: number,
    operation?: string,
    context?: Record<string, unknown>,
  ) {
    const message = operation
      ? `Operation '${operation}' timed out after ${timeout}ms`
      : `Request timed out after ${timeout}ms`;
    super(message, "TIMEOUT", 504, true, context);
    this.timeout = timeout;
  }
}

// Business logic errors
export class BusinessLogicError extends BaseError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, 400, true, context);
  }
}

// Content processing errors
export class ContentProcessingError extends BaseError {
  public readonly stage?: string;

  constructor(
    message: string,
    stage?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, "CONTENT_PROCESSING_ERROR", 422, true, context);
    this.stage = stage;
  }
}

// Error type guards
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

export function isOperationalError(error: unknown): boolean {
  if (isBaseError(error)) {
    return error.isOperational;
  }
  return false;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isWebflowError(error: unknown): error is WebflowError {
  return error instanceof WebflowError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

// Error factory for creating errors from Webflow API responses
export function createWebflowError(
  response: {
    status: number;
    statusText?: string;
    body?: {
      err?: string;
      error?: string;
      message?: string;
      code?: string;
      details?: unknown;
    };
  },
): WebflowError {
  const { status, statusText, body } = response;
  const errorMessage = body?.err || body?.error || body?.message || statusText ||
    "Webflow API error";
  const errorCode = body?.code;

  return new WebflowError(
    errorMessage,
    status,
    errorCode,
    errorMessage,
    { details: body?.details },
  );
}

// Error factory for validation errors from Zod or other validators
export function createValidationError(
  errors: Array<{ path: string[]; message: string }> | Record<string, string>,
): ValidationError {
  if (Array.isArray(errors)) {
    // Handle array of errors (like from Zod)
    const firstError = errors[0];
    if (firstError) {
      return new ValidationError(
        firstError.message,
        firstError.path.join("."),
        undefined,
        { allErrors: errors },
      );
    }
  } else {
    // Handle object of errors
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      return new ValidationError(
        errors[firstKey],
        firstKey,
        undefined,
        { allErrors: errors },
      );
    }
  }

  return new ValidationError("Validation failed");
}

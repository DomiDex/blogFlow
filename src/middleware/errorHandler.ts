/// <reference lib="deno.ns" />
import type { MiddlewareHandler } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { logger } from "@utils/logger.ts";
import { config } from "@config/index.ts";
import type { Variables } from "@app-types";
import {
  BaseError as _BaseError,
  ValidationError as _ValidationError,
  WebflowError as _WebflowError,
  RateLimitError as _RateLimitError,
  isBaseError,
  isValidationError,
  isRateLimitError,
  isOperationalError,
} from "@utils/errors.ts";

interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  field?: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
}

export const errorHandler = (): MiddlewareHandler<{ Variables: Variables }> => {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      const requestId = c.get("requestId") || "unknown";
      const isDevelopment = config.NODE_ENV === "development";

      // Default error values
      let status = 500;
      let message = "Internal Server Error";
      let code = "INTERNAL_ERROR";
      let field: string | undefined;
      let details: unknown = undefined;
      let userMessage = "An unexpected error occurred. Please try again later.";

      // Handle different error types
      if (isBaseError(error)) {
        // Our custom errors
        status = error.statusCode;
        message = error.message;
        code = error.code;
        userMessage = error.message;

        if (isValidationError(error)) {
          field = error.field;
          details = error.context?.allErrors || undefined;
          userMessage = `Invalid ${field || "input"}: ${message}`;
        }

        if (isRateLimitError(error)) {
          if (error.retryAfter) {
            c.header("Retry-After", String(error.retryAfter));
          }
          if (error.reset) {
            c.header("X-RateLimit-Reset", error.reset.toISOString());
          }
          if (error.limit !== undefined) {
            c.header("X-RateLimit-Limit", String(error.limit));
          }
          if (error.remaining !== undefined) {
            c.header("X-RateLimit-Remaining", String(error.remaining));
          }
        }

        // Include context in development
        if (isDevelopment && error.context && details) {
          details = { ...details, context: error.context };
        }
      } else if (error instanceof HTTPException) {
        // Hono HTTP exceptions
        status = error.status;
        message = error.message;
        code = `HTTP_${status}`;
        userMessage = error.message;
      } else if (error instanceof Error) {
        // Regular errors
        message = error.message;
        userMessage = isDevelopment ? error.message : "An unexpected error occurred";
        
        // Try to infer error type from error name
        const errorNameMap: Record<string, { status: number; code: string }> = {
          SyntaxError: { status: 400, code: "INVALID_JSON" },
          TypeError: { status: 400, code: "TYPE_ERROR" },
          RangeError: { status: 400, code: "RANGE_ERROR" },
          TimeoutError: { status: 504, code: "TIMEOUT" },
        };

        const mapped = errorNameMap[error.name];
        if (mapped) {
          status = mapped.status;
          code = mapped.code;
        }
      }

      // Check if it's an operational error
      const operational = isOperationalError(error);

      // Log the error with appropriate level
      const logLevel = operational && status < 500 ? "warn" : "error";
      logger[logLevel](`Error handling request: ${message}`, {
        requestId,
        method: c.req.method,
        path: c.req.path,
        statusCode: status,
        errorCode: code,
        error: error instanceof Error ? error : new Error(String(error)),
        userAgent: c.req.header("user-agent"),
        clientIP: c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown",
        operational,
      });

      // Prepare error response
      const errorResponse: ErrorResponse = {
        error: userMessage,
        code,
        message,
        requestId,
        timestamp: new Date().toISOString(),
      };

      if (field) {
        errorResponse.field = field;
      }

      // Add details based on environment and error type
      if (isDevelopment) {
        if (error instanceof Error) {
          errorResponse.details = {
            stack: error.stack,
            name: error.name,
            cause: error.cause,
            ...(details ? { validationErrors: details } : {}),
          };
        } else if (details) {
          errorResponse.details = details;
        }
      } else if (isValidationError(error) && details) {
        // In production, only show validation details
        errorResponse.details = details;
      }

      // Set response headers
      c.header("Content-Type", "application/json");
      c.header("X-Error-Code", code);
      c.header("X-Request-ID", requestId);

      // Send alert for non-operational errors in production
      if (!operational && config.NODE_ENV === "production") {
        // TODO: Implement alerting (Sentry, PagerDuty, etc.)
        logger.error("Non-operational error occurred - alert required", {
          requestId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }

      // Return error response
      return c.json(errorResponse, status as 400 | 401 | 403 | 404 | 429 | 500);
    }
  };
};
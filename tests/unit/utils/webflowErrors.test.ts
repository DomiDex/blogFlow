/// <reference lib="deno.ns" />

import { assertEquals, assertInstanceOf } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  WebflowError,
  WebflowAuthError,
  WebflowValidationError,
  WebflowRateLimitError,
  WebflowNotFoundError,
  WebflowServerError,
  WebflowNetworkError,
  WebflowErrorCode,
  parseWebflowError,
  parseNetworkError,
  isWebflowError,
  isRetryableError,
  getUserFriendlyMessage,
  getErrorRecoveryStrategy,
  type WebflowRateLimitInfo,
} from "@utils/webflowErrors.ts";

describe("WebflowErrors", () => {
  describe("WebflowError Base Class", () => {
    it("should create error with all properties", () => {
      const error = new WebflowError({
        code: WebflowErrorCode.UNKNOWN_ERROR,
        message: "Test error",
        httpStatus: 500,
        retryable: true,
        retryAfter: 5,
        field: "testField",
        context: { key: "value" },
      });

      assertEquals(error.message, "Test error");
      assertEquals(error.code, WebflowErrorCode.UNKNOWN_ERROR);
      assertEquals(error.httpStatus, 500);
      assertEquals(error.retryable, true);
      assertEquals(error.retryAfter, 5);
      assertEquals(error.field, "testField");
      assertEquals(error.context, { key: "value" });
      assertInstanceOf(error.timestamp, Date);
    });

    it("should check if error is retryable", () => {
      const retryableError = new WebflowError({
        code: WebflowErrorCode.INTERNAL_ERROR,
        message: "Server error",
        httpStatus: 500,
        retryable: true,
      });

      const nonRetryableError = new WebflowError({
        code: WebflowErrorCode.VALIDATION_ERROR,
        message: "Invalid data",
        httpStatus: 400,
        retryable: false,
      });

      assertEquals(retryableError.isRetryable(), true);
      assertEquals(nonRetryableError.isRetryable(), false);
    });

    it("should calculate retry delay", () => {
      const errorWithDelay = new WebflowError({
        code: WebflowErrorCode.RATE_LIMITED,
        message: "Rate limited",
        httpStatus: 429,
        retryable: true,
        retryAfter: 30,
      });

      const errorWithoutDelay = new WebflowError({
        code: WebflowErrorCode.INTERNAL_ERROR,
        message: "Server error",
        httpStatus: 500,
        retryable: true,
      });

      assertEquals(errorWithDelay.getRetryDelay(), 30000); // 30 seconds in ms
      assertEquals(errorWithoutDelay.getRetryDelay(), 1000); // Default 1 second
    });

    it("should convert to JSON", () => {
      const error = new WebflowError({
        code: WebflowErrorCode.VALIDATION_ERROR,
        message: "Validation failed",
        httpStatus: 400,
        retryable: false,
        field: "email",
        context: { input: "invalid-email" },
      });

      const json = error.toJSON();
      assertEquals(json.name, "WebflowError");
      assertEquals(json.message, "Validation failed");
      assertEquals(json.code, WebflowErrorCode.VALIDATION_ERROR);
      assertEquals(json.httpStatus, 400);
      assertEquals(json.retryable, false);
      assertEquals(json.field, "email");
      assertEquals(json.context, { input: "invalid-email" });
      assertEquals(typeof json.timestamp, "string");
      assertEquals(typeof json.stack, "string");
    });
  });

  describe("WebflowAuthError", () => {
    it("should create auth error with 401 status", () => {
      const error = new WebflowAuthError("Invalid API token");

      assertEquals(error.message, "Invalid API token");
      assertEquals(error.code, WebflowErrorCode.UNAUTHORIZED);
      assertEquals(error.httpStatus, 401);
      assertEquals(error.retryable, false);
      assertEquals(error.name, "WebflowAuthError");
    });

    it("should create forbidden error with 403 status", () => {
      const error = new WebflowAuthError(
        "Insufficient permissions",
        WebflowErrorCode.FORBIDDEN
      );

      assertEquals(error.code, WebflowErrorCode.FORBIDDEN);
      assertEquals(error.httpStatus, 403);
    });

    it("should handle missing scopes", () => {
      const error = new WebflowAuthError(
        "Missing required scopes: cms:write",
        WebflowErrorCode.MISSING_SCOPES,
        { requiredScopes: ["cms:write"] }
      );

      assertEquals(error.code, WebflowErrorCode.MISSING_SCOPES);
      assertEquals(error.context?.requiredScopes, ["cms:write"]);
    });
  });

  describe("WebflowValidationError", () => {
    it("should create validation error with field errors", () => {
      const fieldErrors = [
        { field: "email", message: "Invalid email format" },
        { field: "name", message: "Name is required" },
        { field: "email", message: "Email already exists", value: "test@test.com" },
      ];

      const error = new WebflowValidationError(
        "Validation failed",
        fieldErrors
      );

      assertEquals(error.message, "Validation failed");
      assertEquals(error.code, WebflowErrorCode.VALIDATION_ERROR);
      assertEquals(error.httpStatus, 400);
      assertEquals(error.retryable, false);
      assertEquals(error.fieldErrors, fieldErrors);
    });

    it("should get field-specific errors", () => {
      const fieldErrors = [
        { field: "email", message: "Invalid format" },
        { field: "email", message: "Already exists" },
        { field: "name", message: "Too short" },
      ];

      const error = new WebflowValidationError("Failed", fieldErrors);

      const emailErrors = error.getFieldErrors("email");
      assertEquals(emailErrors, ["Invalid format", "Already exists"]);

      const nameErrors = error.getFieldErrors("name");
      assertEquals(nameErrors, ["Too short"]);

      const unknownErrors = error.getFieldErrors("unknown");
      assertEquals(unknownErrors, []);
    });

    it("should get all error fields", () => {
      const fieldErrors = [
        { field: "email", message: "Invalid" },
        { field: "name", message: "Required" },
        { field: "email", message: "Duplicate" },
        { field: "slug", message: "Invalid chars" },
      ];

      const error = new WebflowValidationError("Failed", fieldErrors);
      const errorFields = error.getErrorFields();

      assertEquals(errorFields.sort(), ["email", "name", "slug"]);
    });
  });

  describe("WebflowRateLimitError", () => {
    it("should create rate limit error", () => {
      const rateLimitInfo: WebflowRateLimitInfo = {
        limit: 60,
        remaining: 0,
        reset: new Date("2024-01-01T12:00:00Z"),
        retryAfter: 300,
      };

      const error = new WebflowRateLimitError(rateLimitInfo);

      assertInstanceOf(error, WebflowRateLimitError);
      assertEquals(error.code, WebflowErrorCode.RATE_LIMITED);
      assertEquals(error.httpStatus, 429);
      assertEquals(error.retryable, true);
      assertEquals(error.retryAfter, 300);
      assertEquals(error.rateLimitInfo, rateLimitInfo);
      assertEquals(
        error.message.includes("Rate limit exceeded"),
        true
      );
    });
  });

  describe("WebflowNotFoundError", () => {
    it("should create not found error with resource and id", () => {
      const error = new WebflowNotFoundError("Collection", "abc123");

      assertEquals(error.message, 'Collection with ID "abc123" not found');
      assertEquals(error.code, WebflowErrorCode.NOT_FOUND);
      assertEquals(error.httpStatus, 404);
      assertEquals(error.retryable, false);
    });

    it("should create not found error without id", () => {
      const error = new WebflowNotFoundError("Site");

      assertEquals(error.message, "Site not found");
    });
  });

  describe("WebflowServerError", () => {
    it("should create server error with defaults", () => {
      const error = new WebflowServerError("Internal server error");

      assertEquals(error.message, "Internal server error");
      assertEquals(error.code, WebflowErrorCode.INTERNAL_ERROR);
      assertEquals(error.httpStatus, 500);
      assertEquals(error.retryable, true);
      assertEquals(error.retryAfter, 5);
    });

    it("should create server error with custom status", () => {
      const error = new WebflowServerError("Gateway timeout", 504);

      assertEquals(error.httpStatus, 504);
    });
  });

  describe("WebflowNetworkError", () => {
    it("should create network error", () => {
      const error = new WebflowNetworkError("Connection timeout");

      assertEquals(error.message, "Connection timeout");
      assertEquals(error.code, WebflowErrorCode.NETWORK_ERROR);
      assertEquals(error.httpStatus, 0);
      assertEquals(error.retryable, true);
      assertEquals(error.retryAfter, 3);
    });
  });

  describe("parseWebflowError", () => {
    it("should parse 429 rate limit error", () => {
      const headers = new Headers({
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "2024-01-01T12:00:00Z",
        "retry-after": "300",
      });

      const response = new Response(null, {
        status: 429,
        headers,
      });

      const error = parseWebflowError(response);

      assertInstanceOf(error, WebflowRateLimitError);
      assertEquals(error.httpStatus, 429);
      const rateLimitError = error as WebflowRateLimitError;
      assertEquals(rateLimitError.rateLimitInfo.limit, 60);
      assertEquals(rateLimitError.rateLimitInfo.remaining, 0);
      assertEquals(rateLimitError.rateLimitInfo.retryAfter, 300);
    });

    it("should parse 401 auth error", () => {
      const response = new Response(null, { status: 401 });
      const responseBody = { message: "Invalid API token" };

      const error = parseWebflowError(response, responseBody);

      assertInstanceOf(error, WebflowAuthError);
      assertEquals(error.code, WebflowErrorCode.UNAUTHORIZED);
      assertEquals(error.message, "Invalid API token");
    });

    it("should parse 403 forbidden error", () => {
      const response = new Response(null, { status: 403 });
      const responseBody = { message: "Forbidden: Missing scopes: cms:write" };

      const error = parseWebflowError(response, responseBody);

      assertInstanceOf(error, WebflowAuthError);
      assertEquals(error.code, WebflowErrorCode.MISSING_SCOPES); // Correctly expecting MISSING_SCOPES
    });

    it("should parse 404 not found error", () => {
      const response = new Response(null, { status: 404 });

      const error = parseWebflowError(response);

      assertInstanceOf(error, WebflowNotFoundError);
      assertEquals(error.httpStatus, 404);
    });

    it("should parse 400 validation error", () => {
      const response = new Response(null, { status: 400 });
      const responseBody = {
        message: "Validation failed",
        details: {
          email: {
            param: "email",
            description: "Invalid email format",
            value: "not-an-email",
          },
          name: {
            message: "Name is required",
          },
        },
      };

      const error = parseWebflowError(response, responseBody);

      assertInstanceOf(error, WebflowValidationError);
      const validationError = error as WebflowValidationError;
      assertEquals(validationError.fieldErrors.length, 2);
      assertEquals(validationError.fieldErrors[0].field, "email");
      assertEquals(validationError.fieldErrors[0].message, "Invalid email format");
      assertEquals(validationError.fieldErrors[1].field, "name");
    });

    it("should parse 500+ server errors", () => {
      const response = new Response(null, { 
        status: 503,
        statusText: "Service Unavailable",
      });

      const error = parseWebflowError(response);

      assertInstanceOf(error, WebflowServerError);
      assertEquals(error.httpStatus, 503);
      assertEquals(error.retryable, true);
    });

    it("should parse unknown 4xx errors", () => {
      const response = new Response(null, { 
        status: 418,
        statusText: "I'm a teapot",
      });

      const error = parseWebflowError(response);

      assertInstanceOf(error, WebflowError);
      assertEquals(error.code, WebflowErrorCode.UNKNOWN_ERROR);
      assertEquals(error.httpStatus, 418);
      assertEquals(error.retryable, false);
    });

    it("should include context in all errors", () => {
      const headers = new Headers({
        "x-request-id": "req-123",
        "content-type": "application/json",
      });

      const response = new Response(null, {
        status: 500,
        headers,
      });

      const error = parseWebflowError(response, { message: "Server error" });

      assertEquals(error.context?.status, 500);
      // Response.url is empty string when created with null body
      assertEquals(error.context?.url, "");
      assertEquals((error.context?.headers as any)["x-request-id"], "req-123");
      assertEquals((error.context?.responseBody as any).message, "Server error");
    });
  });

  describe("parseNetworkError", () => {
    it("should parse timeout errors", () => {
      const timeoutError = new Error("Request timeout");
      const error = parseNetworkError(timeoutError);

      assertInstanceOf(error, WebflowNetworkError);
      assertEquals(
        error.message,
        "Request timeout - Webflow API took too long to respond"
      );
    });

    it("should parse abort errors", () => {
      const abortError = new Error("AbortError: The operation was aborted");
      const error = parseNetworkError(abortError);

      assertEquals(error.message, "Request was aborted");
    });

    it("should parse fetch failures", () => {
      const fetchError = new Error("Failed to fetch");
      const error = parseNetworkError(fetchError);

      assertEquals(error.message, "Failed to connect to Webflow API");
    });

    it("should parse generic network errors", () => {
      const networkError = new Error("NetworkError: DNS lookup failed");
      const error = parseNetworkError(networkError);

      assertEquals(error.message, "Network connection error");
    });

    it("should handle unknown errors", () => {
      const unknownError = new Error("Something went wrong");
      const error = parseNetworkError(unknownError);

      assertEquals(error.message, "Network error: Something went wrong");
    });
  });

  describe("Utility Functions", () => {
    it("isWebflowError should identify Webflow errors", () => {
      const webflowError = new WebflowError({
        code: WebflowErrorCode.UNKNOWN_ERROR,
        message: "Test",
        httpStatus: 500,
        retryable: false,
      });

      const regularError = new Error("Regular error");

      assertEquals(isWebflowError(webflowError), true);
      assertEquals(isWebflowError(regularError), false);
      assertEquals(isWebflowError(null), false);
      assertEquals(isWebflowError("string"), false);
    });

    it("isRetryableError should check retryability", () => {
      const retryableWebflowError = new WebflowServerError("Server error");
      const nonRetryableWebflowError = new WebflowValidationError("Invalid");
      const networkError = new Error("Failed to fetch");
      const regularError = new Error("Some error");

      assertEquals(isRetryableError(retryableWebflowError), true);
      assertEquals(isRetryableError(nonRetryableWebflowError), false);
      assertEquals(isRetryableError(networkError), true);
      assertEquals(isRetryableError(regularError), false);
    });
  });

  describe("getUserFriendlyMessage", () => {
    it("should provide friendly messages for each error type", () => {
      const testCases = [
        {
          error: new WebflowAuthError("Auth failed"),
          expected: "Authentication failed. Please check your API credentials.",
        },
        {
          error: new WebflowAuthError("Forbidden", WebflowErrorCode.FORBIDDEN),
          expected: "Access denied. Your API token may not have sufficient permissions.",
        },
        {
          error: new WebflowAuthError("Missing scopes", WebflowErrorCode.MISSING_SCOPES),
          expected: "Your API token is missing required permissions. Please regenerate your token with the necessary scopes.",
        },
        {
          error: new WebflowRateLimitError({
            limit: 60,
            remaining: 0,
            reset: new Date(),
            retryAfter: 30,
          }),
          expected: "Rate limit exceeded. Please wait 30 seconds before trying again.",
        },
        {
          error: new WebflowNotFoundError("Item"),
          expected: "The requested resource could not be found.",
        },
        {
          error: new WebflowValidationError("Failed", [
            { field: "email", message: "Invalid" },
            { field: "name", message: "Required" },
          ]),
          expected: "Validation failed for fields: email, name. Please check your input data.",
        },
        {
          error: new WebflowServerError("Server error"),
          expected: "Webflow service is temporarily unavailable. Please try again in a few minutes.",
        },
        {
          error: new WebflowNetworkError("Network error"),
          expected: "Network connection error. Please check your internet connection and try again.",
        },
      ];

      for (const { error, expected } of testCases) {
        const message = getUserFriendlyMessage(error);
        assertEquals(message, expected);
      }
    });

    it("should handle special error codes", () => {
      const duplicateSlugError = new WebflowError({
        code: WebflowErrorCode.DUPLICATE_SLUG,
        message: "Slug exists",
        httpStatus: 400,
        retryable: false,
      });

      const contentTooLargeError = new WebflowError({
        code: WebflowErrorCode.CONTENT_TOO_LARGE,
        message: "Too large",
        httpStatus: 413,
        retryable: false,
      });

      assertEquals(
        getUserFriendlyMessage(duplicateSlugError),
        "This URL slug is already in use. Please choose a different one."
      );

      assertEquals(
        getUserFriendlyMessage(contentTooLargeError),
        "The content is too large. Please reduce the size and try again."
      );
    });
  });

  describe("getErrorRecoveryStrategy", () => {
    it("should handle rate limit errors", () => {
      const error = new WebflowRateLimitError({
        limit: 60,
        remaining: 0,
        reset: new Date(),
        retryAfter: 10,
      });

      const strategy = getErrorRecoveryStrategy(error);

      assertEquals(strategy.shouldRetry, true);
      assertEquals(strategy.retryDelay, 10000); // 10 seconds
      assertEquals(strategy.maxRetries, 3);
      assertEquals(strategy.backoffMultiplier, 1);
    });

    it("should handle server errors with exponential backoff", () => {
      const error = new WebflowServerError("Server error");

      const strategy1 = getErrorRecoveryStrategy(error, 1);
      const strategy2 = getErrorRecoveryStrategy(error, 2);
      const strategy3 = getErrorRecoveryStrategy(error, 3);
      const strategy4 = getErrorRecoveryStrategy(error, 4);

      assertEquals(strategy1.shouldRetry, true);
      assertEquals(strategy1.retryDelay, 5000); // 5s

      assertEquals(strategy2.shouldRetry, true);
      assertEquals(strategy2.retryDelay, 10000); // 10s (5s * 2^1)

      assertEquals(strategy3.shouldRetry, true);
      assertEquals(strategy3.retryDelay, 20000); // 20s (5s * 2^2)

      assertEquals(strategy4.shouldRetry, false); // Max retries exceeded
    });

    it("should handle network errors", () => {
      const error = new WebflowNetworkError("Network error");

      const strategy1 = getErrorRecoveryStrategy(error, 1);
      const strategy2 = getErrorRecoveryStrategy(error, 2);
      const strategy3 = getErrorRecoveryStrategy(error, 3);

      assertEquals(strategy1.shouldRetry, true);
      assertEquals(strategy1.retryDelay, 3000); // 3s

      assertEquals(strategy2.shouldRetry, true);
      assertEquals(strategy2.retryDelay, 4500); // 3s * 1.5

      assertEquals(strategy3.shouldRetry, false); // Max 2 retries
    });

    it("should handle non-retryable errors", () => {
      const error = new WebflowValidationError("Invalid data");

      const strategy = getErrorRecoveryStrategy(error);

      assertEquals(strategy.shouldRetry, false);
      assertEquals(strategy.retryDelay, 0);
      assertEquals(strategy.maxRetries, 0);
    });

    it("should handle generic retryable errors", () => {
      const error = new WebflowError({
        code: WebflowErrorCode.UNKNOWN_ERROR,
        message: "Unknown",
        httpStatus: 500,
        retryable: true,
        retryAfter: 2,
      });

      const strategy = getErrorRecoveryStrategy(error);

      assertEquals(strategy.shouldRetry, true);
      assertEquals(strategy.retryDelay, 2000);
      assertEquals(strategy.maxRetries, 2);
    });
  });
});
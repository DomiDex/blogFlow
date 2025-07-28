import { assertEquals, assertInstanceOf } from "@std/testing/asserts";
import {
  BaseError,
  ValidationError,
  WebflowError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  TimeoutError,
  BusinessLogicError,
  ContentProcessingError,
  isBaseError,
  isOperationalError,
  isValidationError,
  isWebflowError,
  isRateLimitError,
  createWebflowError,
  createValidationError,
} from "@/utils/errors.ts";

// Since BaseError is abstract, we'll create a concrete implementation for testing
class TestError extends BaseError {
  constructor(message: string, code = "TEST_ERROR", statusCode = 500) {
    super(message, code, statusCode);
  }
}

Deno.test("BaseError - creates error with default properties", () => {
  const error = new TestError("Test error");
  
  assertEquals(error.message, "Test error");
  assertEquals(error.name, "TestError");
  assertEquals(error.code, "TEST_ERROR");
  assertEquals(error.statusCode, 500);
  assertEquals(error.isOperational, true);
  assertInstanceOf(error, Error);
  assertInstanceOf(error, BaseError);
});

Deno.test("BaseError - creates error with custom properties", () => {
  const error = new TestError("Custom error", "CUSTOM_CODE", 400);
  
  assertEquals(error.message, "Custom error");
  assertEquals(error.code, "CUSTOM_CODE");
  assertEquals(error.statusCode, 400);
});

Deno.test("BaseError - includes context", () => {
  const context = { userId: 123, action: "create" };
  const error = new BusinessLogicError("Business error", "BIZ_ERROR", context);
  
  assertEquals(error.context, context);
});

Deno.test("ValidationError - creates validation error", () => {
  const error = new ValidationError("Invalid data", "email", "invalid@");
  
  assertEquals(error.message, "Invalid data");
  assertEquals(error.name, "ValidationError");
  assertEquals(error.statusCode, 400);
  assertEquals(error.code, "VALIDATION_ERROR");
  assertEquals(error.field, "email");
  assertEquals(error.value, "invalid@");
  assertInstanceOf(error, ValidationError);
  assertInstanceOf(error, BaseError);
});

Deno.test("WebflowError - creates API error", () => {
  const error = new WebflowError(
    "API request failed",
    429,
    "rate_limit_exceeded",
    "Rate limit exceeded"
  );
  
  assertEquals(error.message, "API request failed");
  assertEquals(error.name, "WebflowError");
  assertEquals(error.statusCode, 429);
  assertEquals(error.code, "WEBFLOW_rate_limit_exceeded");
  assertEquals(error.webflowCode, "rate_limit_exceeded");
  assertEquals(error.webflowMessage, "Rate limit exceeded");
  assertInstanceOf(error, WebflowError);
  assertInstanceOf(error, BaseError);
});

Deno.test("AuthenticationError - creates auth error", () => {
  const error = new AuthenticationError();
  
  assertEquals(error.message, "Authentication required");
  assertEquals(error.name, "AuthenticationError");
  assertEquals(error.statusCode, 401);
  assertEquals(error.code, "AUTHENTICATION_ERROR");
});

Deno.test("AuthorizationError - creates authorization error", () => {
  const error = new AuthorizationError("Admin access required");
  
  assertEquals(error.message, "Admin access required");
  assertEquals(error.name, "AuthorizationError");
  assertEquals(error.statusCode, 403);
  assertEquals(error.code, "AUTHORIZATION_ERROR");
});

Deno.test("NotFoundError - creates not found error", () => {
  const error1 = new NotFoundError("User", "User with ID 123 not found");
  assertEquals(error1.message, "User with ID 123 not found");
  assertEquals(error1.resource, "User");
  assertEquals(error1.statusCode, 404);
  
  const error2 = new NotFoundError("Article");
  assertEquals(error2.message, "Article not found");
  
  const error3 = new NotFoundError();
  assertEquals(error3.message, "Resource not found");
});

Deno.test("ConflictError - creates conflict error", () => {
  const error = new ConflictError("Slug already exists", "article-slug");
  
  assertEquals(error.message, "Slug already exists");
  assertEquals(error.conflictingResource, "article-slug");
  assertEquals(error.statusCode, 409);
  assertEquals(error.code, "CONFLICT");
});

Deno.test("RateLimitError - creates rate limit error", () => {
  const reset = new Date();
  const error = new RateLimitError(
    "Too many requests",
    60,
    100,
    0,
    reset
  );
  
  assertEquals(error.message, "Too many requests");
  assertEquals(error.retryAfter, 60);
  assertEquals(error.limit, 100);
  assertEquals(error.remaining, 0);
  assertEquals(error.reset, reset);
  assertEquals(error.statusCode, 429);
  assertEquals(error.code, "RATE_LIMIT_EXCEEDED");
});

Deno.test("ExternalServiceError - creates external service error", () => {
  const error = new ExternalServiceError("webflow", "Service unavailable");
  
  assertEquals(error.message, "Service unavailable");
  assertEquals(error.service, "webflow");
  assertEquals(error.statusCode, 502);
  assertEquals(error.code, "EXTERNAL_SERVICE_ERROR");
  
  const error2 = new ExternalServiceError("github");
  assertEquals(error2.message, "External service github is unavailable");
});

Deno.test("TimeoutError - creates timeout error", () => {
  const error = new TimeoutError(30000, "API request");
  
  assertEquals(error.message, "Operation 'API request' timed out after 30000ms");
  assertEquals(error.timeout, 30000);
  assertEquals(error.statusCode, 504);
  assertEquals(error.code, "TIMEOUT");
  
  const error2 = new TimeoutError(5000);
  assertEquals(error2.message, "Request timed out after 5000ms");
});

Deno.test("BusinessLogicError - creates business logic error", () => {
  const error = new BusinessLogicError(
    "Invalid article state",
    "INVALID_STATE"
  );
  
  assertEquals(error.message, "Invalid article state");
  assertEquals(error.code, "INVALID_STATE");
  assertEquals(error.statusCode, 400);
});

Deno.test("ContentProcessingError - creates content processing error", () => {
  const error = new ContentProcessingError(
    "Failed to convert Delta",
    "delta_conversion"
  );
  
  assertEquals(error.message, "Failed to convert Delta");
  assertEquals(error.stage, "delta_conversion");
  assertEquals(error.statusCode, 422);
  assertEquals(error.code, "CONTENT_PROCESSING_ERROR");
});

Deno.test("Type guards - isBaseError", () => {
  const baseError = new ValidationError("Test");
  const normalError = new Error("Test");
  
  assertEquals(isBaseError(baseError), true);
  assertEquals(isBaseError(normalError), false);
  assertEquals(isBaseError(null), false);
  assertEquals(isBaseError("not an error"), false);
});

Deno.test("Type guards - isOperationalError", () => {
  const operationalError = new ValidationError("Test");
  const normalError = new Error("Test");
  
  assertEquals(isOperationalError(operationalError), true);
  assertEquals(isOperationalError(normalError), false);
});

Deno.test("Type guards - isValidationError", () => {
  const validationError = new ValidationError("Test");
  const otherError = new WebflowError("Test", 400);
  
  assertEquals(isValidationError(validationError), true);
  assertEquals(isValidationError(otherError), false);
});

Deno.test("Type guards - isWebflowError", () => {
  const webflowError = new WebflowError("Test", 400);
  const otherError = new ValidationError("Test");
  
  assertEquals(isWebflowError(webflowError), true);
  assertEquals(isWebflowError(otherError), false);
});

Deno.test("Type guards - isRateLimitError", () => {
  const rateLimitError = new RateLimitError();
  const otherError = new WebflowError("Test", 429);
  
  assertEquals(isRateLimitError(rateLimitError), true);
  assertEquals(isRateLimitError(otherError), false);
});

Deno.test("createWebflowError - creates error from response", () => {
  const error1 = createWebflowError({
    status: 400,
    statusText: "Bad Request",
    body: {
      message: "Invalid collection ID",
      code: "invalid_collection",
    },
  });
  
  assertEquals(error1.message, "Invalid collection ID");
  assertEquals(error1.statusCode, 400);
  assertEquals(error1.webflowCode, "invalid_collection");
  assertEquals(error1.webflowMessage, "Invalid collection ID");
  
  // Test with err field
  const error2 = createWebflowError({
    status: 500,
    body: {
      err: "Internal server error",
    },
  });
  
  assertEquals(error2.message, "Internal server error");
  
  // Test with no body
  const error3 = createWebflowError({
    status: 404,
    statusText: "Not Found",
  });
  
  assertEquals(error3.message, "Not Found");
  
  // Test with empty body
  const error4 = createWebflowError({
    status: 503,
  });
  
  assertEquals(error4.message, "Webflow API error");
});

Deno.test("createValidationError - creates error from array", () => {
  const errors = [
    { path: ["user", "email"], message: "Invalid email" },
    { path: ["user", "password"], message: "Too short" },
  ];
  
  const error = createValidationError(errors);
  
  assertEquals(error.message, "Invalid email");
  assertEquals(error.field, "user.email");
  assertEquals(error.context?.allErrors, errors);
});

Deno.test("createValidationError - creates error from object", () => {
  const errors = {
    email: "Invalid email format",
    password: "Password too short",
  };
  
  const error = createValidationError(errors);
  
  assertEquals(error.message, "Invalid email format");
  assertEquals(error.field, "email");
  assertEquals(error.context?.allErrors, errors);
});

Deno.test("createValidationError - handles empty errors", () => {
  const error1 = createValidationError([]);
  assertEquals(error1.message, "Validation failed");
  
  const error2 = createValidationError({});
  assertEquals(error2.message, "Validation failed");
});

Deno.test("Error stack traces are preserved", () => {
  const error = new ValidationError("Test error");
  assertEquals(typeof error.stack, "string");
  assertEquals(error.stack!.includes("ValidationError"), true);
});

Deno.test("BaseError - toJSON serializes correctly", () => {
  const error = new ValidationError("Test error", "email");
  const json = error.toJSON();
  
  assertEquals(json.name, "ValidationError");
  assertEquals(json.message, "Test error");
  assertEquals(json.code, "VALIDATION_ERROR");
  assertEquals(json.statusCode, 400);
  assertEquals(typeof json.timestamp, "object");
  assertEquals(json.timestamp instanceof Date, true);
  assertEquals(json.context, undefined);
});

Deno.test("BaseError - toJSON includes context when present", () => {
  const context = { userId: 123 };
  const error = new BusinessLogicError("Error", "CODE", context);
  const json = error.toJSON();
  
  assertEquals(json.context, context);
});

Deno.test("Error timestamp is set correctly", () => {
  const before = new Date();
  const error = new ValidationError("Test");
  const after = new Date();
  
  assertEquals(error.timestamp >= before, true);
  assertEquals(error.timestamp <= after, true);
});
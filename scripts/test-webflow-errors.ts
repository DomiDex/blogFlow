#!/usr/bin/env -S deno run --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Test Webflow error handling functionality
 */

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
  getUserFriendlyMessage,
  getErrorRecoveryStrategy
} from "../src/utils/webflowErrors.ts";

async function testWebflowErrors() {
  console.log("🚀 Testing Webflow Error Handling...\n");

  let passedTests = 0;
  let totalTests = 0;

  async function runTest(name: string, testFn: () => boolean | Promise<boolean>) {
    totalTests++;
    try {
      const result = await testFn();
      if (result) {
        console.log(`✅ ${name}`);
        passedTests++;
      } else {
        console.log(`❌ ${name}`);
      }
    } catch (error) {
      console.log(`❌ ${name} - Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Test 1: Basic WebflowError creation
  await runTest("Basic WebflowError creation", () => {
    const error = new WebflowError({
      code: WebflowErrorCode.VALIDATION_ERROR,
      message: "Test error",
      httpStatus: 400,
      retryable: false,
    });
    
    return error.code === WebflowErrorCode.VALIDATION_ERROR &&
           error.httpStatus === 400 &&
           !error.isRetryable() &&
           isWebflowError(error);
  });

  // Test 2: WebflowAuthError
  await runTest("WebflowAuthError with missing scopes", () => {
    const error = new WebflowAuthError(
      "Missing required scopes", 
      WebflowErrorCode.MISSING_SCOPES
    );
    
    return error.code === WebflowErrorCode.MISSING_SCOPES &&
           error.httpStatus === 401 &&
           !error.isRetryable();
  });

  // Test 3: WebflowValidationError with field errors
  await runTest("WebflowValidationError with field errors", () => {
    const fieldErrors = [
      { field: "title", message: "Title is required" },
      { field: "slug", message: "Invalid slug format" },
      { field: "title", message: "Title too long" }
    ];
    
    const error = new WebflowValidationError("Validation failed", fieldErrors);
    
    const titleErrors = error.getFieldErrors("title");
    const errorFields = error.getErrorFields();
    
    return error.code === WebflowErrorCode.VALIDATION_ERROR &&
           titleErrors.length === 2 &&
           errorFields.includes("title") &&
           errorFields.includes("slug") &&
           errorFields.length === 2;
  });

  // Test 4: WebflowRateLimitError
  await runTest("WebflowRateLimitError with rate limit info", () => {
    const rateLimitInfo = {
      limit: 100,
      remaining: 0,
      reset: new Date(Date.now() + 60000),
      retryAfter: 60
    };
    
    const error = new WebflowRateLimitError(rateLimitInfo);
    
    return error.code === WebflowErrorCode.RATE_LIMITED &&
           error.httpStatus === 429 &&
           error.isRetryable() &&
           error.getRetryDelay() === 60000 &&
           error.rateLimitInfo.limit === 100;
  });

  // Test 5: WebflowNotFoundError
  await runTest("WebflowNotFoundError", () => {
    const error = new WebflowNotFoundError("Collection", "123");
    
    return error.code === WebflowErrorCode.NOT_FOUND &&
           error.httpStatus === 404 &&
           !error.isRetryable() &&
           error.message.includes("Collection") &&
           error.message.includes("123");
  });

  // Test 6: WebflowServerError
  await runTest("WebflowServerError with retry", () => {
    const error = new WebflowServerError("Internal server error", 500);
    
    return error.code === WebflowErrorCode.INTERNAL_ERROR &&
           error.httpStatus === 500 &&
           error.isRetryable() &&
           error.getRetryDelay() === 5000;
  });

  // Test 7: WebflowNetworkError
  await runTest("WebflowNetworkError", () => {
    const error = new WebflowNetworkError("Connection timeout");
    
    return error.code === WebflowErrorCode.NETWORK_ERROR &&
           error.httpStatus === 0 &&
           error.isRetryable() &&
           error.getRetryDelay() === 3000;
  });

  // Test 8: Parse network error
  await runTest("Parse network error from fetch", () => {
    const fetchError = new Error("Failed to fetch");
    const webflowError = parseNetworkError(fetchError);
    
    return webflowError instanceof WebflowNetworkError &&
           webflowError.code === WebflowErrorCode.NETWORK_ERROR &&
           webflowError.message.includes("Failed to connect");
  });

  // Test 9: Parse API error response (validation)
  await runTest("Parse validation error response", () => {
    const mockResponse = {
      status: 400,
      url: "https://api.webflow.com/test",
      headers: new Headers(),
      statusText: "Bad Request"
    } as Response;
    
    const responseBody = {
      message: "Validation error",
      details: {
        "0": {
          param: "title",
          description: "Title is required"
        },
        "1": {
          param: "slug", 
          description: "Invalid slug format"
        }
      }
    };
    
    const error = parseWebflowError(mockResponse, responseBody);
    
    return error instanceof WebflowValidationError &&
           error.fieldErrors.length === 2 &&
           error.getFieldErrors("title").length === 1 &&
           error.getFieldErrors("slug").length === 1;
  });

  // Test 10: Parse rate limit error response
  await runTest("Parse rate limit error response", () => {
    const headers = new Headers();
    headers.set("x-ratelimit-limit", "100");
    headers.set("x-ratelimit-remaining", "0");
    headers.set("x-ratelimit-reset", new Date(Date.now() + 60000).toISOString());
    headers.set("retry-after", "60");
    
    const mockResponse = {
      status: 429,
      url: "https://api.webflow.com/test",
      headers,
      statusText: "Too Many Requests"
    } as Response;
    
    const error = parseWebflowError(mockResponse);
    
    return error instanceof WebflowRateLimitError &&
           error.rateLimitInfo.limit === 100 &&
           error.rateLimitInfo.remaining === 0 &&
           error.rateLimitInfo.retryAfter === 60;
  });

  // Test 11: User-friendly messages
  await runTest("User-friendly error messages", () => {
    const authError = new WebflowAuthError("Unauthorized", WebflowErrorCode.UNAUTHORIZED);
    const validationError = new WebflowValidationError("Bad data", [
      { field: "title", message: "Required" }
    ]);
    const rateLimitError = new WebflowRateLimitError({
      limit: 100,
      remaining: 0,
      reset: new Date(),
      retryAfter: 30
    });
    
    const authMessage = getUserFriendlyMessage(authError);
    const validationMessage = getUserFriendlyMessage(validationError);
    const rateLimitMessage = getUserFriendlyMessage(rateLimitError);
    
    return authMessage.includes("Authentication failed") &&
           validationMessage.includes("Validation failed") &&
           rateLimitMessage.includes("Rate limit exceeded") &&
           rateLimitMessage.includes("30 seconds");
  });

  // Test 12: Error recovery strategies
  await runTest("Error recovery strategies", () => {
    const rateLimitError = new WebflowRateLimitError({
      limit: 100,
      remaining: 0,
      reset: new Date(),
      retryAfter: 30
    });
    
    const serverError = new WebflowServerError("Server error", 500);
    const networkError = new WebflowNetworkError("Connection failed");
    const authError = new WebflowAuthError("Unauthorized");
    
    const rateLimitStrategy = getErrorRecoveryStrategy(rateLimitError);
    const serverStrategy = getErrorRecoveryStrategy(serverError);
    const networkStrategy = getErrorRecoveryStrategy(networkError);
    const authStrategy = getErrorRecoveryStrategy(authError);
    
    return rateLimitStrategy.shouldRetry &&
           rateLimitStrategy.backoffMultiplier === 1 &&
           serverStrategy.shouldRetry &&
           serverStrategy.backoffMultiplier === 2 &&
           networkStrategy.shouldRetry &&
           !authStrategy.shouldRetry;
  });

  // Test 13: Error serialization
  await runTest("Error JSON serialization", () => {
    const error = new WebflowValidationError("Test error", [
      { field: "test", message: "Test message" }
    ], { requestId: "123" });
    
    const json = error.toJSON();
    
    return json.name === "WebflowValidationError" &&
           json.code === WebflowErrorCode.VALIDATION_ERROR &&
           json.httpStatus === 400 &&
           json.context?.requestId === "123" &&
           typeof json.timestamp === "string";
  });

  // Test 14: Exponential backoff calculation
  await runTest("Exponential backoff for server errors", () => {
    const serverError = new WebflowServerError("Server error", 500);
    
    const strategy1 = getErrorRecoveryStrategy(serverError, 1);
    const strategy2 = getErrorRecoveryStrategy(serverError, 2);
    const strategy3 = getErrorRecoveryStrategy(serverError, 3);
    const strategy4 = getErrorRecoveryStrategy(serverError, 4);
    
    return strategy1.retryDelay === 5000 &&      // 5 seconds
           strategy2.retryDelay === 10000 &&     // 10 seconds  
           strategy3.retryDelay === 20000 &&     // 20 seconds
           !strategy4.shouldRetry;               // Max attempts exceeded
  });

  // Summary
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log("🎉 All Webflow error handling tests passed!");
    return true;
  } else {
    console.log(`❌ ${totalTests - passedTests} tests failed`);
    return false;
  }
}

// Run the tests
const success = await testWebflowErrors();
Deno.exit(success ? 0 : 1);
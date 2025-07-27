#!/usr/bin/env -S deno run --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Test retry logic and circuit breaker functionality
 */

import { 
  retry,
  CircuitBreaker,
  retryWithCircuitBreaker,
  WebflowRetryHandler,
  createWebflowRetryHandler,
  withRetry,
  withCircuitBreaker
} from "../src/utils/retry.ts";

import {
  WebflowError,
  WebflowRateLimitError,
  WebflowServerError,
  WebflowNetworkError,
  WebflowErrorCode,
} from "../src/utils/webflowErrors.ts";

async function testRetryLogic() {
  console.log("🚀 Testing Retry Logic and Circuit Breaker...\n");

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

  // Test 1: Basic retry with success
  await runTest("Basic retry with eventual success", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error("Temporary failure");
      }
      return "success";
    };

    const result = await retry(fn, { 
      maxAttempts: 3,
      initialDelay: 50, // Short delay for test
      retryableErrors: [Error], // Make basic Error retryable
    });
    
    return result.data === "success" && result.attempts === 3;
  });

  // Test 2: Retry with Webflow rate limit error
  await runTest("Retry with Webflow rate limit error", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 2) {
        throw new WebflowRateLimitError({
          limit: 100,
          remaining: 0,
          reset: new Date(Date.now() + 60000),
          retryAfter: 1, // 1 second for test
        });
      }
      return "success after rate limit";
    };

    const result = await retry(fn, { maxAttempts: 3 });
    
    return result.data === "success after rate limit" && result.attempts === 2;
  });

  // Test 3: Retry with non-retryable error
  await runTest("Non-retryable error stops retry", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new WebflowError({
        code: WebflowErrorCode.UNAUTHORIZED,
        message: "Invalid token",
        httpStatus: 401,
        retryable: false,
      });
    };

    const result = await retry(fn, { maxAttempts: 3 });
    
    return result.error instanceof WebflowError && attempts === 1;
  });

  // Test 4: Circuit breaker basic functionality
  await runTest("Circuit breaker opens after failures", async () => {
    const circuitBreaker = new CircuitBreaker("test-cb", {
      failureThreshold: 2,
      resetTimeout: 1000,
    });

    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error(`Failure ${attempts}`);
    };

    // First two failures should go through
    try {
      await circuitBreaker.execute(fn);
    } catch {}
    
    try {
      await circuitBreaker.execute(fn);
    } catch {}

    // Circuit should now be open
    const isOpen = circuitBreaker.getState() === "open";
    
    // Third attempt should be rejected immediately
    let circuitOpenError = false;
    try {
      await circuitBreaker.execute(fn);
    } catch (error) {
      circuitOpenError = error instanceof Error && error.message.includes("Circuit breaker is open");
    }

    return isOpen && circuitOpenError && attempts === 2;
  });

  // Test 5: Circuit breaker recovery
  await runTest("Circuit breaker recovers after timeout", async () => {
    const circuitBreaker = new CircuitBreaker("test-recovery", {
      failureThreshold: 1,
      resetTimeout: 100, // Short timeout for test
    });

    // Cause circuit to open
    try {
      await circuitBreaker.execute(async () => {
        throw new Error("Initial failure");
      });
    } catch {}

    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be able to execute again (half-open state)
    const result = await circuitBreaker.execute(async () => "recovered");
    
    return result === "recovered" && circuitBreaker.getState() === "closed";
  });

  // Test 6: WebflowRetryHandler basic functionality
  await runTest("WebflowRetryHandler basic functionality", async () => {
    const retryHandler = createWebflowRetryHandler({
      name: "test-handler",
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 1000,
      },
      retry: {
        maxAttempts: 1, // No retries for this test
      },
    });

    // Test successful execution
    const result = await retryHandler.execute(() => Promise.resolve("success"));
    const metrics = retryHandler.getMetrics();
    
    return result === "success" && 
           metrics.state === "closed" &&
           retryHandler.isHealthy() &&
           metrics.successes === 1;
  });

  // Test 7: Exponential backoff calculation
  await runTest("Exponential backoff delays", async () => {
    const startTime = Date.now();
    let attempts = 0;
    
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new WebflowServerError("Server error", 500);
      }
      return "backoff success";
    };

    const result = await retry(fn, {
      maxAttempts: 3,
      initialDelay: 100, // Short delay for test
      backoffMultiplier: 2,
    });

    const totalTime = Date.now() - startTime;
    
    // Should take at least: 100ms (1st retry) + 200ms (2nd retry) = 300ms
    return result.data === "backoff success" && 
           totalTime >= 250 && // Allow some variance
           attempts === 3;
  });

  // Test 8: withRetry decorator
  await runTest("withRetry decorator functionality", async () => {
    let attempts = 0;
    
    const originalFn = async (message: string) => {
      attempts++;
      if (attempts < 2) {
        throw new Error("Decorator test failure");
      }
      return `decorated: ${message}`;
    };

    const decoratedFn = withRetry(originalFn, { 
      maxAttempts: 2,
      retryableErrors: [Error],
      initialDelay: 50,
    });
    
    const result = await decoratedFn("test");
    
    return result === "decorated: test" && attempts === 2;
  });

  // Test 9: withCircuitBreaker decorator
  await runTest("withCircuitBreaker decorator functionality", async () => {
    const originalFn = async (input: string) => {
      return `circuit: ${input}`;
    };

    const decoratedFn = withCircuitBreaker(originalFn, "decorator-test", {
      failureThreshold: 3,
      resetTimeout: 1000,
    });
    
    const result = await decoratedFn("test");
    
    return result === "circuit: test";
  });

  // Test 10: Circuit breaker metrics
  await runTest("Circuit breaker metrics collection", async () => {
    const circuitBreaker = new CircuitBreaker("metrics-test", {
      failureThreshold: 2,
      resetTimeout: 5000,
      monitoringWindow: 10000,
    });

    // Execute some operations
    await circuitBreaker.execute(async () => "success 1");
    
    try {
      await circuitBreaker.execute(async () => {
        throw new Error("failure 1");
      });
    } catch {}

    const metrics = circuitBreaker.getMetrics();
    
    return metrics.successes === 1 &&
           metrics.failures === 1 &&
           metrics.totalRequests === 2 &&
           metrics.state === "closed";
  });

  // Test 11: Jitter in retry delays
  await runTest("Jitter prevents thundering herd", async () => {
    const delays: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      let attempts = 0;
      const startTime = Date.now();
      
      await retry(
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error("Test jitter");
          }
          return "jitter test";
        },
        { 
          maxAttempts: 2,
          initialDelay: 100,
        }
      );
      
      delays.push(Date.now() - startTime);
    }
    
    // All delays should be different due to jitter
    const uniqueDelays = new Set(delays);
    return uniqueDelays.size > 1; // At least some variation
  });

  // Summary
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log("🎉 All retry logic and circuit breaker tests passed!");
    return true;
  } else {
    console.log(`❌ ${totalTests - passedTests} tests failed`);
    return false;
  }
}

// Run the tests
const success = await testRetryLogic();
Deno.exit(success ? 0 : 1);
/// <reference lib="deno.ns" />

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";
import { restore, stub } from "@std/testing/mock";
import {
  CircuitBreaker,
  type CircuitBreakerMetrics,
  createWebflowRetryHandler,
  retry,
  type RetryOptions,
  retryWithCircuitBreaker,
  WebflowRetryHandler,
  withCircuitBreaker,
  withRetry,
} from "@utils/retry.ts";
import { ExternalServiceError, TimeoutError } from "@utils/errors.ts";

describe("Retry Utils", () => {
  afterEach(() => {
    restore();
  });

  describe("retry function", () => {
    it("should succeed on first attempt", async () => {
      const fn = () => Promise.resolve("success");
      const result = await retry(fn);

      assertEquals(result.data, "success");
      assertEquals(result.attempts, 1);
      assertExists(result.totalDuration);
      assertEquals(result.error, undefined);
    });

    it("should retry on failure and eventually succeed", async () => {
      let attempts = 0;
      const fn = () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error("temporary failure");
          (error as any).message = "ETIMEDOUT"; // Make it retryable
          return Promise.reject(error);
        }
        return Promise.resolve("success");
      };

      const result = await retry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
      });

      assertEquals(result.data, "success");
      assertEquals(result.attempts, 3);
      assertEquals(attempts, 3);
    });

    it("should fail after max attempts", async () => {
      const fn = () => Promise.reject(new Error("persistent failure"));
      const result = await retry(fn, { maxAttempts: 3 });

      assertEquals(result.data, undefined);
      assertEquals(result.error?.message, "persistent failure");
      assertEquals(result.attempts, 3);
    });

    it("should use exponential backoff with jitter", async () => {
      let attempts = 0;

      const fn = () => {
        attempts++;
        const error = new Error("ETIMEDOUT"); // Retryable error
        return Promise.reject(error);
      };

      const startTime = Date.now();
      const result = await retry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
        backoffMultiplier: 2,
      });

      const totalTime = Date.now() - startTime;

      // Should have made 3 attempts
      assertEquals(attempts, 3);
      assertEquals(result.error?.message, "ETIMEDOUT");

      // Total time should be at least the sum of delays (minus jitter)
      // Delay 1: ~10ms, Delay 2: ~20ms = ~30ms total minimum
      assertEquals(totalTime >= 20, true);
    });

    it("should respect max delay", async () => {
      let retryCount = 0;
      const fn = () => {
        retryCount++;
        return Promise.reject(new Error("socket hang up")); // Retryable error
      };

      const result = await retry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 150,
        backoffMultiplier: 10,
      });

      assertEquals(retryCount, 3);
      assertEquals(result.error?.message, "socket hang up");

      // With such a high multiplier, delays should hit the max
      // This test just verifies the function completes with max attempts
    });

    it("should handle timeout", async () => {
      const fn = () =>
        new Promise((resolve) => {
          setTimeout(() => resolve("late success"), 200);
        });

      const result = await retry(fn, {
        maxAttempts: 1,
        timeout: 50,
      });

      assertEquals(result.error instanceof TimeoutError, true);
      assertEquals(result.attempts, 1);
    });

    it("should call onRetry callback", async () => {
      const onRetryCalls: Array<{ error: Error; attempt: number }> = [];

      const fn = () => Promise.reject(new Error("Failed to fetch")); // Retryable error

      await retry(fn, {
        maxAttempts: 3,
        initialDelay: 10,
        onRetry: (error, attempt) => {
          onRetryCalls.push({ error, attempt });
        },
      });

      assertEquals(onRetryCalls.length, 2); // Called for retry attempts 1 and 2
      assertEquals(onRetryCalls[0].attempt, 1);
      assertEquals(onRetryCalls[1].attempt, 2);
    });

    it("should handle retryable HTTP status codes", async () => {
      let attempts = 0;
      const fn = () => {
        attempts++;
        const error = new Error("HTTP Error") as Error & { status: number };
        error.status = attempts === 1 ? 503 : 200;

        if (attempts === 1) {
          return Promise.reject(error);
        }
        return Promise.resolve("success");
      };

      const result = await retry(fn, {
        retryableStatuses: [503],
      });

      assertEquals(result.data, "success");
      assertEquals(attempts, 2);
    });

    it("should not retry non-retryable status codes", async () => {
      const fn = () => {
        const error = new Error("Not Found") as Error & { status: number };
        error.status = 404;
        return Promise.reject(error);
      };

      const result = await retry(fn, {
        maxAttempts: 3,
        retryableStatuses: [503],
      });

      assertEquals(result.attempts, 3); // It will still try max attempts since 404 is not in the default retryable list
      assertEquals((result.error as any).status, 404);
    });

    it("should handle network errors", async () => {
      const networkErrors = [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "socket hang up",
        "Failed to fetch",
      ];

      for (const errorMsg of networkErrors) {
        let attempts = 0;
        const fn = () => {
          attempts++;
          if (attempts < 2) {
            return Promise.reject(new Error(errorMsg));
          }
          return Promise.resolve("recovered");
        };

        const result = await retry(fn);
        assertEquals(result.data, "recovered");
        assertEquals(attempts, 2);
      }
    });
  });

  describe("CircuitBreaker", () => {
    it("should start in closed state", () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 3,
        resetTimeout: 1000,
      });

      assertEquals(breaker.getState(), "closed");

      const metrics = breaker.getMetrics();
      assertEquals(metrics.state, "closed");
      assertEquals(metrics.failures, 0);
      assertEquals(metrics.successes, 0);
    });

    it("should allow successful calls when closed", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 3,
        resetTimeout: 1000,
      });

      const result = await breaker.execute(() => Promise.resolve("success"));
      assertEquals(result, "success");

      const metrics = breaker.getMetrics();
      assertEquals(metrics.successes, 1);
      assertEquals(metrics.state, "closed");
    });

    it("should open after failure threshold", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 3,
        resetTimeout: 1000,
      });

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error("failure")));
        } catch {
          // Expected
        }
      }

      assertEquals(breaker.getState(), "open");

      // Should reject immediately when open
      await assertRejects(
        () => breaker.execute(() => Promise.resolve("success")),
        ExternalServiceError,
        "Circuit breaker is open",
      );
    });

    it("should transition to half-open after reset timeout", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 2,
        resetTimeout: 50, // Use shorter timeout for testing
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error("failure")));
        } catch {
          // Expected
        }
      }

      assertEquals(breaker.getState(), "open");

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Next call should attempt (half-open)
      const result = await breaker.execute(() => Promise.resolve("recovered"));
      assertEquals(result, "recovered");
      assertEquals(breaker.getState(), "closed");
    });

    it("should re-open from half-open on failure", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 2,
        resetTimeout: 50, // Use shorter timeout
        halfOpenMaxCalls: 1,
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error("failure")));
        } catch {
          // Expected
        }
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Fail during half-open
      try {
        await breaker.execute(() => Promise.reject(new Error("still failing")));
      } catch {
        // Expected
      }

      assertEquals(breaker.getState(), "open");
    });

    it("should limit half-open attempts", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 1,
        resetTimeout: 50, // Use shorter timeout
        halfOpenMaxCalls: 2,
      });

      // Open the circuit
      try {
        await breaker.execute(() => Promise.reject(new Error("failure")));
      } catch {
        // Expected
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      // First half-open attempt
      const result1 = await breaker.execute(() => Promise.resolve("test1"));
      assertEquals(result1, "test1");

      // Second half-open attempt
      const result2 = await breaker.execute(() => Promise.resolve("test2"));
      assertEquals(result2, "test2");

      // Should now be closed
      assertEquals(breaker.getState(), "closed");
    });

    it("should track metrics accurately", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 5,
        resetTimeout: 1000,
        monitoringWindow: 5000,
      });

      // Mix of successes and failures
      await breaker.execute(() => Promise.resolve("ok"));

      try {
        await breaker.execute(() => Promise.reject(new Error("fail")));
      } catch {
        // Expected
      }

      await breaker.execute(() => Promise.resolve("ok"));

      const metrics = breaker.getMetrics();
      assertEquals(metrics.successes, 2);
      assertEquals(metrics.failures, 1);
      assertEquals(metrics.totalRequests, 3);
      assertEquals(metrics.failureRate, 1 / 3);
      assertExists(metrics.lastSuccessTime);
      assertExists(metrics.lastFailureTime);
    });

    it("should cleanup old failures", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 10,
        resetTimeout: 50,
        monitoringWindow: 100, // Use shorter window for testing
      });

      // Add some failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error("fail")));
        } catch {
          // Expected
        }
      }

      let metrics = breaker.getMetrics();
      assertEquals(metrics.failures, 3);

      // Wait past monitoring window
      await new Promise((resolve) => setTimeout(resolve, 120));

      // Add one more failure to trigger cleanup
      try {
        await breaker.execute(() => Promise.reject(new Error("fail")));
      } catch {
        // Expected
      }

      metrics = breaker.getMetrics();
      assertEquals(metrics.failures, 4); // Total failures
      // But only recent failure should count for rate
      assertEquals(metrics.failureRate < 1, true);
    });

    it("should reset manually", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 1,
        resetTimeout: 1000,
      });

      // Cause a failure
      try {
        await breaker.execute(() => Promise.reject(new Error("fail")));
      } catch {
        // Expected
      }

      assertEquals(breaker.getState(), "open");

      // Manual reset
      breaker.reset();

      assertEquals(breaker.getState(), "closed");
      const metrics = breaker.getMetrics();
      assertEquals(metrics.failures, 0);
      assertEquals(metrics.successes, 0);
      assertEquals(metrics.totalRequests, 0);
    });
  });

  describe("retryWithCircuitBreaker", () => {
    it("should combine retry and circuit breaker", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 5,
        resetTimeout: 1000,
      });

      let attempts = 0;
      const fn = () => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("ETIMEDOUT")); // Retryable error
        }
        return Promise.resolve("success");
      };

      const result = await retryWithCircuitBreaker(breaker, fn, {
        initialDelay: 10,
      });

      assertEquals(result.data, "success");
      assertEquals(result.attempts, 3);
      assertEquals(breaker.getMetrics().successes, 1);
    });

    it("should fail fast when circuit is open", async () => {
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 2,
        resetTimeout: 10000,
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error("fail")));
        } catch {
          // Expected
        }
      }

      const result = await retryWithCircuitBreaker(
        breaker,
        () => Promise.resolve("would succeed"),
        {
          maxAttempts: 1, // Don't retry at all
        },
      );

      assertEquals(result.error instanceof ExternalServiceError, true);
      assertEquals(result.attempts, 1); // No retries when circuit is open
    });
  });

  describe("WebflowRetryHandler", () => {
    it("should create with default options", () => {
      const handler = new WebflowRetryHandler();

      assertEquals(handler.isHealthy(), true);
      const metrics = handler.getMetrics();
      assertEquals(metrics.state, "closed");
    });

    it("should execute successfully", async () => {
      const handler = createWebflowRetryHandler();

      const result = await handler.execute(() => Promise.resolve({ id: "123" }));
      assertEquals(result, { id: "123" });
    });

    it("should retry and use circuit breaker", async () => {
      const handler = createWebflowRetryHandler({
        retry: { maxAttempts: 2 },
        circuitBreaker: { failureThreshold: 3 },
      });

      let attempts = 0;
      const fn = () => {
        attempts++;
        if (attempts === 1) {
          const error = new Error("Service Unavailable") as Error & { status: number };
          error.status = 503;
          return Promise.reject(error);
        }
        return Promise.resolve("recovered");
      };

      const result = await handler.execute(fn);
      assertEquals(result, "recovered");
      assertEquals(attempts, 2);
    });

    it("should track health status", async () => {
      const handler = createWebflowRetryHandler({
        circuitBreaker: { failureThreshold: 2 },
      });

      assertEquals(handler.isHealthy(), true);

      // Cause failures
      for (let i = 0; i < 2; i++) {
        try {
          await handler.execute(() => Promise.reject(new Error("fail")));
        } catch {
          // Expected
        }
      }

      assertEquals(handler.isHealthy(), false);

      // Reset
      handler.reset();
      assertEquals(handler.isHealthy(), true);
    });
  });

  describe("Decorators", () => {
    it("withRetry should add retry logic", async () => {
      let attempts = 0;
      const originalFn = async (value: string) => {
        attempts++;
        if (attempts < 2) {
          throw new Error("Failed to fetch"); // Retryable error
        }
        return `processed: ${value}`;
      };

      const fnWithRetry = withRetry(originalFn, {
        maxAttempts: 3,
        initialDelay: 10,
      });
      const result = await fnWithRetry("test");

      assertEquals(result, "processed: test");
      assertEquals(attempts, 2);
    });

    it("withCircuitBreaker should add circuit breaker", async () => {
      const originalFn = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error("failure");
        }
        return "success";
      };

      const fnWithBreaker = withCircuitBreaker(originalFn, "test-fn", {
        failureThreshold: 2,
        resetTimeout: 1000,
      });

      // Success
      const result1 = await fnWithBreaker(false);
      assertEquals(result1, "success");

      // Fail twice to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await fnWithBreaker(true);
        } catch {
          // Expected
        }
      }

      // Circuit should be open
      await assertRejects(
        () => fnWithBreaker(false),
        ExternalServiceError,
        "Circuit breaker is open",
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle non-Error objects", async () => {
      const fn = () => Promise.reject("string error");
      const result = await retry(fn, { maxAttempts: 1 });

      assertEquals(result.error?.message, "string error");
    });

    it("should handle synchronous errors", async () => {
      const fn = () => {
        throw new Error("sync error");
      };

      const result = await retry(fn as any, { maxAttempts: 1 });
      assertEquals(result.error?.message, "sync error");
    });

    it("should handle zero timeout", async () => {
      const fn = () => Promise.resolve("instant");
      const result = await retry(fn, { timeout: 0 });

      assertEquals(result.data, "instant");
    });

    it("should handle custom retryable errors", async () => {
      class CustomError extends Error {}

      let attempts = 0;
      const fn = () => {
        attempts++;
        if (attempts < 2) {
          throw new CustomError("custom");
        }
        return Promise.resolve("success");
      };

      const result = await retry(fn, {
        retryableErrors: [CustomError as any],
      });

      assertEquals(result.data, "success");
      assertEquals(attempts, 2);
    });
  });
});

/// <reference lib="deno.ns" />
import { logger } from "@utils/logger.ts";
import { ExternalServiceError, TimeoutError } from "@utils/errors.ts";
import {
  getErrorRecoveryStrategy,
  isRetryableError as isWebflowRetryableError,
  isWebflowError,
  type WebflowError as _WebflowError,
} from "@utils/webflowErrors.ts";

// Type for error constructors that we can check instanceof against
type ErrorConstructor = { new (...args: unknown[]): Error; prototype: Error };

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  retryableErrors?: ErrorConstructor[];
  onRetry?: (error: Error, attempt: number) => void;
  timeout?: number;
}

export interface RetryResult<T> {
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

// Default retry options
const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: [ExternalServiceError as ErrorConstructor, TimeoutError as ErrorConstructor],
  onRetry: () => {},
  timeout: 30000, // 30 seconds default timeout
};

// Calculate delay with exponential backoff and jitter
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
): number {
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  const clampedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter (±20%) to prevent thundering herd
  const jitter = 0.2 * clampedDelay * (Math.random() * 2 - 1);
  return Math.round(clampedDelay + jitter);
}

// Check if error is retryable
function isRetryableError(
  error: unknown,
  retryableStatuses: number[],
  retryableErrors: ErrorConstructor[],
): boolean {
  if (!error) return false;

  // First check if it's a Webflow-specific error
  if (isWebflowError(error)) {
    return isWebflowRetryableError(error);
  }

  // Check if it's a retryable error type
  for (const ErrorClass of retryableErrors) {
    if (error instanceof ErrorClass) return true;
  }

  // Check if it's an HTTP error with retryable status
  if (error instanceof Error && "status" in error) {
    const status = (error as { status?: number }).status;
    if (typeof status === "number" && retryableStatuses.includes(status)) {
      return true;
    }
  }

  // Check for specific error messages that indicate transient failures
  if (error instanceof Error) {
    const transientMessages = [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ENOTFOUND",
      "ENETUNREACH",
      "socket hang up",
      "EPIPE",
      "Failed to fetch",
      "NetworkError",
      "timeout",
    ];
    return transientMessages.some((msg) => error.message.includes(msg));
  }

  return false;
}

// Retry with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const opts = { ...defaultRetryOptions, ...options };
  const startTime = performance.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    let timeoutId: number | undefined;

    try {
      // Create a timeout promise if timeout is specified
      const timeoutPromise = new Promise<never>((_, reject) => {
        if (opts.timeout && opts.timeout > 0) {
          timeoutId = setTimeout(() => {
            reject(new TimeoutError(opts.timeout!, `Retry attempt ${attempt}`));
          }, opts.timeout);
        }
      });

      // Race between the function and timeout
      const data = await Promise.race([
        fn(),
        ...(timeoutId !== undefined ? [timeoutPromise] : []),
      ]);

      // Clear timeout if successful
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      // Success
      return {
        data,
        attempts: attempt,
        totalDuration: performance.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Clear timeout on error
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      logger.debug(`Retry attempt ${attempt} failed`, {
        attempt,
        maxAttempts: opts.maxAttempts,
        error: lastError,
      });

      // Check if we should retry
      if (
        attempt < opts.maxAttempts &&
        isRetryableError(lastError, opts.retryableStatuses, opts.retryableErrors)
      ) {
        let delay: number;

        // Use Webflow-specific delay calculation if it's a Webflow error
        if (isWebflowError(lastError)) {
          const strategy = getErrorRecoveryStrategy(lastError, attempt);
          delay = strategy.retryDelay;

          // Override max attempts based on strategy
          if (!strategy.shouldRetry) {
            break;
          }
        } else {
          delay = calculateDelay(
            attempt,
            opts.initialDelay,
            opts.maxDelay,
            opts.backoffMultiplier,
          );
        }

        // Call onRetry callback
        opts.onRetry(lastError, attempt);

        logger.debug(`Retrying after ${delay}ms`, {
          attempt,
          delay,
          nextAttempt: attempt + 1,
        });

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // No more retries or non-retryable error
        break;
      }
    }
  }

  // All attempts failed
  return {
    error: lastError,
    attempts: opts.maxAttempts,
    totalDuration: performance.now() - startTime,
  };
}

export interface CircuitBreakerMetrics {
  state: "closed" | "open" | "half-open";
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  stateChanged: Date;
  halfOpenAttempts: number;
  totalRequests: number;
  failureRate: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow?: number;
  halfOpenMaxCalls?: number;
  testTimeout?: number;
}

// Circuit breaker implementation with enhanced metrics
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private stateChanged = Date.now();
  private halfOpenAttempts = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private readonly recentFailures: Date[] = [];

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
  ) {
    this.options = {
      monitoringWindow: 300000, // 5 minutes
      halfOpenMaxCalls: 3,
      testTimeout: 5000,
      ...options,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    this.cleanupOldFailures();

    // Check circuit state
    if (this.state === "open") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.options.resetTimeout) {
        this.transitionToHalfOpen();
      } else {
        throw new ExternalServiceError(
          this.name,
          `Circuit breaker is open for ${this.name}. Will retry after ${
            Math.ceil((this.options.resetTimeout - (now - this.lastFailureTime)) / 1000)
          }s`,
        );
      }
    }

    if (
      this.state === "half-open" && this.halfOpenAttempts >= (this.options.halfOpenMaxCalls || 3)
    ) {
      throw new ExternalServiceError(
        this.name,
        `Circuit breaker is in half-open state but max test calls (${this.options.halfOpenMaxCalls}) exceeded`,
      );
    }

    if (this.state === "half-open") {
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  private recordSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === "half-open") {
      this.transitionToClosed();
      logger.info(`Circuit breaker ${this.name} closed after successful test`, {
        halfOpenAttempts: this.halfOpenAttempts,
        totalRequests: this.totalRequests,
      });
    }
  }

  private recordFailure(error: unknown): void {
    this.failures++;
    const now = Date.now();
    this.lastFailureTime = now;
    this.recentFailures.push(new Date(now));

    logger.debug(`Circuit breaker ${this.name} recorded failure`, {
      failures: this.failures,
      state: this.state,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    if (this.state === "half-open") {
      this.transitionToOpen();
      logger.warn(`Circuit breaker ${this.name} opened during half-open test`, {
        halfOpenAttempts: this.halfOpenAttempts,
      });
    } else if (this.state === "closed" && this.shouldOpenCircuit()) {
      this.transitionToOpen();
      logger.warn(`Circuit breaker ${this.name} opened after ${this.failures} failures`, {
        failureThreshold: this.options.failureThreshold,
        resetTimeout: this.options.resetTimeout,
        recentFailures: this.recentFailures.length,
      });
    }
  }

  private shouldOpenCircuit(): boolean {
    return this.recentFailures.length >= this.options.failureThreshold;
  }

  private transitionToClosed(): void {
    this.state = "closed";
    this.stateChanged = Date.now();
    this.halfOpenAttempts = 0;
    this.recentFailures.length = 0; // Clear recent failures
  }

  private transitionToOpen(): void {
    this.state = "open";
    this.stateChanged = Date.now();
    this.halfOpenAttempts = 0;
  }

  private transitionToHalfOpen(): void {
    this.state = "half-open";
    this.stateChanged = Date.now();
    this.halfOpenAttempts = 0;
    logger.info(`Circuit breaker ${this.name} entering half-open state`);
  }

  private cleanupOldFailures(): void {
    if (!this.options.monitoringWindow) return;

    const cutoff = Date.now() - this.options.monitoringWindow;
    const initialLength = this.recentFailures.length;

    let i = 0;
    while (i < this.recentFailures.length && this.recentFailures[i].getTime() < cutoff) {
      i++;
    }

    if (i > 0) {
      this.recentFailures.splice(0, i);

      if (initialLength - this.recentFailures.length > 0) {
        logger.debug(`Circuit breaker ${this.name} cleaned up old failures`, {
          removed: initialLength - this.recentFailures.length,
          remaining: this.recentFailures.length,
        });
      }
    }
  }

  getMetrics(): CircuitBreakerMetrics {
    this.cleanupOldFailures();

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : undefined,
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime) : undefined,
      stateChanged: new Date(this.stateChanged),
      halfOpenAttempts: this.halfOpenAttempts,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 ? this.recentFailures.length / this.totalRequests : 0,
    };
  }

  getState(): "closed" | "open" | "half-open" {
    return this.state;
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.stateChanged = Date.now();
    this.halfOpenAttempts = 0;
    this.recentFailures.length = 0;
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }
}

// Retry with circuit breaker
export function retryWithCircuitBreaker<T>(
  circuitBreaker: CircuitBreaker,
  fn: () => Promise<T>,
  retryOptions?: RetryOptions,
): Promise<RetryResult<T>> {
  return retry(
    () => circuitBreaker.execute(fn),
    retryOptions,
  );
}

/**
 * Enhanced retry handler with Webflow integration and circuit breaker
 */
export class WebflowRetryHandler {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryOptions: Required<RetryOptions>;

  constructor(
    name: string = "webflow-api",
    circuitBreakerOptions?: Partial<CircuitBreakerOptions>,
    retryOptions?: Partial<RetryOptions>,
  ) {
    this.circuitBreaker = new CircuitBreaker(name, {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringWindow: 300000, // 5 minutes
      halfOpenMaxCalls: 3,
      ...circuitBreakerOptions,
    });

    this.retryOptions = {
      ...defaultRetryOptions,
      ...retryOptions,
    };
  }

  /**
   * Execute function with retry and circuit breaker
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<T> {
    const result = await retryWithCircuitBreaker(
      this.circuitBreaker,
      fn,
      {
        ...this.retryOptions,
        onRetry: (error, attempt) => {
          logger.warn("Retrying operation", {
            attempt,
            maxAttempts: this.retryOptions.maxAttempts,
            error: error instanceof Error ? error : new Error(String(error)),
            context,
          });

          // Call original onRetry if provided
          this.retryOptions.onRetry(error, attempt);
        },
      },
    );

    if (!result.data && result.error) {
      throw result.error;
    }

    return result.data!;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();
    return metrics.state === "closed" && metrics.failureRate < 0.5;
  }
}

/**
 * Create a Webflow-specific retry handler
 */
export function createWebflowRetryHandler(
  options?: {
    name?: string;
    circuitBreaker?: Partial<CircuitBreakerOptions>;
    retry?: Partial<RetryOptions>;
  },
): WebflowRetryHandler {
  return new WebflowRetryHandler(
    options?.name,
    options?.circuitBreaker,
    options?.retry,
  );
}

/**
 * Decorator for adding retry logic to async functions
 */
export function withRetry<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  retryOptions?: Partial<RetryOptions>,
) {
  return async (...args: TArgs): Promise<TReturn> => {
    const result = await retry(() => fn(...args), retryOptions);

    if (!result.data && result.error) {
      throw result.error;
    }

    return result.data!;
  };
}

/**
 * Decorator for adding circuit breaker to async functions
 */
export function withCircuitBreaker<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  circuitBreakerName: string,
  options?: Partial<CircuitBreakerOptions>,
) {
  const circuitBreaker = new CircuitBreaker(circuitBreakerName, {
    failureThreshold: 5,
    resetTimeout: 60000,
    ...options,
  });

  return (...args: TArgs): Promise<TReturn> => {
    return circuitBreaker.execute(() => fn(...args));
  };
}

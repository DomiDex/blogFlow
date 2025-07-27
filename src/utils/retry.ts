/// <reference lib="deno.ns" />
import { logger } from "@utils/logger.ts";
import { ExternalServiceError, TimeoutError } from "@utils/errors.ts";
import { RETRY_CONFIG } from "@config/constants.ts";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  retryableErrors?: Array<new (...args: any[]) => Error>;
  onRetry?: (error: Error, attempt: number) => void;
  timeout?: number;
}

export interface RetryResult<T> {
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

// Default retry options based on constants
const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: RETRY_CONFIG.maxAttempts,
  initialDelay: RETRY_CONFIG.initialDelay,
  maxDelay: RETRY_CONFIG.maxDelay,
  backoffMultiplier: RETRY_CONFIG.backoffMultiplier,
  retryableStatuses: RETRY_CONFIG.retryableStatuses,
  retryableErrors: [ExternalServiceError, TimeoutError],
  onRetry: () => {},
  timeout: 30000, // 30 seconds default timeout
};

// Calculate delay with exponential backoff and jitter
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
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
  retryableErrors: Array<new (...args: any[]) => Error>
): boolean {
  if (!error) return false;

  // Check if it's a retryable error type
  for (const ErrorClass of retryableErrors) {
    if (error instanceof ErrorClass) return true;
  }

  // Check if it's an HTTP error with retryable status
  if (error instanceof Error && "status" in error) {
    const status = (error as any).status;
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
    ];
    return transientMessages.some(msg => error.message.includes(msg));
  }

  return false;
}

// Retry with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...defaultRetryOptions, ...options };
  const startTime = performance.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Create a timeout promise if timeout is specified
      let timeoutId: number | undefined;
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
        ...(timeoutId !== undefined ? [timeoutPromise] : [])
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
        const delay = calculateDelay(
          attempt,
          opts.initialDelay,
          opts.maxDelay,
          opts.backoffMultiplier
        );

        // Call onRetry callback
        opts.onRetry(lastError, attempt);

        logger.debug(`Retrying after ${delay}ms`, {
          attempt,
          delay,
          nextAttempt: attempt + 1,
        });

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
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

// Circuit breaker implementation
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  
  constructor(
    private readonly name: string,
    private readonly options: {
      failureThreshold: number;
      resetTimeout: number;
      testTimeout?: number;
    }
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === "open") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.options.resetTimeout) {
        this.state = "half-open";
        logger.info(`Circuit breaker ${this.name} entering half-open state`);
      } else {
        throw new ExternalServiceError(
          this.name,
          `Circuit breaker is open for ${this.name}`
        );
      }
    }

    try {
      const result = await fn();
      
      // Success - reset failures if in half-open state
      if (this.state === "half-open") {
        this.state = "closed";
        this.failures = 0;
        logger.info(`Circuit breaker ${this.name} closed after successful request`);
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = "open";
      logger.warn(`Circuit breaker ${this.name} opened after ${this.failures} failures`, {
        failureThreshold: this.options.failureThreshold,
        resetTimeout: this.options.resetTimeout,
      });
    }
  }

  getState(): "closed" | "open" | "half-open" {
    return this.state;
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.lastFailureTime = 0;
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }
}

// Retry with circuit breaker
export async function retryWithCircuitBreaker<T>(
  circuitBreaker: CircuitBreaker,
  fn: () => Promise<T>,
  retryOptions?: RetryOptions
): Promise<RetryResult<T>> {
  return retry(
    () => circuitBreaker.execute(fn),
    retryOptions
  );
}
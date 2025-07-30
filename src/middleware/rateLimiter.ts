/// <reference lib="deno.ns" />
import type { Context, Next } from "@hono/hono";
import { RateLimitError } from "@utils/errors.ts";
import { logger } from "@utils/logger.ts";
import { config } from "@config/index.ts";

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (c: Context) => string; // Custom key generator
  skip?: (c: Context) => boolean; // Skip rate limiting for certain requests
  handler?: (c: Context) => Response; // Custom handler for rate limited requests
  message?: string; // Custom error message
}

// Default configurations for different endpoints
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  global: {
    windowMs: config.RATE_LIMIT_WINDOW_MS || 60000, // 1 minute
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS || 60,
    message: "Too many requests, please try again later.",
  },
  api: {
    windowMs: 60000, // 1 minute
    maxRequests: 30, // Stricter for API endpoints
    message: "API rate limit exceeded.",
  },
  form: {
    windowMs: 300000, // 5 minutes
    maxRequests: 50, // 50 form submissions per 5 minutes
    message: "Too many form submissions. Please wait before trying again.",
  },
};

// Client info for tracking
interface ClientInfo {
  count: number;
  firstRequest: number;
  lastRequest: number;
  windowStart: number;
}

// Sliding window log entry
interface RequestLog {
  timestamp: number;
  weight: number; // For weighted rate limiting
}

// In-memory storage (will be replaced with Deno KV in production)
class RateLimitStore {
  private clients = new Map<string, ClientInfo>();
  private slidingWindowLogs = new Map<string, RequestLog[]>();
  private cleanupInterval: number;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  // Fixed window counter implementation
  increment(key: string, windowMs: number): ClientInfo {
    const now = Date.now();
    const client = this.clients.get(key);

    if (!client || now - client.windowStart > windowMs) {
      // New window
      const newClient: ClientInfo = {
        count: 1,
        firstRequest: now,
        lastRequest: now,
        windowStart: now,
      };
      this.clients.set(key, newClient);
      return newClient;
    }

    // Same window
    client.count++;
    client.lastRequest = now;
    return client;
  }

  // Sliding window log implementation
  addToSlidingWindow(key: string, windowMs: number, weight = 1): number {
    const now = Date.now();
    const logs = this.slidingWindowLogs.get(key) || [];

    // Remove old entries outside the window
    const cutoff = now - windowMs;
    const validLogs = logs.filter((log) => log.timestamp > cutoff);

    // Add new entry
    validLogs.push({ timestamp: now, weight });
    this.slidingWindowLogs.set(key, validLogs);

    // Calculate total weight in window
    return validLogs.reduce((sum, log) => sum + log.weight, 0);
  }

  // Get current count for fixed window
  getCount(key: string, windowMs: number): number {
    const client = this.clients.get(key);
    if (!client) return 0;

    const now = Date.now();
    if (now - client.windowStart > windowMs) {
      return 0; // Window expired
    }

    return client.count;
  }

  // Reset a client's count
  reset(key: string): void {
    this.clients.delete(key);
    this.slidingWindowLogs.delete(key);
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    const maxWindow = 3600000; // 1 hour - max window we support

    // Cleanup fixed window entries
    for (const [key, client] of this.clients.entries()) {
      if (now - client.lastRequest > maxWindow) {
        this.clients.delete(key);
      }
    }

    // Cleanup sliding window entries
    for (const [key, logs] of this.slidingWindowLogs.entries()) {
      if (logs.length === 0 || now - logs[logs.length - 1].timestamp > maxWindow) {
        this.slidingWindowLogs.delete(key);
      }
    }

    logger.debug("Rate limit store cleanup completed", {
      clientsCount: this.clients.size,
      slidingWindowCount: this.slidingWindowLogs.size,
    });
  }

  // Get store statistics
  getStats() {
    let totalRequests = 0;
    for (const [_, client] of this.clients.entries()) {
      totalRequests += client.count;
    }

    return {
      clientsCount: this.clients.size,
      slidingWindowCount: this.slidingWindowLogs.size,
      totalRequests,
      activeClients: this.clients.size,
    };
  }

  // Destroy the store
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clients.clear();
    this.slidingWindowLogs.clear();
  }
}

// Global store instance
const store = new RateLimitStore();

// Extract client identifier from request
function getClientId(c: Context, keyGenerator?: (c: Context) => string): string {
  if (keyGenerator) {
    return keyGenerator(c);
  }

  // Try to get real IP address
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    // Take the first IP from the list
    return forwarded.split(",")[0].trim();
  }

  const realIp = c.req.header("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to remote address
  const remoteAddr = c.env?.remoteAddr;
  if (remoteAddr && typeof remoteAddr === "object" && "hostname" in remoteAddr) {
    return remoteAddr.hostname;
  }

  // Last resort - use a combination of headers
  const userAgent = c.req.header("user-agent") || "unknown";
  const acceptLanguage = c.req.header("accept-language") || "unknown";
  return `anonymous-${userAgent}-${acceptLanguage}`.slice(0, 100);
}

// Calculate reset time
function getResetTime(windowMs: number): Date {
  return new Date(Date.now() + windowMs);
}

// Rate limiter factory
export function rateLimiter(
  options: Partial<RateLimitConfig> = {},
): (c: Context, next: Next) => Promise<Response | void> {
  const config: RateLimitConfig = {
    ...rateLimitConfigs.global,
    ...options,
  };

  return async (c: Context, next: Next) => {
    // Check if we should skip this request
    if (config.skip && config.skip(c)) {
      return next();
    }

    const clientId = getClientId(c, config.keyGenerator);
    const key = `rate-limit:${clientId}`;
    const requestId = c.get("requestId") as string;

    try {
      // Increment counter
      const client = store.increment(key, config.windowMs);
      const remaining = Math.max(0, config.maxRequests - client.count);
      const resetTime = getResetTime(config.windowMs - (Date.now() - client.windowStart));

      // Set rate limit headers
      c.header("X-RateLimit-Limit", String(config.maxRequests));
      c.header("X-RateLimit-Remaining", String(remaining));
      c.header("X-RateLimit-Reset", resetTime.toISOString());

      // Check if limit exceeded
      if (client.count > config.maxRequests) {
        const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

        logger.warn("Rate limit exceeded", {
          requestId,
          clientId,
          count: client.count,
          limit: config.maxRequests,
          windowMs: config.windowMs,
          path: c.req.path,
        });

        // Use custom handler if provided
        if (config.handler) {
          return config.handler(c);
        }

        // Throw rate limit error
        throw new RateLimitError(
          config.message || "Too many requests",
          retryAfter,
          config.maxRequests,
          0,
          resetTime,
          {
            clientId,
            count: client.count,
            windowMs: config.windowMs,
          },
        );
      }

      // Process request
      await next();

      // Handle skip conditions after request
      const status = c.res.status;
      if (config.skipSuccessfulRequests && status < 400) {
        // Rollback the increment
        client.count--;
      } else if (config.skipFailedRequests && status >= 400) {
        // Rollback the increment
        client.count--;
      }
    } catch (error) {
      // Re-throw if it's already a RateLimitError
      if (error instanceof RateLimitError) {
        throw error;
      }

      // Log unexpected errors but don't block the request
      logger.error("Rate limiter error", {
        requestId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      // Continue processing
      return next();
    }
  };
}

// Endpoint-specific rate limiters
export const apiRateLimiter = rateLimiter(rateLimitConfigs.api);
export const formRateLimiter = rateLimiter(rateLimitConfigs.form);

// Sliding window rate limiter for more accurate rate limiting
export function slidingWindowRateLimiter(
  options: Partial<RateLimitConfig> = {},
): (c: Context, next: Next) => Promise<Response | void> {
  const config: RateLimitConfig = {
    ...rateLimitConfigs.global,
    ...options,
  };

  return async (c: Context, next: Next) => {
    if (config.skip && config.skip(c)) {
      return next();
    }

    const clientId = getClientId(c, config.keyGenerator);
    const key = `sliding:${clientId}`;
    const requestId = c.get("requestId") as string;

    try {
      // Add to sliding window and get count
      const count = store.addToSlidingWindow(key, config.windowMs);
      const remaining = Math.max(0, config.maxRequests - count);
      const resetTime = new Date(Date.now() + config.windowMs);

      // Set headers
      c.header("X-RateLimit-Limit", String(config.maxRequests));
      c.header("X-RateLimit-Remaining", String(remaining));
      c.header("X-RateLimit-Reset", resetTime.toISOString());
      c.header("X-RateLimit-Policy", "sliding-window");

      if (count > config.maxRequests) {
        const retryAfter = Math.ceil(config.windowMs / 1000);

        logger.warn("Rate limit exceeded (sliding window)", {
          requestId,
          clientId,
          count,
          limit: config.maxRequests,
          windowMs: config.windowMs,
          path: c.req.path,
        });

        throw new RateLimitError(
          config.message || "Too many requests",
          retryAfter,
          config.maxRequests,
          0,
          resetTime,
          {
            clientId,
            count,
            windowMs: config.windowMs,
            algorithm: "sliding-window",
          },
        );
      }

      await next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }

      logger.error("Sliding window rate limiter error", {
        requestId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return next();
    }
  };
}

// IP whitelist functionality
const whitelistedIPs = new Set<string>([
  "127.0.0.1",
  "::1", // IPv6 localhost
  // Add more trusted IPs here
]);

export function createWhitelistSkip(additionalIPs: string[] = []): (c: Context) => boolean {
  const allWhitelisted = new Set([...whitelistedIPs, ...additionalIPs]);

  return (c: Context) => {
    const clientId = getClientId(c);
    return allWhitelisted.has(clientId);
  };
}

// Export store stats for monitoring
export function getRateLimitStats() {
  return store.getStats();
}

// Cleanup on module unload
if (typeof globalThis.addEventListener !== "undefined") {
  globalThis.addEventListener("unload", () => {
    store.destroy();
  });
}

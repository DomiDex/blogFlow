/// <reference lib="deno.ns" />
import type { MiddlewareHandler } from "@hono/hono";
import { config, isDevelopment } from "@config/index.ts";

/**
 * Security headers middleware
 * Implements various HTTP security headers to protect against common attacks
 */

// Content Security Policy configuration
const getCSPDirectives = (): string => {
  const baseDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.webflow.com",
    "style-src 'self' 'unsafe-inline' https://*.webflow.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://*.webflow.com https://api.webflow.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // Relax CSP in development
  if (isDevelopment) {
    baseDirectives.push("connect-src 'self' http://localhost:* ws://localhost:*");
  }

  return baseDirectives.join("; ");
};

// Security headers configuration
export const securityHeaders = {
  // Prevent XSS attacks
  "X-XSS-Protection": "1; mode=block",

  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Prevent clickjacking
  "X-Frame-Options": "DENY",

  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Permissions Policy (formerly Feature Policy)
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",

  // HSTS (only in production)
  ...(config.NODE_ENV === "production" && {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  }),
};

// Security middleware
export const securityMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    // Add security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      if (value) {
        c.header(key, value);
      }
    });

    // Add Content Security Policy
    const csp = getCSPDirectives();
    c.header("Content-Security-Policy", csp);

    // Remove sensitive headers
    c.header("X-Powered-By", ""); // Remove or set to custom value

    // Add request ID for tracking (if not already present)
    const requestId = c.get("requestId") || crypto.randomUUID();
    c.header("X-Request-Id", requestId);

    await next();
  };
};

// Helper to validate content type for form submissions
export const validateContentType = (contentType: string | null): boolean => {
  if (!contentType) return false;

  const allowedTypes = [
    "application/json",
    "application/x-www-form-urlencoded",
    "multipart/form-data",
  ];

  return allowedTypes.some((type) => contentType.includes(type));
};

// Helper to sanitize headers before logging
export const sanitizeHeaders = (headers: Headers): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  const sensitiveHeaders = ["authorization", "cookie", "x-api-key"];

  headers.forEach((value, key) => {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
};

// Rate limit headers helper
export const addRateLimitHeaders = (
  headers: Headers,
  remaining: number,
  limit: number,
  reset: number,
): void => {
  headers.set("X-RateLimit-Limit", limit.toString());
  headers.set("X-RateLimit-Remaining", remaining.toString());
  headers.set("X-RateLimit-Reset", reset.toString());
  headers.set("X-RateLimit-Reset-After", Math.max(0, reset - Date.now()).toString());
};

// Export configuration for testing
export const securityConfig = {
  getCSPDirectives,
  securityHeaders,
  validateContentType,
  sanitizeHeaders,
};

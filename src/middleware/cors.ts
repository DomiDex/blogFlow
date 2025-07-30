/// <reference lib="deno.ns" />
import { cors } from "@hono/cors";
import { config, isDevelopment } from "@config/index.ts";
import type { MiddlewareHandler } from "@hono/hono";
import type { Variables } from "@app-types";

/**
 * CORS configuration for Webflow form submissions
 * Handles cross-origin requests with proper security settings
 */

// Parse allowed origins from environment
const getAllowedOrigins = (): string[] => {
  const origins = config.CORS_ORIGINS;

  // Add localhost for development
  if (isDevelopment) {
    origins.push("http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000");
    // Add null origin for file:// protocol in development
    origins.push("null");
  }

  return origins;
};

// Create a function to validate origins with wildcard support
const createOriginValidator = (allowedOrigins: string[]) => {
  return (origin: string): string | null => {
    // Log the incoming origin for debugging
    console.log(`[CORS] Checking origin: ${origin || "no-origin"}`);

    // Allow requests with no origin (non-browser requests like Postman)
    if (!origin) {
      return isDevelopment ? "*" : null;
    }

    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      console.log(`[CORS] Origin allowed (exact match): ${origin}`);
      return origin;
    }

    // Check wildcard patterns
    const isAllowed = allowedOrigins.some((pattern) => {
      if (!pattern.includes("*")) {
        return pattern === origin;
      }

      // Convert wildcard pattern to regex
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*");
      const regex = new RegExp(`^${regexPattern}$`);

      const matches = regex.test(origin);
      if (matches) {
        console.log(`[CORS] Origin allowed (pattern match): ${origin} matches ${pattern}`);
      }
      return matches;
    });

    if (!isAllowed) {
      console.log(`[CORS] Origin rejected: ${origin}. Allowed origins:`, allowedOrigins);
    }

    return isAllowed ? origin : null;
  };
};

// CORS middleware configuration
export const corsMiddleware = (): MiddlewareHandler<{ Variables: Variables }> => {
  const allowedOrigins = getAllowedOrigins();
  const validateOrigin = createOriginValidator(allowedOrigins);

  return cors({
    origin: validateOrigin,
    allowMethods: ["GET", "POST", "OPTIONS", "HEAD"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Referer",
    ],
    exposeHeaders: [
      "X-Request-Id",
      "X-Response-Time",
      "X-Rate-Limit-Remaining",
    ],
    credentials: true,
    maxAge: 86400, // 24 hours preflight cache
  });
};

// Additional CORS headers for extra control
export const corsHeaders = {
  // CORS headers
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",

  // Security headers (will be moved to security middleware)
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// Helper to check if a request is a preflight request
export const isPreflightRequest = (method: string): boolean => {
  return method === "OPTIONS";
};

// Helper to add CORS headers manually if needed
export const addCorsHeaders = (headers: Headers, origin?: string): void => {
  const allowedOrigins = getAllowedOrigins();
  const validateOrigin = createOriginValidator(allowedOrigins);

  if (origin) {
    const allowedOrigin = validateOrigin(origin);
    if (allowedOrigin) {
      headers.set("Access-Control-Allow-Origin", allowedOrigin);
    }
  }

  // Add other CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
};

// Export configuration for testing
export const corsConfig = {
  getAllowedOrigins,
  createOriginValidator,
  corsHeaders,
};

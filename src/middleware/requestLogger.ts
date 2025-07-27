/// <reference lib="deno.ns" />
import type { Context, Next } from "@hono/hono";
import { logger } from "@utils/logger.ts";
import { config } from "@config/index.ts";

// Generate unique request ID
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${randomPart}`;
}

// Extract IP address from request
function getClientIP(c: Context): string {
  // Check common headers in order of priority
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = c.req.header("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to remote address if available
  const remoteAddr = c.env?.remoteAddr;
  if (remoteAddr && typeof remoteAddr === "object" && "hostname" in remoteAddr) {
    return remoteAddr.hostname;
  }

  return "unknown";
}

// Check if body should be logged
function shouldLogBody(contentType: string | undefined): boolean {
  if (!contentType) return false;
  
  const loggedTypes = [
    "application/json",
    "application/x-www-form-urlencoded",
    "text/plain",
  ];
  
  return loggedTypes.some(type => contentType.includes(type));
}

// Sanitize headers for logging
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized = { ...headers };
  const sensitiveHeaders = [
    "authorization",
    "x-api-key",
    "x-auth-token",
    "cookie",
    "set-cookie",
  ];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

export const requestLogger = () => {
  return async (c: Context, next: Next) => {
    const start = performance.now();
    const requestId = generateRequestId();
    
    // Attach request ID to context
    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);

    const method = c.req.method;
    const path = c.req.path;
    const clientIP = getClientIP(c);
    const userAgent = c.req.header("user-agent") || "unknown";

    // Log incoming request
    const requestHeaders = Object.fromEntries(c.req.raw.headers);
    logger.info(`Incoming ${method} ${path}`, {
      requestId,
      method,
      path,
      clientIP,
      userAgent,
      headers: sanitizeHeaders(requestHeaders),
    });

    // Log request body if applicable
    if (method !== "GET" && method !== "HEAD") {
      const contentType = c.req.header("content-type");
      
      if (shouldLogBody(contentType)) {
        try {
          // Clone the request to avoid consuming the body
          const clonedRequest = c.req.raw.clone();
          const body = await clonedRequest.json();
          logger.debug("Request body", {
            requestId,
            body, // Logger will mask sensitive data internally
          });
        } catch {
          // Body might not be JSON or already consumed
        }
      }
    }

    try {
      // Execute the route handler
      await next();

      // Calculate response time
      const duration = Math.round(performance.now() - start);
      const status = c.res.status;

      // Log response
      logger.http(method, path, status, duration, {
        requestId,
        clientIP,
        userAgent,
        responseHeaders: sanitizeHeaders(
          Object.fromEntries(c.res.headers)
        ),
      });

      // Log slow requests
      if (duration > 1000) {
        logger.performance("HTTP Request", duration, {
          requestId,
          method,
          path,
          status,
        });
      }

      // Add timing header
      c.header("X-Response-Time", `${duration}ms`);

    } catch (error) {
      // Calculate duration even on error
      const duration = Math.round(performance.now() - start);
      
      // Log the error
      logger.error(`Request failed: ${method} ${path}`, {
        requestId,
        method,
        path,
        clientIP,
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      // Re-throw to let error handler middleware deal with it
      throw error;
    }
  };
};
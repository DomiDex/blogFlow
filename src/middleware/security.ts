/// <reference lib="deno.ns" />
import type { Context, MiddlewareHandler } from "@hono/hono";
import { isDevelopment, isProduction } from "@config/index.ts";
import { logger } from "@utils/logger.ts";
import type { Variables } from "@app-types";

/**
 * Security headers middleware
 * Implements comprehensive HTTP security headers to protect against common attacks
 */

// Security configuration interface
export interface SecurityConfig {
  enableHSTS: boolean;
  enableCSP: boolean;
  enableCSPReporting: boolean;
  cspReportUri?: string;
  enableNonce: boolean;
  trustedHosts: string[];
  maxRequestSize: number;
}

// Default security configuration
const defaultSecurityConfig: SecurityConfig = {
  enableHSTS: isProduction,
  enableCSP: true,
  enableCSPReporting: isProduction,
  cspReportUri: "/api/csp-report",
  enableNonce: false, // Can be enabled for stricter CSP
  trustedHosts: ["*.webflow.com", "*.webflow.io", "api.webflow.com"],
  maxRequestSize: 10 * 1024 * 1024, // 10MB
};

// Generate CSP nonce if enabled
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

// Content Security Policy configuration
const getCSPDirectives = (nonce?: string): string => {
  const scriptSrc = nonce
    ? `'self' 'nonce-${nonce}' https://*.webflow.com`
    : "'self' 'unsafe-inline' 'unsafe-eval' https://*.webflow.com";

  const baseDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://*.webflow.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://*.webflow.com https://api.webflow.com wss://*.webflow.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.webflow.com",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "require-trusted-types-for 'script'",
  ];

  // Relax CSP in development
  if (isDevelopment) {
    baseDirectives.push(
      "connect-src 'self' http://localhost:* ws://localhost:* https://*.webflow.com",
    );
  }

  // Add report URI if enabled
  if (defaultSecurityConfig.enableCSPReporting && defaultSecurityConfig.cspReportUri) {
    baseDirectives.push(`report-uri ${defaultSecurityConfig.cspReportUri}`);
    baseDirectives.push(`report-to csp-endpoint`);
  }

  return baseDirectives.join("; ");
};

// Enhanced security headers configuration
export const getSecurityHeaders = (_c?: Context): Record<string, string> => {
  const headers: Record<string, string> = {
    // Prevent XSS attacks
    "X-XSS-Protection": "1; mode=block",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Prevent clickjacking
    "X-Frame-Options": "DENY",

    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions Policy (formerly Feature Policy)
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()",

    // DNS Prefetch Control
    "X-DNS-Prefetch-Control": "off",

    // Download Options for IE
    "X-Download-Options": "noopen",

    // Permitted Cross-Domain Policies
    "X-Permitted-Cross-Domain-Policies": "none",

    // Expect-CT for Certificate Transparency
    "Expect-CT": "max-age=86400, enforce",

    // Cross-Origin Headers
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  // HSTS (only in production)
  if (defaultSecurityConfig.enableHSTS) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  // Report-To header for CSP reporting
  if (defaultSecurityConfig.enableCSPReporting) {
    headers["Report-To"] = JSON.stringify({
      group: "csp-endpoint",
      max_age: 86400,
      endpoints: [{ url: defaultSecurityConfig.cspReportUri }],
    });
  }

  // Remove sensitive headers
  headers["X-Powered-By"] = "";
  headers["Server"] = ""; // Hide server information

  return headers;
};

// Security middleware
export const securityMiddleware = (
  options: Partial<SecurityConfig> = {},
): MiddlewareHandler<{ Variables: Variables }> => {
  const config = { ...defaultSecurityConfig, ...options };

  return async (c, next) => {
    // Generate nonce if enabled
    const nonce = config.enableNonce ? generateNonce() : undefined;
    if (nonce) {
      c.set("cspNonce", nonce);
    }

    // Get and apply security headers
    const headers = getSecurityHeaders(c);
    Object.entries(headers).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        c.header(key, value);
      }
    });

    // Add Content Security Policy if enabled
    if (config.enableCSP) {
      const csp = getCSPDirectives(nonce);
      c.header("Content-Security-Policy", csp);
    }

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
  const sensitiveHeaders = [
    "authorization",
    "cookie",
    "x-api-key",
    "x-csrf-token",
    "x-auth-token",
    "api-key",
    "access-token",
    "refresh-token",
  ];

  headers.forEach((value, key) => {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
};

// Request validation middleware
export const requestValidation = (): MiddlewareHandler<{ Variables: Variables }> => {
  return async (c, next) => {
    const method = c.req.method;
    const contentType = c.req.header("content-type");
    const contentLength = c.req.header("content-length");
    const requestId = c.get("requestId");

    // Validate Content-Type for POST/PUT/PATCH requests
    if (["POST", "PUT", "PATCH"].includes(method)) {
      if (!validateContentType(contentType || null)) {
        logger.warn("Invalid content type", {
          requestId,
          contentType,
          method,
          path: c.req.path,
        });
        return c.json(
          {
            error: "Invalid Content-Type",
            message:
              "Content-Type must be application/json, application/x-www-form-urlencoded, or multipart/form-data",
          },
          415, // Unsupported Media Type
        );
      }
    }

    // Check request size
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > defaultSecurityConfig.maxRequestSize) {
        logger.warn("Request too large", {
          requestId,
          size,
          maxSize: defaultSecurityConfig.maxRequestSize,
          path: c.req.path,
        });
        return c.json(
          {
            error: "Payload Too Large",
            message: `Request body must not exceed ${defaultSecurityConfig.maxRequestSize} bytes`,
          },
          413, // Payload Too Large
        );
      }
    }

    // Validate JSON structure to prevent prototype pollution
    if (contentType?.includes("application/json")) {
      try {
        const body = await c.req.raw.clone().text();
        if (body) {
          // Check for __proto__ or constructor pollution attempts
          if (
            body.includes("__proto__") || body.includes("constructor") || body.includes("prototype")
          ) {
            logger.error("Potential prototype pollution attempt", {
              requestId,
              path: c.req.path,
              method,
            });
            return c.json(
              {
                error: "Invalid JSON",
                message: "Request contains potentially malicious properties",
              },
              400,
            );
          }
        }
      } catch (_error) {
        // Body might not be readable, continue
      }
    }

    await next();
  };
};

// CSRF token generation and validation
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
};

export const validateCSRFToken = (token: string | null, sessionToken: string): boolean => {
  if (!token || !sessionToken) return false;
  return token === sessionToken;
};

// API Key validation middleware
export const apiKeyValidation = (
  validKeys: Set<string>,
): MiddlewareHandler<{ Variables: Variables }> => {
  return async (c, next) => {
    const apiKey = c.req.header("x-api-key") || c.req.header("api-key");
    const requestId = c.get("requestId");

    if (!apiKey) {
      logger.warn("Missing API key", {
        requestId,
        path: c.req.path,
      });
      return c.json(
        {
          error: "Unauthorized",
          message: "API key is required",
        },
        401,
      );
    }

    if (!validKeys.has(apiKey)) {
      logger.warn("Invalid API key", {
        requestId,
        path: c.req.path,
      });
      return c.json(
        {
          error: "Unauthorized",
          message: "Invalid API key",
        },
        401,
      );
    }

    // Store API key info in context
    c.set("apiKey", apiKey);
    await next();
  };
};

// Security.txt endpoint handler
export const securityTxtHandler = (): string => {
  const contact = "mailto:security@example.com";
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  return `Contact: ${contact}
Expires: ${expires}
Encryption: https://example.com/pgp-key.txt
Acknowledgments: https://example.com/security-acknowledgments
Preferred-Languages: en
Canonical: https://example.com/.well-known/security.txt
Policy: https://example.com/security-policy
Hiring: https://example.com/security-careers
`;
};

// Export configuration for testing
export const securityConfig = {
  getCSPDirectives,
  getSecurityHeaders,
  validateContentType,
  sanitizeHeaders,
  defaultSecurityConfig,
};

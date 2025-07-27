/// <reference lib="deno.ns" />
import { Hono } from "@hono/hono";
import { logger } from "@utils/logger.ts";
import { securityTxtHandler } from "@middleware/security.ts";
import type { Variables } from "@app-types";

export const securityRoutes = new Hono<{ Variables: Variables }>();

// CSP violation report endpoint
securityRoutes.post("/api/csp-report", async (c) => {
  const requestId = c.get("requestId");
  
  try {
    const report = await c.req.json();
    
    // Log CSP violation
    logger.warn("CSP Violation Report", {
      requestId,
      report,
      userAgent: c.req.header("user-agent"),
      referer: c.req.header("referer"),
    });

    // In production, you might want to send this to a monitoring service
    if (report["csp-report"]) {
      const violation = report["csp-report"];
      logger.warn("CSP Violation Details", {
        requestId,
        documentUri: violation["document-uri"],
        violatedDirective: violation["violated-directive"],
        effectiveDirective: violation["effective-directive"],
        originalPolicy: violation["original-policy"],
        blockedUri: violation["blocked-uri"],
        statusCode: violation["status-code"],
        referrer: violation.referrer,
        scriptSample: violation["script-sample"],
        disposition: violation.disposition,
      });
    }

    return c.body(null, 204); // No Content
  } catch (error) {
    logger.error("Failed to process CSP report", {
      requestId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return c.body(null, 204); // Still return 204 to avoid retries
  }
});

// Security.txt endpoint (RFC 9116)
securityRoutes.get("/.well-known/security.txt", (c) => {
  c.header("Content-Type", "text/plain");
  c.header("Cache-Control", "max-age=86400"); // Cache for 24 hours
  
  return c.text(securityTxtHandler());
});

// Robots.txt endpoint
securityRoutes.get("/robots.txt", (c) => {
  c.header("Content-Type", "text/plain");
  c.header("Cache-Control", "max-age=86400");
  
  // Disallow crawling of API endpoints
  const robotsTxt = `User-agent: *
Disallow: /api/
Disallow: /.well-known/
Allow: /

# Sitemap
Sitemap: https://example.com/sitemap.xml

# Crawl-delay (in seconds)
Crawl-delay: 1
`;
  
  return c.text(robotsTxt);
});

// Health check for security headers
securityRoutes.get("/api/security-check", (c) => {
  const headers = Object.fromEntries(c.res.headers);
  const requestId = c.get("requestId");
  
  // Check for essential security headers
  const requiredHeaders = [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-XSS-Protection",
    "Referrer-Policy",
    "Content-Security-Policy",
    "Permissions-Policy",
  ];
  
  const missingHeaders = requiredHeaders.filter(header => 
    !headers[header.toLowerCase()]
  );
  
  const securityScore = ((requiredHeaders.length - missingHeaders.length) / requiredHeaders.length) * 100;
  
  logger.info("Security headers check", {
    requestId,
    score: securityScore,
    missingHeaders,
  });
  
  return c.json({
    score: securityScore,
    headers: headers,
    missingHeaders,
    recommendations: missingHeaders.map(header => ({
      header,
      description: getHeaderDescription(header),
    })),
  });
});

// Helper function to get header descriptions
function getHeaderDescription(header: string): string {
  const descriptions: Record<string, string> = {
    "X-Content-Type-Options": "Prevents MIME type sniffing",
    "X-Frame-Options": "Prevents clickjacking attacks",
    "X-XSS-Protection": "Enables XSS filtering in browsers",
    "Strict-Transport-Security": "Forces HTTPS connections",
    "Referrer-Policy": "Controls referrer information",
    "Content-Security-Policy": "Prevents various injection attacks",
    "Permissions-Policy": "Controls browser features and APIs",
  };
  
  return descriptions[header] || "Security header";
}
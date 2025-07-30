/// <reference lib="deno.ns" />
import type { Context, Next } from "@hono/hono";
import { logger } from "@utils/logger.ts";

/**
 * Middleware to parse form-encoded data and convert it to JSON format
 * This allows the API to accept both JSON and form-encoded submissions
 */
export async function parseFormData(c: Context, next: Next) {
  const requestId = c.get("requestId") as string;
  const contentType = c.req.header("content-type") || "";
  
  // Only process form-encoded data
  if (!contentType.includes("application/x-www-form-urlencoded") && 
      !contentType.includes("multipart/form-data")) {
    await next();
    return;
  }

  try {
    logger.debug("Parsing form-encoded data", {
      requestId,
      contentType,
      method: c.req.method,
    });

    // Parse form data
    const formData = await c.req.parseBody();
    
    // Convert form data to expected JSON structure
    const jsonData: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(formData)) {
      // Handle special cases for our form fields
      switch (key) {
        case 'content':
        case 'articleContent':
          // Parse Quill content from HTML or Delta JSON string
          if (typeof value === 'string') {
            try {
              // Try to parse as Delta JSON first
              const parsed = JSON.parse(value);
              jsonData.articleContent = parsed;
            } catch {
              // If not JSON, treat as HTML and convert to Delta format
              jsonData.articleContent = {
                ops: [{ insert: value }]
              };
            }
          }
          break;
          
        case 'tags':
        case 'categories':
          // Convert comma-separated values to array
          if (typeof value === 'string' && value.trim()) {
            jsonData[key] = value.split(',').map(item => item.trim()).filter(Boolean);
          }
          break;
          
        case 'publishNow':
          // Convert string boolean to actual boolean
          jsonData[key] = value === 'true' || value === '1' || value === 'on';
          break;
          
        default:
          // Pass through other fields as-is
          jsonData[key] = value;
      }
    }
    
    logger.debug("Form data converted to JSON", {
      requestId,
      fields: Object.keys(jsonData),
      hasContent: !!jsonData.articleContent,
    });

    // Override the request json() method to return our parsed data
    c.req.json = async () => jsonData;
    
    await next();
  } catch (error) {
    logger.error("Failed to parse form data", {
      requestId,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    return c.json({
      error: "Form parsing failed",
      message: "Failed to parse form data",
      fields: {},
      summary: "Invalid form data",
      timestamp: new Date().toISOString(),
      requestId,
    }, 400);
  }
}
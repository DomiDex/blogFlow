import { Hono } from "@hono/hono";
import { ValidationError, BusinessLogicError } from "@utils/errors.ts";
import { logger } from "@utils/logger.ts";

export const webflowRoutes = new Hono();

// Main form submission endpoint - placeholder implementation
webflowRoutes.post("/webflow-form", async (c) => {
  const requestId = c.get("requestId") as string;
  
  // Log the incoming request for debugging
  logger.debug("Processing form submission", {
    requestId,
    method: c.req.method,
    url: c.req.url,
  });

  // Get request body (will be validated in later tasks)
  let body;
  const contentType = c.req.header("content-type");
  
  if (!contentType || !contentType.includes("application/json")) {
    throw new ValidationError(
      "Content-Type must be application/json",
      "headers.content-type",
      contentType
    );
  }

  try {
    body = await c.req.json();
  } catch (error) {
    // Get the raw body text for error reporting
    const rawBody = await c.req.raw.clone().text();
    throw new ValidationError(
      "Request body must be valid JSON",
      "body",
      rawBody,
      { parseError: error instanceof Error ? error.message : String(error) }
    );
  }

  // Basic validation example (will be enhanced with Zod in later tasks)
  if (!body || typeof body !== "object") {
    throw new ValidationError(
      "Request body must be a non-empty object",
      "body",
      body
    );
  }

  // Example of field-specific validation
  if (!body.authorName || typeof body.authorName !== "string") {
    throw new ValidationError(
      "Author name is required and must be a string",
      "authorName",
      body.authorName
    );
  }

  if (!body.articleTitle || typeof body.articleTitle !== "string") {
    throw new ValidationError(
      "Article title is required and must be a string",
      "articleTitle",
      body.articleTitle
    );
  }

  // Example of business logic error
  if (body.articleTitle.length < 5) {
    throw new BusinessLogicError(
      "Article title must be at least 5 characters long",
      "TITLE_TOO_SHORT",
      { providedLength: body.articleTitle.length, minimumLength: 5 }
    );
  }

  // Placeholder response - full implementation in later tasks
  return c.json({
    success: true,
    message: "Form submission received (placeholder implementation)",
    received: body,
    timestamp: new Date().toISOString(),
    requestId,
    note: "Full Webflow CMS integration pending",
  });
});

// Options endpoint for CORS preflight
webflowRoutes.options("/webflow-form", (_c) => {
  // CORS headers are handled by middleware
  return new Response(null, { status: 204 });
});

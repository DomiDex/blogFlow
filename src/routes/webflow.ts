import { Hono } from "@hono/hono";

export const webflowRoutes = new Hono();

// Main form submission endpoint - placeholder implementation
webflowRoutes.post("/webflow-form", async (c) => {
  // Log the incoming request for debugging
  console.log("Received form submission:", {
    method: c.req.method,
    url: c.req.url,
    headers: c.req.header(), // Get all headers as object
  });

  // Get request body (will be validated in later tasks)
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json(
      {
        error: "Invalid Request",
        message: "Request body must be valid JSON",
      },
      400,
    );
  }

  // Placeholder response - full implementation in later tasks
  return c.json({
    success: true,
    message: "Form submission received (placeholder implementation)",
    received: body,
    timestamp: new Date().toISOString(),
    note: "Full Webflow CMS integration pending",
  });
});

// Options endpoint for CORS preflight
webflowRoutes.options("/webflow-form", (_c) => {
  // CORS headers are handled by middleware
  return new Response(null, { status: 204 });
});

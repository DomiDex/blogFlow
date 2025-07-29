#!/usr/bin/env -S deno run --allow-net --allow-read

/**
 * Simple web server to serve the test HTML file
 * This avoids CORS issues with file:// protocol
 */

import { serve } from "@std/http/server";
import { serveFile } from "@std/http/file_server";

const port = 3000;

console.log(`🌐 Serving test form at http://localhost:${port}/test-form.html`);
console.log(`📝 Make sure the API server is running on port 8000`);
console.log(`   Run: deno task dev`);
console.log(`\nPress Ctrl+C to stop the server`);

serve(async (req) => {
  const url = new URL(req.url);
  
  // Serve the test form
  if (url.pathname === "/" || url.pathname === "/test-form.html") {
    return await serveFile(req, "./test-form.html");
  }
  
  // Serve favicon to avoid 404 errors
  if (url.pathname === "/favicon.ico") {
    return new Response(null, { status: 204 });
  }
  
  // 404 for other paths
  return new Response("Not Found", { status: 404 });
}, { port });
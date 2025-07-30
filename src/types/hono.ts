/// <reference lib="deno.ns" />
import type { Hono } from "@hono/hono";

// Define our custom context variables
export type Variables = {
  requestId: string;
  userAgent: string | undefined;
  realIp: string;
  startTime: number;
  cspNonce?: string;
  apiKey?: string;
};

// Export a typed Hono instance
export type App = Hono<{ Variables: Variables }>;

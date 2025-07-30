/// <reference lib="deno.ns" />
import { load } from "@std/dotenv";
import { z } from "zod";

// Load environment variables from .env file only in development
// In production (Deno Deploy), environment variables are already available
try {
  if (Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
    // We're not on Deno Deploy, try to load .env file
    await load({
      export: true,
      allowEmptyValues: true,
    });
  }
} catch (_error) {
  // If .env file doesn't exist, that's okay - we'll use system env vars
  console.log("No .env file found, using system environment variables");
}

// Define configuration schema
const configSchema = z.object({
  // Server
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Webflow API
  WEBFLOW_API_TOKEN: z.string().min(1, "WEBFLOW_API_TOKEN is required"),
  WEBFLOW_COLLECTION_ID: z.string().min(1, "WEBFLOW_COLLECTION_ID is required"),
  WEBFLOW_SITE_ID: z.string().min(1, "WEBFLOW_SITE_ID is required"),

  // Security
  CORS_ORIGINS: z
    .string()
    .default("https://*.webflow.io,https://*.webflow.com")
    .transform((val) => val.split(",").map((origin) => origin.trim())),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),

  // Optional
  SENTRY_DSN: z.string().optional().default(""),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
});

// Parse and validate configuration
function loadConfig() {
  try {
    const env = Object.fromEntries(
      Object.entries(Deno.env.toObject()).filter(
        ([key]) => key in configSchema.shape,
      ),
    );

    return configSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Configuration validation failed:");
      console.error(JSON.stringify(error.format(), null, 2));
      Deno.exit(1);
    }
    throw error;
  }
}

export const config = loadConfig();
export type Config = typeof config;

// Helper functions for easy access
export const isDevelopment = config.NODE_ENV === "development";
export const isProduction = config.NODE_ENV === "production";
export const isTest = config.NODE_ENV === "test";

// Backwards compatibility with existing code
export const ALLOWED_ORIGINS = config.CORS_ORIGINS;

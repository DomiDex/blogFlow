import { load } from "@std/dotenv";

// Load environment variables
await load({
  export: true,
  allowEmptyValues: true,
});

export const config = {
  // Server configuration
  PORT: parseInt(Deno.env.get("PORT") || "8000", 10),
  NODE_ENV: Deno.env.get("NODE_ENV") || "development",

  // Webflow API configuration
  WEBFLOW_API_TOKEN: Deno.env.get("WEBFLOW_API_TOKEN") || "",
  WEBFLOW_COLLECTION_ID: Deno.env.get("WEBFLOW_COLLECTION_ID") || "",
  WEBFLOW_SITE_ID: Deno.env.get("WEBFLOW_SITE_ID") || "",

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(
    Deno.env.get("RATE_LIMIT_WINDOW_MS") || "60000",
    10,
  ),
  RATE_LIMIT_MAX_REQUESTS: parseInt(
    Deno.env.get("RATE_LIMIT_MAX_REQUESTS") || "100",
    10,
  ),

  // CORS
  ALLOWED_ORIGINS: Deno.env.get("ALLOWED_ORIGINS")?.split(",") || [
    "https://*.webflow.io",
    "https://*.webflow.com",
  ],

  // Development helpers
  isDevelopment: Deno.env.get("NODE_ENV") === "development",
  isProduction: Deno.env.get("NODE_ENV") === "production",
};

// Validate required configuration in production
if (config.isProduction) {
  const required = [
    "WEBFLOW_API_TOKEN",
    "WEBFLOW_COLLECTION_ID",
    "WEBFLOW_SITE_ID",
  ];

  for (const key of required) {
    if (!config[key as keyof typeof config]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

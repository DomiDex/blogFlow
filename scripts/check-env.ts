import { config } from "@config/index.ts";
import { SERVICE_NAME, API_VERSION, WEBFLOW_API_BASE_URL } from "@config/constants.ts";

console.log(`🔍 Checking environment configuration for ${SERVICE_NAME} v${API_VERSION}...`);
console.log("");

// Check required variables
const required = [
  "WEBFLOW_API_TOKEN",
  "WEBFLOW_COLLECTION_ID",
  "WEBFLOW_SITE_ID",
] as const;

const missing = required.filter((key) => !config[key]);

if (missing.length > 0) {
  console.error("❌ Missing required environment variables:");
  missing.forEach((key) => console.error(`  - ${key}`));
  Deno.exit(1);
}

// Test Webflow API token format
if (!config.WEBFLOW_API_TOKEN.includes("Bearer ") && !config.WEBFLOW_API_TOKEN.startsWith("Bearer ")) {
  console.warn("⚠️  WEBFLOW_API_TOKEN should include 'Bearer ' prefix");
  console.warn("    Example: Bearer your-actual-token-here");
}

// Validate Webflow IDs format (basic check)
if (config.WEBFLOW_COLLECTION_ID.length < 10) {
  console.warn("⚠️  WEBFLOW_COLLECTION_ID seems too short. Please verify it's correct.");
}

if (config.WEBFLOW_SITE_ID.length < 10) {
  console.warn("⚠️  WEBFLOW_SITE_ID seems too short. Please verify it's correct.");
}

// Display configuration summary
console.log("✅ Environment configuration is valid!");
console.log("");
console.log("📋 Configuration Summary:");
console.log(`├─ 🌍 Environment: ${config.NODE_ENV}`);
console.log(`├─ 🔗 Port: ${config.PORT}`);
console.log(`├─ 📊 Log Level: ${config.LOG_LEVEL}`);
console.log(`├─ 🔒 Rate Limiting: ${config.RATE_LIMIT_MAX_REQUESTS} requests per ${config.RATE_LIMIT_WINDOW_MS}ms`);
console.log(`├─ 🌐 CORS Origins: ${config.CORS_ORIGINS.join(", ")}`);
console.log(`└─ 🔧 Webflow API: ${WEBFLOW_API_BASE_URL}`);

// Security check
if (config.NODE_ENV === "development") {
  console.log("");
  console.log("⚠️  Running in DEVELOPMENT mode");
  console.log("   - Detailed error messages enabled");
  console.log("   - CORS restrictions may be relaxed");
  console.log("   - Rate limiting may be adjusted");
}

if (config.NODE_ENV === "production" && !config.SENTRY_DSN) {
  console.log("");
  console.log("💡 Tip: Consider setting SENTRY_DSN for error monitoring in production");
}

// Test environment file permissions (optional)
try {
  const envFilePath = ".env";
  const fileInfo = await Deno.stat(envFilePath);
  
  if (fileInfo.isFile) {
    console.log("");
    console.log("📁 Found .env file");
    
    // Check if .env is in .gitignore
    try {
      const gitignore = await Deno.readTextFile(".gitignore");
      if (!gitignore.includes(".env")) {
        console.error("⚠️  WARNING: .env is not in .gitignore!");
        console.error("    Add '.env' to .gitignore to prevent committing secrets");
      }
    } catch {
      // .gitignore doesn't exist
      console.warn("⚠️  No .gitignore file found");
    }
  }
} catch {
  // .env file doesn't exist - this is fine in production
  if (config.NODE_ENV === "development") {
    console.log("");
    console.log("💡 No .env file found - using system environment variables");
  }
}

console.log("");
console.log("🚀 Ready to start the server!");

// Export for use in other scripts
export { config };
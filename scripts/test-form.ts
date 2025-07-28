#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Test script for Webflow form submission
 * 
 * This script simulates a Webflow form submission to test the middleware.
 * It sends a properly formatted request with Quill Delta content.
 */

import { load } from "@std/dotenv";

// Load environment variables (allow empty values for optional vars like SENTRY_DSN)
await load({ export: true, allowEmptyValues: true });

// Configuration
const API_URL = Deno.env.get("API_URL") || "http://localhost:8000";
const ENDPOINT = "/api/webflow-form";

// Sample Quill Delta content (rich text editor format)
const sampleQuillDelta = {
  ops: [
    { insert: "Welcome to My Blog Post", attributes: { header: 1 } },
    { insert: "\n\n" },
    { insert: "This is the first paragraph of my blog post. It contains " },
    { insert: "bold text", attributes: { bold: true } },
    { insert: " and " },
    { insert: "italic text", attributes: { italic: true } },
    { insert: ", as well as " },
    { insert: "a link", attributes: { link: "https://example.com" } },
    { insert: ".\n\n" },
    { insert: "Here's a list of features:\n" },
    { insert: "Rich text editing\n", attributes: { list: "bullet" } },
    { insert: "Multiple formatting options\n", attributes: { list: "bullet" } },
    { insert: "Link support\n", attributes: { list: "bullet" } },
    { insert: "\n" },
    { insert: "And here's a numbered list:\n" },
    { insert: "First item\n", attributes: { list: "ordered" } },
    { insert: "Second item\n", attributes: { list: "ordered" } },
    { insert: "Third item\n", attributes: { list: "ordered" } },
    { insert: "\n" },
    { insert: "This is the final paragraph with a " },
    { insert: "code snippet", attributes: { code: true } },
    { insert: " inline.\n" }
  ]
};

// Form data that simulates Webflow form submission
const formData = {
  authorName: "John Doe",
  articleTitle: "Getting Started with Deno and Webflow Integration",
  metaDescription: "Learn how to integrate Deno with Webflow CMS using our middleware solution for seamless content management.",
  articleContent: sampleQuillDelta // Send as object, not string
};

// Color codes for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logJson(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

async function testFormSubmission() {
  log("\n🚀 Testing Webflow Form Submission\n", colors.bright);
  
  log("📍 Target URL:", colors.cyan);
  log(`   ${API_URL}${ENDPOINT}\n`);
  
  log("📝 Form Data:", colors.cyan);
  logJson({
    ...formData,
    articleContent: "<<Quill Delta with " + sampleQuillDelta.ops.length + " operations>>"
  });
  
  try {
    log("\n⏳ Sending request...", colors.yellow);
    
    const startTime = performance.now();
    
    const response = await fetch(`${API_URL}${ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://test-site.webflow.io", // Simulate Webflow origin
      },
      body: JSON.stringify(formData)
    });
    
    const duration = Math.round(performance.now() - startTime);
    
    log(`\n📊 Response Status: ${response.status} ${response.statusText}`, 
        response.ok ? colors.green : colors.red);
    log(`⏱️  Response Time: ${duration}ms`);
    
    // Get response headers
    log("\n📋 Response Headers:", colors.cyan);
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    logJson(headers);
    
    // Get response body
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
      log("\n📦 Response Body:", colors.cyan);
      logJson(responseData);
    } catch {
      log("\n📦 Response Body (non-JSON):", colors.cyan);
      log(responseText);
    }
    
    // Check if successful
    if (response.ok && responseData?.success) {
      log("\n✅ Test PASSED!", colors.green);
      
      if (responseData.data) {
        log("\n🎯 Created Item Details:", colors.cyan);
        logJson({
          id: responseData.data.id,
          slug: responseData.data.slug,
          name: responseData.data.name,
          publishedOn: responseData.data["published-on"]
        });
      }
    } else {
      log("\n❌ Test FAILED!", colors.red);
      
      if (responseData?.error) {
        log("\n🚨 Error Details:", colors.red);
        logJson({
          error: responseData.error,
          code: responseData.code,
          details: responseData.details
        });
      }
    }
    
  } catch (error) {
    log("\n❌ Request Failed!", colors.red);
    log(`   ${error}`, colors.red);
    
    if (error instanceof Error && error.message.includes("Connection refused")) {
      log("\n💡 Make sure the server is running:", colors.yellow);
      log("   deno task dev");
    }
  }
}

// Additional test scenarios
async function testValidation() {
  log("\n\n🧪 Testing Validation Errors\n", colors.bright);
  
  const invalidData = {
    authorName: "", // Empty author
    articleTitle: "Test",
    metaDescription: "Test",
    articleContent: { ops: "invalid" } // Invalid Quill Delta (ops should be array)
  };
  
  try {
    const response = await fetch(`${API_URL}${ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://test-site.webflow.io",
      },
      body: JSON.stringify(invalidData)
    });
    
    const result = await response.json();
    
    log(`📊 Validation Response: ${response.status}`, colors.yellow);
    logJson(result);
    
  } catch (error) {
    log("❌ Validation test failed:", colors.red);
    log(`   ${error}`, colors.red);
  }
}

// Run tests
async function main() {
  // Check if server is configured
  if (!Deno.env.get("WEBFLOW_API_TOKEN")) {
    log("\n⚠️  Warning: WEBFLOW_API_TOKEN not set in .env file", colors.yellow);
    log("   The server will not be able to create items in Webflow CMS\n");
  }
  
  // Run main test
  await testFormSubmission();
  
  // Optionally run validation test
  const args = Deno.args;
  if (args.includes("--all") || args.includes("-a")) {
    await testValidation();
  }
  
  log("\n📝 To test with custom data, modify the formData object in this script", colors.cyan);
  log("   Location: scripts/test-form.ts\n");
}

if (import.meta.main) {
  main();
}
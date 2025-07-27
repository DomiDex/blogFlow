#!/usr/bin/env -S deno run --allow-net
/// <reference lib="deno.ns" />

/**
 * CORS Testing Script
 * Tests various CORS scenarios including preflight requests
 */

const BASE_URL = "http://localhost:8000";
const API_ENDPOINT = "/api/webflow-form";

// Color output helpers
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;

// Test cases
const tests = [
  {
    name: "Preflight request from Webflow origin",
    request: {
      method: "OPTIONS",
      headers: {
        "Origin": "https://example.webflow.io",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    },
    expectedHeaders: [
      "access-control-allow-origin",
      "access-control-allow-methods",
      "access-control-allow-headers",
      "access-control-max-age",
    ],
  },
  {
    name: "POST request with Webflow origin",
    request: {
      method: "POST",
      headers: {
        "Origin": "https://example.webflow.io",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "data" }),
    },
    expectedHeaders: [
      "access-control-allow-origin",
      "access-control-allow-credentials",
    ],
  },
  {
    name: "Request from unauthorized origin",
    request: {
      method: "POST",
      headers: {
        "Origin": "https://evil-site.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "data" }),
    },
    expectedHeaders: [],
    shouldFail: true,
  },
  {
    name: "Request with wildcard Webflow subdomain",
    request: {
      method: "OPTIONS",
      headers: {
        "Origin": "https://my-custom-site.webflow.io",
        "Access-Control-Request-Method": "POST",
      },
    },
    expectedHeaders: ["access-control-allow-origin"],
  },
  {
    name: "Request from localhost (development)",
    request: {
      method: "POST",
      headers: {
        "Origin": "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "data" }),
    },
    expectedHeaders: ["access-control-allow-origin"],
  },
  {
    name: "Request without origin (non-browser)",
    request: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "data" }),
    },
    expectedHeaders: [],
  },
];

// Run a single test
async function runTest(test: typeof tests[0]): Promise<boolean> {
  console.log(`\n${blue("Testing:")} ${test.name}`);
  
  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINT}`, test.request);
    
    console.log(`Status: ${response.status}`);
    console.log("Response headers:");
    
    // Check expected headers
    let passed = true;
    const headers = response.headers;
    
    // Log relevant CORS headers
    const corsHeaders = [
      "access-control-allow-origin",
      "access-control-allow-methods",
      "access-control-allow-headers",
      "access-control-allow-credentials",
      "access-control-max-age",
      "access-control-expose-headers",
    ];
    
    corsHeaders.forEach((header) => {
      const value = headers.get(header);
      if (value) {
        console.log(`  ${header}: ${value}`);
      }
    });
    
    // Check security headers
    console.log("\nSecurity headers:");
    const securityHeaders = [
      "x-content-type-options",
      "x-frame-options",
      "x-xss-protection",
      "content-security-policy",
      "referrer-policy",
    ];
    
    securityHeaders.forEach((header) => {
      const value = headers.get(header);
      if (value) {
        console.log(`  ${header}: ${value}`);
      }
    });
    
    // Verify expected headers
    if (test.expectedHeaders.length > 0) {
      test.expectedHeaders.forEach((header) => {
        if (!headers.has(header)) {
          console.log(red(`  Missing expected header: ${header}`));
          passed = false;
        }
      });
    }
    
    // Check if should fail
    if (test.shouldFail) {
      const origin = headers.get("access-control-allow-origin");
      if (origin && origin !== "null") {
        console.log(red("  Should have blocked this origin!"));
        passed = false;
      } else {
        console.log(green("  Correctly blocked unauthorized origin"));
      }
    }
    
    return passed;
  } catch (error) {
    console.error(red(`  Error: ${error.message}`));
    return false;
  }
}

// Main test runner
async function main() {
  console.log("🧪 CORS Testing Script");
  console.log("====================");
  
  // Check if server is running
  try {
    await fetch(`${BASE_URL}/health`);
  } catch {
    console.error(red("\n❌ Server is not running!"));
    console.log(yellow("Please start the server with: deno task dev"));
    Deno.exit(1);
  }
  
  let passed = 0;
  let failed = 0;
  
  // Run all tests
  for (const test of tests) {
    const result = await runTest(test);
    if (result) {
      passed++;
      console.log(green("✅ Passed"));
    } else {
      failed++;
      console.log(red("❌ Failed"));
    }
  }
  
  // Summary
  console.log("\n" + "=".repeat(40));
  console.log(`Total tests: ${tests.length}`);
  console.log(`${green("Passed:")} ${passed}`);
  console.log(`${red("Failed:")} ${failed}`);
  
  if (failed > 0) {
    Deno.exit(1);
  }
}

// Run tests
if (import.meta.main) {
  main();
}
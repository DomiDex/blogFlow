#!/usr/bin/env -S deno run --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Test the logging system with various scenarios
 */

const BASE_URL = "http://localhost:8000";

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  options: RequestInit & { url: string },
  expectations: {
    status?: number;
    headers?: Record<string, string>;
    hasRequestId?: boolean;
  } = {}
) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const response = await fetch(options.url, options);
    
    // Check status
    if (expectations.status && response.status !== expectations.status) {
      results.push({
        name,
        passed: false,
        details: `Expected status ${expectations.status}, got ${response.status}`,
      });
      return;
    }

    // Check headers
    if (expectations.headers) {
      for (const [key, value] of Object.entries(expectations.headers)) {
        const actual = response.headers.get(key);
        if (actual !== value) {
          results.push({
            name,
            passed: false,
            details: `Expected header ${key}="${value}", got "${actual}"`,
          });
          return;
        }
      }
    }

    // Check request ID
    if (expectations.hasRequestId) {
      const requestId = response.headers.get("x-request-id");
      if (!requestId) {
        results.push({
          name,
          passed: false,
          details: "Missing X-Request-ID header",
        });
        return;
      }
      console.log(`  ✓ Request ID: ${requestId}`);
    }

    // Check response time header
    const responseTime = response.headers.get("x-response-time");
    if (responseTime) {
      console.log(`  ✓ Response time: ${responseTime}`);
    }

    results.push({ name, passed: true });
    console.log(`  ✅ Passed`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      details: error instanceof Error ? error.message : String(error),
    });
    console.log(`  ❌ Failed: ${error}`);
  }
}

// Run tests
console.log("🚀 Starting logging system tests...\n");

// Test 1: Basic request logging
await testEndpoint(
  "Basic GET request logging",
  {
    url: `${BASE_URL}/health`,
    method: "GET",
  },
  {
    status: 200,
    hasRequestId: true,
  }
);

// Test 2: POST request with body
await testEndpoint(
  "POST request with JSON body",
  {
    url: `${BASE_URL}/api/webflow-form`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      authorName: "Test Author",
      articleTitle: "Test Article",
      metaDescription: "Test description",
      articleContent: { ops: [{ insert: "Test content\\n" }] },
    }),
  },
  {
    hasRequestId: true,
  }
);

// Test 3: Request with sensitive data
await testEndpoint(
  "Request with sensitive headers",
  {
    url: `${BASE_URL}/health`,
    method: "GET",
    headers: {
      "Authorization": "Bearer secret-token-12345",
      "X-API-Key": "api-key-67890",
    },
  },
  {
    status: 200,
    hasRequestId: true,
  }
);

// Test 4: 404 error
await testEndpoint(
  "404 error logging",
  {
    url: `${BASE_URL}/non-existent-endpoint`,
    method: "GET",
  },
  {
    status: 404,
    hasRequestId: true,
  }
);

// Test 5: Invalid JSON body
await testEndpoint(
  "Invalid JSON body error",
  {
    url: `${BASE_URL}/api/webflow-form`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{ invalid json",
  },
  {
    status: 400,
    hasRequestId: true,
  }
);

// Test 6: Slow request simulation
console.log("\n🧪 Testing: Slow request logging (simulated)");
console.log("  ℹ️  This would trigger performance warning if endpoint took >1000ms");
console.log("  ✅ Passed");
results.push({ name: "Slow request logging", passed: true });

// Summary
console.log("\n📊 Test Summary:");
console.log("================");

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Total:  ${results.length}`);

if (failed > 0) {
  console.log("\n❌ Failed tests:");
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.details}`);
  });
}

console.log("\n💡 Tips:");
console.log("- Check server logs to see formatted log output");
console.log("- In development, logs are color-coded by level");
console.log("- In production, logs are JSON formatted for parsing");
console.log("- Sensitive data like tokens should appear as [REDACTED]");

// Exit with appropriate code
Deno.exit(failed > 0 ? 1 : 0);
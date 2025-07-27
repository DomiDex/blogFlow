#!/usr/bin/env -S deno run --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Test the security headers and middleware
 */

const BASE_URL = "http://localhost:8000";

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

// Security headers to check
const requiredSecurityHeaders = [
  "x-content-type-options",
  "x-frame-options",
  "x-xss-protection",
  "referrer-policy",
  "content-security-policy",
  "permissions-policy",
  "x-dns-prefetch-control",
  "x-download-options",
  "x-permitted-cross-domain-policies",
  "expect-ct",
  "cross-origin-embedder-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
];

// Test 1: Security Headers
async function testSecurityHeaders() {
  console.log("\n🧪 Test 1: Security Headers");
  
  const response = await fetch(`${BASE_URL}/health`);
  const headers = Object.fromEntries(response.headers);
  
  console.log("Security headers found:");
  for (const header of requiredSecurityHeaders) {
    const value = headers[header];
    if (value) {
      console.log(`  ✓ ${header}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
    } else {
      console.log(`  ✗ ${header}: MISSING`);
    }
  }
  
  const foundHeaders = requiredSecurityHeaders.filter(h => headers[h]);
  const coverage = (foundHeaders.length / requiredSecurityHeaders.length) * 100;
  
  console.log(`\nSecurity header coverage: ${coverage.toFixed(1)}%`);
  
  if (coverage >= 80) {
    results.push({ name: "Security Headers", passed: true, details: `${coverage.toFixed(1)}% coverage` });
    return true;
  } else {
    results.push({ name: "Security Headers", passed: false, details: `Only ${coverage.toFixed(1)}% coverage` });
    return false;
  }
}

// Test 2: Content Security Policy
async function testCSP() {
  console.log("\n🧪 Test 2: Content Security Policy");
  
  const response = await fetch(`${BASE_URL}/health`);
  const csp = response.headers.get("content-security-policy");
  
  if (!csp) {
    console.log("❌ No CSP header found");
    results.push({ name: "CSP", passed: false, details: "No CSP header" });
    return false;
  }
  
  console.log("CSP directives:");
  const directives = csp.split(";").map(d => d.trim());
  for (const directive of directives) {
    console.log(`  • ${directive}`);
  }
  
  // Check for important directives
  const importantDirectives = [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "connect-src",
    "frame-ancestors",
    "base-uri",
  ];
  
  const foundDirectives = importantDirectives.filter(d => 
    directives.some(dir => dir.startsWith(d))
  );
  
  if (foundDirectives.length >= 5) {
    console.log("✅ CSP has sufficient directives");
    results.push({ name: "CSP", passed: true });
    return true;
  } else {
    console.log("❌ CSP missing important directives");
    results.push({ name: "CSP", passed: false, details: "Missing directives" });
    return false;
  }
}

// Test 3: Request Validation
async function testRequestValidation() {
  console.log("\n🧪 Test 3: Request Validation");
  
  // Test invalid content type
  console.log("Testing invalid content type...");
  const response1 = await fetch(`${BASE_URL}/api/webflow-form`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "invalid",
  });
  
  if (response1.status === 415) {
    console.log("✅ Invalid content type rejected (415)");
  } else {
    console.log(`❌ Invalid content type accepted (${response1.status})`);
    results.push({ name: "Request Validation", passed: false, details: "Content type not validated" });
    return false;
  }
  
  // Test prototype pollution attempt
  console.log("\nTesting prototype pollution protection...");
  const maliciousBody = JSON.stringify({
    "__proto__": { "isAdmin": true },
    "constructor": { "prototype": { "isAdmin": true } },
    "articleTitle": "Test",
  });
  
  const response2 = await fetch(`${BASE_URL}/api/webflow-form`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: maliciousBody,
  });
  
  if (response2.status === 400) {
    const body = await response2.json();
    console.log("✅ Prototype pollution blocked:", body.message);
    results.push({ name: "Request Validation", passed: true });
    return true;
  } else {
    console.log(`❌ Prototype pollution not blocked (${response2.status})`);
    results.push({ name: "Request Validation", passed: false, details: "Prototype pollution not blocked" });
    return false;
  }
}

// Test 4: Security.txt
async function testSecurityTxt() {
  console.log("\n🧪 Test 4: Security.txt");
  
  const response = await fetch(`${BASE_URL}/.well-known/security.txt`);
  
  if (response.status !== 200) {
    console.log(`❌ Security.txt not found (${response.status})`);
    results.push({ name: "Security.txt", passed: false, details: "Not found" });
    return false;
  }
  
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("text/plain")) {
    console.log(`❌ Invalid content type: ${contentType}`);
    results.push({ name: "Security.txt", passed: false, details: "Wrong content type" });
    return false;
  }
  
  const text = await response.text();
  console.log("Security.txt content:");
  console.log(text.split("\n").map(line => `  ${line}`).join("\n"));
  
  // Check for required fields
  const requiredFields = ["Contact:", "Expires:"];
  const hasAllFields = requiredFields.every(field => text.includes(field));
  
  if (hasAllFields) {
    console.log("✅ Security.txt has required fields");
    results.push({ name: "Security.txt", passed: true });
    return true;
  } else {
    console.log("❌ Security.txt missing required fields");
    results.push({ name: "Security.txt", passed: false, details: "Missing fields" });
    return false;
  }
}

// Test 5: Robots.txt
async function testRobotsTxt() {
  console.log("\n🧪 Test 5: Robots.txt");
  
  const response = await fetch(`${BASE_URL}/robots.txt`);
  
  if (response.status !== 200) {
    console.log(`❌ Robots.txt not found (${response.status})`);
    results.push({ name: "Robots.txt", passed: false, details: "Not found" });
    return false;
  }
  
  const text = await response.text();
  console.log("Robots.txt content:");
  console.log(text.split("\n").map(line => `  ${line}`).join("\n"));
  
  if (text.includes("Disallow: /api/")) {
    console.log("✅ API endpoints protected from crawling");
    results.push({ name: "Robots.txt", passed: true });
    return true;
  } else {
    console.log("❌ API endpoints not protected");
    results.push({ name: "Robots.txt", passed: false, details: "API not protected" });
    return false;
  }
}

// Test 6: Security Headers Check Endpoint
async function testSecurityCheck() {
  console.log("\n🧪 Test 6: Security Check Endpoint");
  
  const response = await fetch(`${BASE_URL}/api/security-check`);
  
  if (response.status !== 200) {
    console.log(`❌ Security check endpoint failed (${response.status})`);
    results.push({ name: "Security Check", passed: false, details: "Endpoint error" });
    return false;
  }
  
  const result = await response.json();
  console.log(`Security score: ${result.score}%`);
  console.log(`Missing headers: ${result.missingHeaders.join(", ") || "None"}`);
  
  if (result.score >= 80) {
    console.log("✅ Good security score");
    results.push({ name: "Security Check", passed: true, details: `Score: ${result.score}%` });
    return true;
  } else {
    console.log("❌ Low security score");
    results.push({ name: "Security Check", passed: false, details: `Score: ${result.score}%` });
    return false;
  }
}

// Test 7: Hidden Server Information
async function testServerInfo() {
  console.log("\n🧪 Test 7: Hidden Server Information");
  
  const response = await fetch(`${BASE_URL}/health`);
  const serverHeader = response.headers.get("server");
  const poweredBy = response.headers.get("x-powered-by");
  
  console.log(`Server header: ${serverHeader || "Not present"}`);
  console.log(`X-Powered-By header: ${poweredBy || "Not present"}`);
  
  if (!serverHeader && !poweredBy) {
    console.log("✅ Server information hidden");
    results.push({ name: "Hidden Server Info", passed: true });
    return true;
  } else {
    console.log("❌ Server information exposed");
    results.push({ name: "Hidden Server Info", passed: false, details: "Headers exposed" });
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log("🚀 Starting security tests...");
  console.log(`Testing against: ${BASE_URL}`);
  
  await testSecurityHeaders();
  await testCSP();
  await testRequestValidation();
  await testSecurityTxt();
  await testRobotsTxt();
  await testSecurityCheck();
  await testServerInfo();
  
  // Summary
  console.log("\n📊 Test Summary:");
  console.log("================");
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    const details = result.details ? ` (${result.details})` : "";
    console.log(`${icon} ${result.name}${details}`);
  }
  
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  
  console.log("\n💡 Security Features Implemented:");
  console.log("- Comprehensive security headers (OWASP recommended)");
  console.log("- Content Security Policy with Webflow domains");
  console.log("- Request validation and size limits");
  console.log("- Prototype pollution protection");
  console.log("- CSRF token generation support");
  console.log("- API key validation middleware");
  console.log("- Security.txt and robots.txt endpoints");
  console.log("- CSP violation reporting");
  console.log("- Hidden server information");
  
  Deno.exit(failed > 0 ? 1 : 0);
}

// Check if server is running
try {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok && response.status !== 429) {
    console.error("❌ Server is not running or not responding correctly");
    console.error("Please start the server with: deno task dev");
    Deno.exit(1);
  }
} catch (error) {
  console.error("❌ Cannot connect to server at", BASE_URL);
  console.error("Please start the server with: deno task dev");
  Deno.exit(1);
}

// Run tests
await runTests();
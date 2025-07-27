#!/usr/bin/env -S deno run --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Test the form validation endpoint manually
 */

// Test valid form submission
async function testValidFormSubmission() {
  console.log("🧪 Testing valid form submission...");
  
  const validData = {
    authorName: "John Doe",
    articleTitle: "How to Build Amazing Web Applications with Modern Tools",
    metaDescription: "Learn the fundamentals of building scalable web applications with modern frameworks, including React, Vue, and Angular. This comprehensive guide covers best practices for performance optimization and user experience.",
    articleContent: {
      ops: [
        { insert: "Welcome to this comprehensive guide on building amazing web applications. " },
        { insert: "In this article, we'll explore the latest technologies and best practices for creating scalable, performant, and user-friendly web applications.\n\n" },
        { insert: "Modern Web Development Fundamentals", attributes: { header: 1 } },
        { insert: "\n\n" },
        { insert: "Building great web applications requires understanding several key concepts:" },
        { insert: "\n\n" },
        { insert: "Frontend frameworks like React and Vue", attributes: { list: "bullet" } },
        { insert: "\n" },
        { insert: "Backend APIs and microservices", attributes: { list: "bullet" } },
        { insert: "\n" },
        { insert: "Database design and optimization", attributes: { list: "bullet" } },
        { insert: "\n" },
        { insert: "Performance monitoring and optimization", attributes: { list: "bullet" } },
        { insert: "\n\n" },
        { insert: "For more information, check out ", attributes: {} },
        { insert: "MDN Web Docs", attributes: { link: "https://developer.mozilla.org" } },
        { insert: " for comprehensive web development resources." },
        { insert: "\n\n" },
        { insert: "Conclusion", attributes: { header: 2 } },
        { insert: "\n\n" },
        { insert: "By following these best practices and staying up-to-date with modern development tools, you'll be well-equipped to build amazing web applications that users love." }
      ]
    },
    publishNow: true,
    slug: "how-to-build-amazing-web-applications",
    categories: ["Technology", "Web Development"],
    tags: ["javascript", "react", "vue", "web-dev", "tutorial"]
  };

  try {
    const response = await fetch("http://localhost:8000/api/webflow-form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://www.jabali-network.co.uk"
      },
      body: JSON.stringify(validData)
    });

    const result = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log("Response:", JSON.stringify(result, null, 2));
    
    return response.status === 200 && result.success;
  } catch (error) {
    console.error("Error testing valid form:", error);
    return false;
  }
}

// Test invalid form submission
async function testInvalidFormSubmission() {
  console.log("\n🧪 Testing invalid form submission...");
  
  const invalidData = {
    authorName: "J", // Too short
    articleTitle: "Short", // Too short
    metaDescription: "Too short", // Too short for SEO
    articleContent: {
      ops: [
        { insert: "Too short content." } // Not enough words
      ]
    }
  };

  try {
    const response = await fetch("http://localhost:8000/api/webflow-form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://www.jabali-network.co.uk"
      },
      body: JSON.stringify(invalidData)
    });

    const result = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log("Response:", JSON.stringify(result, null, 2));
    
    return response.status === 400 && result.error === "Validation failed";
  } catch (error) {
    console.error("Error testing invalid form:", error);
    return false;
  }
}

// Test draft saving
async function testDraftSaving() {
  console.log("\n🧪 Testing draft saving...");
  
  const draftData = {
    articleTitle: "My Draft Article",
    authorName: "Jane Doe"
    // Missing other fields - should be OK for draft
  };

  try {
    const response = await fetch("http://localhost:8000/api/webflow-form/draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://www.jabali-network.co.uk"
      },
      body: JSON.stringify(draftData)
    });

    const result = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log("Response:", JSON.stringify(result, null, 2));
    
    return response.status === 200 && result.success;
  } catch (error) {
    console.error("Error testing draft:", error);
    return false;
  }
}

// Test CORS
async function testCORS() {
  console.log("\n🧪 Testing CORS...");
  
  try {
    const response = await fetch("http://localhost:8000/api/webflow-form", {
      method: "OPTIONS",
      headers: {
        "Origin": "https://www.jabali-network.co.uk",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
      }
    });

    console.log(`CORS Status: ${response.status}`);
    console.log("CORS Headers:");
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().startsWith('access-control')) {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    return response.status === 204;
  } catch (error) {
    console.error("Error testing CORS:", error);
    return false;
  }
}

// Main test runner
async function runEndpointTests() {
  console.log("🚀 Testing Form Validation Endpoints\n");
  console.log("Make sure the server is running at http://localhost:8000\n");

  const tests = [
    { name: "Valid form submission", fn: testValidFormSubmission },
    { name: "Invalid form submission", fn: testInvalidFormSubmission },
    { name: "Draft saving", fn: testDraftSaving },
    { name: "CORS preflight", fn: testCORS }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n📊 Endpoint Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log("🎉 All endpoint tests passed!");
    console.log("\n🎯 You can now manually test the form validation!");
    console.log("\n📝 Example curl command:");
    console.log(`curl -X POST http://localhost:8000/api/webflow-form \\
  -H "Content-Type: application/json" \\
  -H "Origin: https://www.jabali-network.co.uk" \\
  -d '{
    "authorName": "Your Name",
    "articleTitle": "Test Article Title Here",
    "metaDescription": "This is a test meta description that meets the minimum length requirement for SEO validation purposes.",
    "articleContent": {
      "ops": [
        {"insert": "This is test content with enough words to pass validation requirements.\\n"}
      ]
    },
    "publishNow": true
  }'`);
  } else {
    console.log("❌ Some tests failed. Check server logs for details.");
  }
  
  return passed === total;
}

// Run tests
const success = await runEndpointTests();
Deno.exit(success ? 0 : 1);
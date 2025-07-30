#!/usr/bin/env -S deno run --allow-net

// Test CORS with different origins
const origins = [
  "https://www.jabali-network.co.uk",
  "https://jabali-network.co.uk",
  "https://preview.webflow.com",
  "https://webflow.com",
  "https://test.webflow.io",
];

const endpoint = "https://dominiquede-blogflow-62.deno.dev/api/webflow-form";

console.log("Testing CORS for endpoint:", endpoint);
console.log("=" .repeat(60));

for (const origin of origins) {
  console.log(`\nTesting origin: ${origin}`);
  
  try {
    // Test OPTIONS request (preflight)
    const optionsResponse = await fetch(endpoint, {
      method: "OPTIONS",
      headers: {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });
    
    console.log(`OPTIONS Status: ${optionsResponse.status}`);
    console.log(`Allow-Origin: ${optionsResponse.headers.get("Access-Control-Allow-Origin")}`);
    console.log(`Allow-Methods: ${optionsResponse.headers.get("Access-Control-Allow-Methods")}`);
    
    // Test POST request
    const postResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Origin": origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        articleTitle: "Test",
        authorName: "Test Author",
        authorEmail: "test@example.com",
        articleContent: { ops: [{ insert: "Test content for CORS validation" }] },
      }),
    });
    
    console.log(`POST Status: ${postResponse.status}`);
    console.log(`POST Allow-Origin: ${postResponse.headers.get("Access-Control-Allow-Origin")}`);
    
  } catch (error) {
    console.error(`Error testing ${origin}:`, error.message);
  }
}
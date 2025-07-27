#!/usr/bin/env -S deno run --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Test Webflow API connection and basic operations
 */

import { createWebflowService } from "@services/webflowService.ts";
import { logger } from "@utils/logger.ts";

async function testWebflowConnection() {
  console.log("🚀 Testing Webflow API Connection...\n");

  try {
    // Create service instance
    const webflowService = createWebflowService();
    console.log("✅ Webflow service created successfully");

    // Test 1: Connection test
    console.log("\n📡 Test 1: API Connection");
    const isConnected = await webflowService.testConnection();
    
    if (isConnected) {
      console.log("✅ Connection successful");
    } else {
      console.log("❌ Connection failed");
      return false;
    }

    // Test 2: Get collection items (first 5)
    console.log("\n📚 Test 2: Get Collection Items");
    try {
      const items = await webflowService.getCollectionItems({ limit: 5 });
      console.log(`✅ Retrieved ${items.items?.length || 0} items`);
      console.log(`📊 Total items in collection: ${items.pagination?.total || 0}`);
      
      if (items.items && items.items.length > 0) {
        const firstItem = items.items[0];
        console.log("📝 Sample item:");
        console.log(`   ID: ${firstItem.id}`);
        console.log(`   Name: ${firstItem.fieldData.name || 'N/A'}`);
        console.log(`   Slug: ${firstItem.fieldData.slug || 'N/A'}`);
        console.log(`   Draft: ${firstItem.isDraft}`);
      }
    } catch (error) {
      console.log(`❌ Failed to retrieve items: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 3: Check slug availability
    console.log("\n🔍 Test 3: Slug Check");
    try {
      const testSlug = "test-slug-" + Date.now();
      const slugResult = await webflowService.checkSlugExists(testSlug);
      console.log(`✅ Slug check for "${testSlug}": ${slugResult.exists ? 'EXISTS' : 'AVAILABLE'}`);
    } catch (error) {
      console.log(`❌ Slug check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log("\n🎉 All tests completed!");
    return true;

  } catch (error) {
    console.error("❌ Webflow test failed:", error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && 'status' in error) {
      console.error(`   HTTP Status: ${(error as any).status}`);
    }
    
    return false;
  }
}

// Check environment variables first
function checkEnvironment(): boolean {
  console.log("🔧 Checking environment variables...");
  
  const requiredVars = [
    "WEBFLOW_API_TOKEN",
    "WEBFLOW_SITE_ID", 
    "WEBFLOW_COLLECTION_ID"
  ];

  let allPresent = true;
  
  for (const varName of requiredVars) {
    const value = Deno.env.get(varName);
    if (!value) {
      console.log(`❌ Missing: ${varName}`);
      allPresent = false;
    } else {
      // Mask the API token for security
      const displayValue = varName === "WEBFLOW_API_TOKEN" 
        ? `${value.substring(0, 8)}...` 
        : value;
      console.log(`✅ ${varName}: ${displayValue}`);
    }
  }

  if (!allPresent) {
    console.log("\n❌ Please set all required environment variables in .env file");
    console.log("Required variables:");
    console.log("- WEBFLOW_API_TOKEN: Your Webflow API token");
    console.log("- WEBFLOW_SITE_ID: Your Webflow site ID");
    console.log("- WEBFLOW_COLLECTION_ID: Your target collection ID");
  }

  return allPresent;
}

// Main execution
if (!checkEnvironment()) {
  Deno.exit(1);
}

const success = await testWebflowConnection();
Deno.exit(success ? 0 : 1);
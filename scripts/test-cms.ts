#!/usr/bin/env -S deno run --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Test CMS operations
 */

import { CMSService } from "@services/cmsService.ts";
import type { FormData } from "@types/form.ts";

async function testCMSOperations() {
  console.log("🚀 Testing CMS Operations...\n");

  try {
    // Create CMS service
    const cmsService = new CMSService();
    console.log("✅ CMS service created successfully");

    // Test 1: Basic CMS test
    console.log("\n🔧 Test 1: CMS Operations Test");
    const basicTest = await cmsService.testCMSOperations();
    
    if (basicTest) {
      console.log("✅ Basic CMS operations working");
    } else {
      console.log("❌ Basic CMS operations failed");
      return false;
    }

    // Test 2: Get existing items
    console.log("\n📚 Test 2: Get CMS Items");
    try {
      const items = await cmsService.getCMSItems(3);
      console.log(`✅ Retrieved ${items.items?.length || 0} items`);
      console.log(`📊 Total items: ${items.pagination?.total || 0}`);
      
      if (items.items && items.items.length > 0) {
        const item = items.items[0];
        console.log("📝 Sample item:");
        console.log(`   ID: ${item.id}`);
        console.log(`   Title: ${item.fieldData.name || 'N/A'}`);
        console.log(`   Slug: ${item.fieldData.slug || 'N/A'}`);
        console.log(`   Author: ${item.fieldData["author-name"] || 'N/A'}`);
        console.log(`   Draft: ${item.isDraft}`);
      }
    } catch (error) {
      console.log(`❌ Failed to get items: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 3: Slug availability check
    console.log("\n🔍 Test 3: Slug Availability");
    try {
      const testSlug = "test-slug-availability-" + Date.now();
      const availability = await cmsService.checkSlugAvailability(testSlug);
      console.log(`✅ Slug "${testSlug}" is ${availability.available ? 'AVAILABLE' : 'TAKEN'}`);

      // Check an existing slug if we have items
      const items = await cmsService.getCMSItems(1);
      if (items.items && items.items.length > 0) {
        const existingSlug = items.items[0].fieldData.slug;
        if (existingSlug) {
          const existingCheck = await cmsService.checkSlugAvailability(existingSlug);
          console.log(`✅ Existing slug "${existingSlug}" is ${existingCheck.available ? 'AVAILABLE' : 'TAKEN'}`);
        }
      }
    } catch (error) {
      console.log(`❌ Slug check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 4: Create draft item (if we have create permissions)
    console.log("\n📝 Test 4: Create Test Draft Item");
    try {
      const testFormData: FormData = {
        articleTitle: "Test Article " + Date.now(),
        authorName: "Test Author",
        metaDescription: "This is a test article created by the CMS service test",
        articleContent: "<p>This is a test article content. It contains some <strong>bold text</strong> and <em>italic text</em>.</p>",
        slug: "test-article-" + Date.now(),
        readingTime: 2,
        introText: "This is a test article created by the CMS service test"
      };

      console.log(`   Creating draft item: "${testFormData.articleTitle}"`);
      const createResult = await cmsService.createCMSItem(testFormData, true);
      
      if (createResult.success && createResult.item) {
        console.log("✅ Draft item created successfully");
        console.log(`   Item ID: ${createResult.item.id}`);
        console.log(`   Slug: ${createResult.slug}`);
        console.log(`   Draft: ${createResult.item.isDraft}`);
        
        // Test 5: Retrieve the created item
        console.log("\n📖 Test 5: Retrieve Created Item");
        try {
          const retrievedItem = await cmsService.getCMSItem(createResult.item.id);
          console.log("✅ Item retrieved successfully");
          console.log(`   Title: ${retrievedItem.fieldData.name}`);
          console.log(`   Author: ${retrievedItem.fieldData["author-name"]}`);
        } catch (error) {
          console.log(`❌ Failed to retrieve item: ${error instanceof Error ? error.message : String(error)}`);
        }
        
      } else {
        console.log(`❌ Failed to create draft: ${createResult.error}`);
      }
    } catch (error) {
      console.log(`❌ Create test failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log("   Note: This might be expected if you don't have cms:write permissions");
    }

    console.log("\n🎉 CMS tests completed!");
    return true;

  } catch (error) {
    console.error("❌ CMS test failed:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the test
const success = await testCMSOperations();
Deno.exit(success ? 0 : 1);
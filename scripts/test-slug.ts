#!/usr/bin/env -S deno run --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Test slug generation and validation functionality
 */

import { SlugService } from "../src/services/slugService.ts";
import { createWebflowService } from "../src/services/webflowService.ts";

async function testSlugService() {
  console.log("🚀 Testing Slug Service...\n");

  try {
    // Create services
    const webflowService = createWebflowService();
    const slugService = new SlugService(webflowService);
    console.log("✅ Slug service created successfully");

    // Test 1: Basic slug generation
    console.log("\n📝 Test 1: Basic Slug Generation");
    
    const testTitles = [
      "How to Build Amazing Web Applications",
      "The Ultimate Guide to Modern JavaScript",
      "10 Tips for Better SEO in 2024",
      "React vs Vue.js: A Comprehensive Comparison",
      "Building APIs with Node.js and Express",
    ];

    for (const title of testTitles) {
      try {
        const result = await slugService.generateUniqueSlug(title);
        if (result.isValid && result.isUnique) {
          console.log(`✅ "${title}" → "${result.finalSlug}"`);
        } else {
          console.log(`❌ "${title}" → Failed: ${result.errors?.join(", ")}`);
        }
      } catch (error) {
        console.log(`❌ "${title}" → Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Test 2: Edge cases and special characters
    console.log("\n🧪 Test 2: Edge Cases and Special Characters");
    
    const edgeCases = [
      "Hello, World! How Are You?",
      "Ñoño & Special Characters: Testing 123",
      "Multiple    Spaces   and---Hyphens",
      "numbers123and456mixed789content",
      "Very Long Title That Exceeds The Maximum Length Limit For SEO Purposes And Should Be Truncated Properly",
      "",
      "admin", // Reserved word
      "123456", // Only numbers
    ];

    for (const title of edgeCases) {
      try {
        const result = await slugService.generateUniqueSlug(title);
        console.log(`📝 "${title || '(empty)'}" → "${result.finalSlug || 'FAILED'}" (Valid: ${result.isValid}, Unique: ${result.isUnique})`);
        if (result.errors) {
          console.log(`   Errors: ${result.errors.join(", ")}`);
        }
      } catch (error) {
        console.log(`❌ "${title}" → Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Test 3: Uniqueness handling
    console.log("\n🔄 Test 3: Uniqueness Handling");
    
    const duplicateTitle = "Test Article";
    const results: string[] = [];
    
    // Generate multiple slugs from the same title
    for (let i = 0; i < 5; i++) {
      try {
        const result = await slugService.generateUniqueSlug(duplicateTitle);
        if (result.finalSlug) {
          results.push(result.finalSlug);
          console.log(`✅ Attempt ${i + 1}: "${result.finalSlug}"`);
        } else {
          console.log(`❌ Attempt ${i + 1}: Failed`);
        }
      } catch (error) {
        console.log(`❌ Attempt ${i + 1}: Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Check for duplicates in results
    const uniqueResults = new Set(results);
    if (uniqueResults.size === results.length) {
      console.log("✅ All generated slugs are unique");
    } else {
      console.log("❌ Some duplicate slugs were generated");
    }

    // Test 4: Slug validation
    console.log("\n✅ Test 4: Slug Validation");
    
    const testSlugs = [
      "valid-slug",
      "also-valid-123",
      "invalid--double-hyphen",
      "-starts-with-hyphen",
      "ends-with-hyphen-",
      "UPPERCASE-NOT-ALLOWED",
      "special@characters!",
      "admin", // Reserved
      "",
    ];

    for (const slug of testSlugs) {
      try {
        const result = await slugService.validateSlug(slug);
        const status = result.isValid && result.isUnique ? "✅" : "❌";
        console.log(`${status} "${slug || '(empty)'}" → Valid: ${result.isValid}, Unique: ${result.isUnique}`);
        if (result.errors) {
          console.log(`   Errors: ${result.errors.join(", ")}`);
        }
        if (result.suggestions) {
          console.log(`   Suggestions: ${result.suggestions.join(", ")}`);
        }
      } catch (error) {
        console.log(`❌ "${slug}" → Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Test 5: Cache statistics
    console.log("\n📊 Test 5: Cache Statistics");
    const cacheStats = slugService.getCacheStats();
    console.log(`Cache size: ${cacheStats.size}/${cacheStats.maxSize}`);

    // Test 6: Performance test
    console.log("\n⚡ Test 6: Performance Test");
    const startTime = performance.now();
    
    const performancePromises = [];
    for (let i = 0; i < 10; i++) {
      performancePromises.push(
        slugService.generateUniqueSlug(`Performance Test Article ${i}`)
      );
    }
    
    const performanceResults = await Promise.all(performancePromises);
    const endTime = performance.now();
    
    const successCount = performanceResults.filter(r => r.isValid && r.isUnique).length;
    console.log(`✅ Generated ${successCount}/10 unique slugs in ${(endTime - startTime).toFixed(2)}ms`);

    console.log("\n🎉 Slug service tests completed!");
    return true;

  } catch (error) {
    console.error("❌ Slug service test failed:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the test
const success = await testSlugService();
Deno.exit(success ? 0 : 1);
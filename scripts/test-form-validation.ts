#!/usr/bin/env -S deno run --allow-net --allow-env
/// <reference lib="deno.ns" />

/**
 * Test form validation functionality
 */

import {
  validateFormData,
  validateUpdateFormData,
  validateDraftFormData,
  validateContent,
  extractTextFromDelta,
  type FormData,
  type QuillDelta
} from "../src/utils/validation.ts";

async function testFormValidation() {
  console.log("🚀 Testing Form Validation...\n");

  let passedTests = 0;
  let totalTests = 0;

  async function runTest(name: string, testFn: () => boolean | Promise<boolean>) {
    totalTests++;
    try {
      const result = await testFn();
      if (result) {
        console.log(`✅ ${name}`);
        passedTests++;
      } else {
        console.log(`❌ ${name}`);
      }
    } catch (error) {
      console.log(`❌ ${name} - Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Test 1: Valid form data
  await runTest("Valid complete form data", () => {
    const validData = {
      authorName: "John Doe",
      articleTitle: "How to Build Amazing Web Applications",
      metaDescription: "Learn the fundamentals of building scalable web applications with modern frameworks and best practices for performance optimization.",
      articleContent: {
        ops: [
          { insert: "This is the introduction to my article about web development.\n" },
          { insert: "Here's the main content with some ", attributes: { bold: true } },
          { insert: "bold text", attributes: { bold: true } },
          { insert: " and regular text.\n" },
          { insert: "And here's a link to ", attributes: {} },
          { insert: "Google", attributes: { link: "https://google.com" } },
          { insert: ".\n" }
        ]
      },
      publishNow: true,
      slug: "how-to-build-amazing-web-applications"
    };

    const result = validateFormData(validData);
    return result.success && result.data?.authorName === "John Doe";
  });

  // Test 2: Invalid author name
  await runTest("Invalid author name (too short)", () => {
    const invalidData = {
      authorName: "J", // Too short
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here with enough words to meet requirements.\n" }]
      }
    };

    const result = validateFormData(invalidData);
    return !result.success && 
           result.errors?.some(e => e.field === "authorName" && e.message.includes("at least 2 characters"));
  });

  // Test 3: Invalid article title
  await runTest("Invalid article title (too short)", () => {
    const invalidData = {
      authorName: "John Doe",
      articleTitle: "Short", // Too short
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here.\n" }]
      }
    };

    const result = validateFormData(invalidData);
    return !result.success && 
           result.errors?.some(e => e.field === "articleTitle" && e.message.includes("at least 10 characters"));
  });

  // Test 4: Invalid meta description (too short)
  await runTest("Invalid meta description (too short)", () => {
    const invalidData = {
      authorName: "John Doe",
      articleTitle: "Valid Article Title Here",
      metaDescription: "Too short", // Too short for SEO
      articleContent: {
        ops: [{ insert: "Valid content here.\n" }]
      }
    };

    const result = validateFormData(invalidData);
    return !result.success && 
           result.errors?.some(e => e.field === "metaDescription" && e.message.includes("at least 50 characters"));
  });

  // Test 5: Empty content
  await runTest("Empty article content", () => {
    const invalidData = {
      authorName: "John Doe",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [] // Empty content
      }
    };

    const result = validateFormData(invalidData);
    return !result.success && 
           result.errors?.some(e => e.field.includes("articleContent"));
  });

  // Test 6: Content with only formatting (no text)
  await runTest("Content with only formatting operations", () => {
    const invalidData = {
      authorName: "John Doe",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [
          { retain: 5 }, // Only formatting operations
          { delete: 3 }
        ]
      }
    };

    const result = validateFormData(invalidData);
    return !result.success && 
           result.errors?.some(e => e.message.includes("actual text"));
  });

  // Test 7: Invalid URL in content
  await runTest("Invalid URL in content links", () => {
    const invalidData = {
      authorName: "John Doe",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [
          { insert: "Here's some content with enough words to meet minimum requirements and " },
          { insert: "invalid link", attributes: { link: "not-a-valid-url" } },
          { insert: " and more content to reach the word count requirement.\n" }
        ]
      }
    };

    const contentValidation = validateContent(invalidData.articleContent, { minWords: 10 });
    
    
    return !contentValidation.success &&
           contentValidation.errors?.some(e => e.message.includes("valid URL"));
  });

  // Test 8: Valid email validation
  await runTest("Valid email format", () => {
    const validData = {
      authorName: "John Doe",
      authorEmail: "john.doe@example.com",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here with enough words to meet requirements.\n" }]
      }
    };

    const result = validateFormData(validData);
    return result.success;
  });

  // Test 9: Invalid email format
  await runTest("Invalid email format", () => {
    const invalidData = {
      authorName: "John Doe",
      authorEmail: "not-an-email",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here.\n" }]
      }
    };

    const result = validateFormData(invalidData);
    return !result.success && 
           result.errors?.some(e => e.field === "authorEmail" && e.message.includes("valid email"));
  });

  // Test 10: Valid slug format
  await runTest("Valid slug format", () => {
    const validData = {
      authorName: "John Doe",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here with enough words to meet requirements.\n" }]
      },
      slug: "valid-article-slug-123"
    };

    const result = validateFormData(validData);
    return result.success;
  });

  // Test 11: Invalid slug format
  await runTest("Invalid slug format (uppercase/spaces)", () => {
    const invalidData = {
      authorName: "John Doe",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here.\n" }]
      },
      slug: "Invalid Slug Format!"
    };

    const result = validateFormData(invalidData);
    return !result.success && 
           result.errors?.some(e => e.field === "slug" && e.message.includes("lowercase letters"));
  });

  // Test 12: Profanity detection
  await runTest("Profanity detection in author name", () => {
    const invalidData = {
      authorName: "John Shit Doe", // Contains profanity
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here.\n" }]
      }
    };

    const result = validateFormData(invalidData);
    return !result.success && 
           result.errors?.some(e => e.field === "authorName" && e.message.includes("inappropriate language"));
  });

  // Test 13: Draft validation (lenient)
  await runTest("Draft validation allows partial data", () => {
    const draftData = {
      articleTitle: "Draft Title",
      // Missing other fields
    };

    const result = validateDraftFormData(draftData);
    return result.success;
  });

  // Test 14: Update validation
  await runTest("Update validation with partial data", () => {
    const updateData = {
      articleTitle: "Updated Article Title Here",
      articleContent: {
        ops: [{ insert: "Updated content with sufficient length to meet minimum requirements.\n" }]
      }
      // metaDescription and authorName can be missing for updates
    };

    const result = validateUpdateFormData(updateData);
    return result.success;
  });

  // Test 15: Content length validation
  await runTest("Content length validation", () => {
    const shortContent: QuillDelta = {
      ops: [{ insert: "Too short.\n" }]
    };

    const result = validateContent(shortContent, { minWords: 50 });
    return !result.success && 
           result.errors?.some(e => e.message.includes("at least 50 words"));
  });

  // Test 16: Text extraction from Delta
  await runTest("Text extraction from Quill Delta", () => {
    const delta: QuillDelta = {
      ops: [
        { insert: "Hello " },
        { insert: "world", attributes: { bold: true } },
        { insert: " this is a test.\n" }
      ]
    };

    const text = extractTextFromDelta(delta);
    return text === "Hello world this is a test.";
  });

  // Test 17: Categories and tags validation
  await runTest("Categories and tags validation", () => {
    const validData = {
      authorName: "John Doe",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here with enough words to meet requirements for validation.\n" }]
      },
      categories: ["Technology", "Web Development"],
      tags: ["javascript", "programming", "tutorial"]
    };

    const result = validateFormData(validData);
    return result.success && 
           result.data?.categories?.length === 2 &&
           result.data?.tags?.length === 3;
  });

  // Test 18: Future publish date validation
  await runTest("Future publish date validation", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    const validData = {
      authorName: "John Doe",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here with enough words to meet requirements.\n" }]
      },
      publishAt: futureDate.toISOString()
    };

    const result = validateFormData(validData);
    return result.success;
  });

  // Test 19: Past publish date validation (should fail)
  await runTest("Past publish date validation (should fail)", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
    const invalidData = {
      authorName: "John Doe",
      articleTitle: "Valid Article Title Here",
      metaDescription: "This is a valid meta description that meets the minimum length requirement for SEO purposes.",
      articleContent: {
        ops: [{ insert: "Valid content here.\n" }]
      },
      publishAt: pastDate.toISOString()
    };

    const result = validateFormData(invalidData);
    return !result.success && 
           result.errors?.some(e => e.message.includes("future"));
  });

  // Summary
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log("🎉 All form validation tests passed!");
    return true;
  } else {
    console.log(`❌ ${totalTests - passedTests} tests failed`);
    return false;
  }
}

// Run the tests
const success = await testFormValidation();
Deno.exit(success ? 0 : 1);
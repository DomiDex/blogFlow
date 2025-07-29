/// <reference lib="deno.ns" />

import { FormDataBuilder } from "../builders/FormDataBuilder.ts";
import { ContentGenerator } from "../generators/content.ts";
import { COMPLEX_DELTA } from "./quill-delta.ts";
import type { FormData } from "@/types/form.ts";

/**
 * Predefined test scenarios for different testing needs
 */
export const TestScenarios = {
  /**
   * Happy path scenarios - Valid data that should succeed
   */
  validArticle: {
    /**
     * Minimal valid article with just required fields
     */
    minimal: new FormDataBuilder()
      .withContent(ContentGenerator.minimalDelta())
      .build(),
    
    /**
     * Complete article with all features
     */
    complete: new FormDataBuilder()
      .withAuthor("Jane Smith")
      .withTitle("Complete Guide to Deno Development")
      .withMetaDescription("A comprehensive guide covering all aspects of Deno development including modules, testing, and deployment")
      .withContent(COMPLEX_DELTA)
      .published()
      .build(),
    
    /**
     * Draft article (default behavior)
     */
    draft: new FormDataBuilder()
      .withTitle("Draft Article for Review")
      .withMetaDescription("This article is saved as a draft and will be published later after review and editing")
      .draft()
      .build(),
    
    /**
     * Article with rich formatting
     */
    richFormatting: new FormDataBuilder()
      .withTitle("Rich Text Formatting Examples")
      .withContent(ContentGenerator.quillDelta({
        paragraphs: 3,
        includeFormatting: true,
        includeLists: true,
        includeCode: true,
        includeLinks: true,
        includeHeaders: true,
      }))
      .build(),
  },
  
  /**
   * Edge cases - Valid but unusual data
   */
  edgeCases: {
    /**
     * Maximum length fields
     */
    maxLength: new FormDataBuilder()
      .withTitle("A".repeat(200)) // Max title length
      .withMetaDescription("B".repeat(300)) // Max description length
      .build(),
    
    /**
     * Special characters and unicode
     */
    specialChars: new FormDataBuilder()
      .withTitle("Café & Résumé: Testing ñ, ü, é")
      .withAuthor("Émilie Müller-José")
      .withContent(ContentGenerator.specialCharacterDelta())
      .build(),
    
    /**
     * Unicode and emojis
     */
    unicode: new FormDataBuilder()
      .withTitle("🚀 Unicode Test Article 你好世界")
      .withAuthor("李明 (Li Ming)")
      .withMetaDescription("Testing unicode support with Chinese characters 中文 and emojis 🎉✨💻")
      .build(),
    
    /**
     * Minimal content (just enough to pass validation)
     */
    minimalContent: new FormDataBuilder()
      .withContent(ContentGenerator.minimalDelta())
      .build(),
    
    /**
     * Very long content
     */
    longContent: new FormDataBuilder()
      .withTitle("Performance Test: Very Long Article")
      .withContent(ContentGenerator.quillDelta({ paragraphs: 50 }))
      .build(),
    
    /**
     * Reserved words in title (for slug generation)
     */
    reservedWords: new FormDataBuilder()
      .withTitle("Admin API Settings Configuration")
      .withMetaDescription("Testing slug generation with reserved words like admin, api, config that might conflict")
      .build(),
  },
  
  /**
   * Invalid scenarios - Data that should fail validation
   */
  invalid: {
    /**
     * Missing required fields
     */
    missingAuthor: {
      articleTitle: "Missing Author Test",
      metaDescription: "This submission is missing the required author field and should fail validation",
      articleContent: ContentGenerator.minimalDelta(),
      publishNow: false,
    } as any, // Intentionally invalid
    
    /**
     * Content too short
     */
    shortContent: new FormDataBuilder()
      .withContent({ ops: [{ insert: "Too short" }] })
      .build(),
    
    /**
     * Empty content
     */
    emptyContent: new FormDataBuilder()
      .withContent(ContentGenerator.emptyDelta())
      .build(),
    
    /**
     * Invalid meta description (too short)
     */
    shortMetaDescription: new FormDataBuilder()
      .withMetaDescription("Too short")
      .build(),
    
    /**
     * Invalid title (too short)
     */
    shortTitle: new FormDataBuilder()
      .withTitle("Short")
      .build(),
  },
  
  /**
   * Stress test scenarios
   */
  stressTest: {
    /**
     * Rapid succession submissions
     */
    rapidFire: Array.from({ length: 10 }, (_, i) => 
      new FormDataBuilder()
        .withTitle(`Rapid Fire Test ${i + 1}`)
        .withMetaDescription(`Testing rapid succession of API calls to verify rate limiting and system stability ${i}`)
        .build()
    ),
    
    /**
     * Concurrent submissions
     */
    concurrent: ContentGenerator.articleSet(5),
    
    /**
     * Large batch
     */
    largeBatch: ContentGenerator.articleSet(50),
  },
  
  /**
   * Security test scenarios
   */
  security: {
    /**
     * XSS attempt
     */
    xssAttempt: new FormDataBuilder()
      .withTitle("<script>alert('XSS')</script>")
      .withContent({
        ops: [{
          insert: "Normal text <script>alert('XSS')</script> more text"
        }]
      })
      .build(),
    
    /**
     * SQL injection attempt
     */
    sqlInjection: new FormDataBuilder()
      .withTitle("Test'; DROP TABLE articles; --")
      .withAuthor("Robert'); DROP TABLE students; --")
      .build(),
    
    /**
     * HTML injection
     */
    htmlInjection: new FormDataBuilder()
      .withContent({
        ops: [{
          insert: "Text with <iframe src='evil.com'></iframe> embedded"
        }]
      })
      .build(),
  },
};

/**
 * Get a scenario by path (e.g., "validArticle.minimal")
 */
export function getScenario(path: string): FormData | FormData[] {
  const parts = path.split(".");
  let result: any = TestScenarios;
  
  for (const part of parts) {
    result = result[part];
    if (!result) {
      throw new Error(`Scenario not found: ${path}`);
    }
  }
  
  return result;
}

/**
 * Get all scenarios of a specific type
 */
export function getScenariosOfType(type: keyof typeof TestScenarios): Record<string, any> {
  return TestScenarios[type];
}
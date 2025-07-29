/// <reference lib="deno.ns" />

import { assertEquals, assert } from "@std/assert";
import { describe, it, beforeEach } from "@std/testing/bdd";
import { ContentProcessor } from "@services/contentProcessor.ts";
import { SlugService } from "@services/slugService.ts";
import { FieldMapper } from "@services/fieldMapper.ts";
import { MetadataGenerator } from "@services/metadataGenerator.ts";
import * as fixtures from "../fixtures/quill-delta.ts";
import type { FormData, ProcessedFormData } from "@/types/form.ts";

describe("Performance Benchmarks", () => {
  let contentProcessor: ContentProcessor;
  let slugService: SlugService;
  let metadataGenerator: MetadataGenerator;
  
  const testFormData: FormData = {
    authorName: "Performance Test",
    articleTitle: "Benchmark Article for Performance Testing",
    metaDescription: "This article is used to measure the performance of our form processing pipeline",
    articleContent: fixtures.COMPLEX_DELTA,
    publishNow: false
  };

  beforeEach(() => {
    contentProcessor = new ContentProcessor();
    // Create mock webflow service for slug service
    const mockWebflowService = {
      async checkSlugExists() {
        return { exists: false };
      }
    } as any;
    slugService = new SlugService(mockWebflowService);
    metadataGenerator = new MetadataGenerator(slugService);
  });

  it("should process form data within acceptable time", async () => {
    const iterations = 100;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      // Process content
      const html = contentProcessor.processQuillDelta(testFormData.articleContent);
      
      // Generate metadata
      await metadataGenerator.generateMetadata(
        testFormData.articleTitle,
        html,
        testFormData.metaDescription,
        testFormData.publishNow
      );
    }
    
    const duration = performance.now() - start;
    const avgTime = duration / iterations;
    
    console.log(`Average processing time: ${avgTime.toFixed(2)}ms`);
    
    // Should process form in under 50ms on average
    assert(avgTime < 50, `Average time ${avgTime.toFixed(2)}ms exceeds 50ms threshold`);
  });

  it("should handle concurrent processing efficiently", async () => {
    const concurrentRequests = 50;
    const promises = [];
    
    const start = performance.now();
    
    for (let i = 0; i < concurrentRequests; i++) {
      const promise = (async () => {
        const html = contentProcessor.processQuillDelta(testFormData.articleContent);
        return metadataGenerator.generateMetadata(
          `${testFormData.articleTitle} ${i}`,
          html,
          testFormData.metaDescription,
          testFormData.publishNow
        );
      })();
      promises.push(promise);
    }
    
    const results = await Promise.all(promises);
    const duration = performance.now() - start;
    
    console.log(`Concurrent processing (${concurrentRequests} requests): ${duration.toFixed(2)}ms`);
    console.log(`Average per request: ${(duration / concurrentRequests).toFixed(2)}ms`);
    
    // All results should be successful
    assertEquals(results.length, concurrentRequests);
    results.forEach(result => {
      assert(result.slug);
      assert(result.wordCount > 0);
    });
    
    // Should complete within reasonable time (under 2 seconds for 50 requests)
    assert(duration < 2000, `Concurrent processing took ${duration.toFixed(2)}ms, exceeding 2000ms threshold`);
  });

  it("should process large content efficiently", async () => {
    // Create very large content
    const largeOps = [];
    for (let i = 0; i < 1000; i++) {
      largeOps.push({
        insert: `This is paragraph ${i + 1} with substantial content to test large article handling. `
      });
    }
    
    const largeContent = { ops: largeOps };
    const start = performance.now();
    
    const html = contentProcessor.processQuillDelta(largeContent);
    const metadata = await metadataGenerator.generateMetadata(
      "Very Large Article",
      html,
      "Testing performance with large content",
      false
    );
    
    const duration = performance.now() - start;
    
    console.log(`Large content processing (${largeOps.length} paragraphs): ${duration.toFixed(2)}ms`);
    console.log(`Word count: ${metadata.wordCount}`);
    
    // Should process even large content in under 500ms
    assert(duration < 500, `Large content processing took ${duration.toFixed(2)}ms, exceeding 500ms threshold`);
  });

  it("should maintain consistent slug generation performance", async () => {
    const iterations = 100;
    const durations: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await slugService.generateUniqueSlug(`Test Article Number ${i}`);
      const duration = performance.now() - start;
      durations.push(duration);
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    console.log(`Slug generation performance over ${iterations} iterations:`);
    console.log(`  Average: ${avgDuration.toFixed(2)}ms`);
    console.log(`  Min: ${minDuration.toFixed(2)}ms`);
    console.log(`  Max: ${maxDuration.toFixed(2)}ms`);
    
    // Average should be under 10ms
    assert(avgDuration < 10, `Average slug generation time ${avgDuration.toFixed(2)}ms exceeds 10ms`);
    
    // No single operation should take more than 50ms
    assert(maxDuration < 50, `Maximum slug generation time ${maxDuration.toFixed(2)}ms exceeds 50ms`);
  });

  it("should efficiently map fields without performance degradation", () => {
    const iterations = 1000;
    const mapper = new FieldMapper();
    
    const mockMetadata = {
      slug: "test-article",
      wordCount: 150,
      readingTime: "1 min read",
      introText: "This is the introduction",
      publishedOn: new Date().toISOString(),
    };
    
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      mapper.mapToWebflowFields(
        testFormData,
        mockMetadata,
        "<p>Test HTML content</p>"
      );
    }
    
    const duration = performance.now() - start;
    const avgTime = duration / iterations;
    
    console.log(`Field mapping performance: ${avgTime.toFixed(3)}ms per operation`);
    
    // Field mapping should be very fast (under 1ms)
    assert(avgTime < 1, `Average field mapping time ${avgTime.toFixed(3)}ms exceeds 1ms`);
  });
});
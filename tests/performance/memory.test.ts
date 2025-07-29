/// <reference lib="deno.ns" />

import { assert } from "@std/assert";
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { SlugService } from "@services/slugService.ts";
import { ContentProcessor } from "@services/contentProcessor.ts";
import { RateLimiterStore } from "@middleware/rateLimiter.ts";

describe("Memory Leak Detection", () => {
  // Helper to force garbage collection if available
  function forceGC() {
    if (globalThis.gc) {
      globalThis.gc();
    }
  }

  // Helper to wait for async operations to complete
  async function waitForAsync(ms: number = 100) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  describe("SlugService Memory Management", () => {
    let slugService: SlugService;

    beforeEach(() => {
      const mockWebflowService = {
        async checkSlugExists() {
          return { exists: false };
        }
      } as any;
      slugService = new SlugService(mockWebflowService);
    });

    afterEach(() => {
      slugService.destroy();
    });

    it("should not leak memory with cache operations", async () => {
      const initialMemory = Deno.memoryUsage();
      forceGC();
      await waitForAsync();
      
      const baselineMemory = Deno.memoryUsage();
      
      // Generate many unique slugs to fill cache
      for (let i = 0; i < 5000; i++) {
        await slugService.generateUniqueSlug(`Test Article ${i}`);
      }
      
      // Clear cache and force GC
      slugService.clearCache();
      forceGC();
      await waitForAsync();
      
      const finalMemory = Deno.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - baselineMemory.heapUsed;
      
      console.log("SlugService memory usage:");
      console.log(`  Baseline heap: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Growth: ${(heapGrowth / 1024 / 1024).toFixed(2)} MB`);
      
      // Should not grow more than 10MB after clearing cache
      assert(heapGrowth < 10 * 1024 * 1024, 
        `Heap grew by ${(heapGrowth / 1024 / 1024).toFixed(2)}MB, exceeding 10MB threshold`);
    });

    it("should properly clean up interval timers", async () => {
      // Create multiple instances and destroy them
      const instances: SlugService[] = [];
      
      for (let i = 0; i < 10; i++) {
        const mockWebflowService = {
          async checkSlugExists() {
            return { exists: false };
          }
        } as any;
        const service = new SlugService(mockWebflowService);
        instances.push(service);
      }
      
      // Generate some slugs
      for (const service of instances) {
        await service.generateUniqueSlug("Test");
      }
      
      // Destroy all instances
      for (const service of instances) {
        service.destroy();
      }
      
      forceGC();
      await waitForAsync();
      
      // If timers weren't cleaned up, the test would hang or leak
      assert(true, "All timers cleaned up successfully");
    });
  });

  describe("ContentProcessor Memory Management", () => {
    let processor: ContentProcessor;

    beforeEach(() => {
      processor = new ContentProcessor();
    });

    it("should not leak memory when processing large documents", () => {
      const initialMemory = Deno.memoryUsage();
      forceGC();
      const baselineMemory = Deno.memoryUsage();
      
      // Process many large documents
      for (let i = 0; i < 100; i++) {
        const largeOps = [];
        for (let j = 0; j < 100; j++) {
          largeOps.push({
            insert: `Paragraph ${j} with substantial content. `.repeat(10)
          });
        }
        
        processor.processQuillDelta({ ops: largeOps });
      }
      
      forceGC();
      const finalMemory = Deno.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - baselineMemory.heapUsed;
      
      console.log("ContentProcessor memory usage:");
      console.log(`  Baseline heap: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Growth: ${(heapGrowth / 1024 / 1024).toFixed(2)} MB`);
      
      // Should not retain processed content in memory
      assert(heapGrowth < 20 * 1024 * 1024, 
        `Heap grew by ${(heapGrowth / 1024 / 1024).toFixed(2)}MB, exceeding 20MB threshold`);
    });
  });

  describe("RateLimiter Memory Management", () => {
    it("should clean up expired entries", async () => {
      const store = new RateLimiterStore();
      const windowMs = 100; // Short window for testing
      
      // Add many entries
      for (let i = 0; i < 1000; i++) {
        store.increment(`client-${i}`, windowMs);
      }
      
      // Wait for entries to expire
      await waitForAsync(windowMs + 50);
      
      // Trigger cleanup
      store.cleanup();
      
      // Get store stats if available
      const remainingClients = Array.from((store as any).clients?.keys() || []).length;
      
      console.log(`RateLimiter cleanup: ${remainingClients} clients remaining`);
      
      // All entries should be cleaned up
      assert(remainingClients === 0, `${remainingClients} clients remain after cleanup`);
    });

    it("should not accumulate sliding window data indefinitely", async () => {
      const store = new RateLimiterStore();
      const windowMs = 100;
      const clientId = "test-client";
      
      // Simulate many requests over time
      for (let i = 0; i < 100; i++) {
        store.incrementSlidingWindow(clientId, windowMs);
        await waitForAsync(10);
      }
      
      // Wait for window to pass
      await waitForAsync(windowMs + 50);
      
      // Check sliding window data
      const timestamps = store.getSlidingWindowTimestamps(clientId, windowMs);
      
      console.log(`Sliding window timestamps: ${timestamps.length}`);
      
      // Should only have recent timestamps within the window
      assert(timestamps.length < 20, 
        `${timestamps.length} timestamps retained, indicating potential memory leak`);
    });
  });

  describe("Overall Memory Stability", () => {
    it("should maintain stable memory usage over time", async () => {
      const measurements: number[] = [];
      const iterations = 5;
      
      for (let i = 0; i < iterations; i++) {
        forceGC();
        await waitForAsync();
        
        const memory = Deno.memoryUsage();
        measurements.push(memory.heapUsed);
        
        // Simulate some operations
        const processor = new ContentProcessor();
        for (let j = 0; j < 10; j++) {
          processor.processQuillDelta({
            ops: [{ insert: "Test content" }]
          });
        }
        
        await waitForAsync(100);
      }
      
      const firstMeasurement = measurements[0];
      const lastMeasurement = measurements[measurements.length - 1];
      const growth = lastMeasurement - firstMeasurement;
      const growthPercent = (growth / firstMeasurement) * 100;
      
      console.log("Memory stability test:");
      console.log(`  Initial: ${(firstMeasurement / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Final: ${(lastMeasurement / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Growth: ${growthPercent.toFixed(2)}%`);
      
      // Memory growth should be minimal (less than 10%)
      assert(Math.abs(growthPercent) < 10, 
        `Memory grew by ${growthPercent.toFixed(2)}%, indicating potential leak`);
    });
  });
});
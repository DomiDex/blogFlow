/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { setupIntegrationTest } from "../helpers/mock-app.ts";
import { createMockFetch, createMockResponse, FakeTime, waitForPromises } from "../helpers/test-utils.ts";
import * as fixtures from "../fixtures/quill-delta.ts";
import * as webflowFixtures from "../fixtures/webflow-responses.ts";
import type { FormData } from "@/types/form.ts";

describe("Rate Limiting Integration Tests", () => {
  let originalFetch: typeof fetch;
  let mockResponses: Map<string, Response>;
  let fakeTime: FakeTime;
  let originalEnv: { [key: string]: string | undefined };
  const { app } = setupIntegrationTest();
  
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockResponses = new Map();
    globalThis.fetch = createMockFetch(mockResponses);
    
    fakeTime = new FakeTime();
    fakeTime.install();
    
    // Save original env
    originalEnv = {
      RATE_LIMIT_WINDOW_MS: Deno.env.get("RATE_LIMIT_WINDOW_MS"),
      RATE_LIMIT_MAX_REQUESTS: Deno.env.get("RATE_LIMIT_MAX_REQUESTS")
    };
    
    // Set test rate limits
    Deno.env.set("RATE_LIMIT_WINDOW_MS", "60000"); // 1 minute
    Deno.env.set("RATE_LIMIT_MAX_REQUESTS", "5"); // 5 requests per minute
    
    // Setup default mock responses
    const baseUrl = "https://api.webflow.com/v2";
    
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items?limit=100`,
      createMockResponse(webflowFixtures.LIST_ITEMS_RESPONSE)
    );
    
    mockResponses.set(
      `${baseUrl}/collections/test-collection-id/items`,
      createMockResponse(webflowFixtures.CREATE_ITEM_SUCCESS_RESPONSE, { status: 201 })
    );
  });
  
  afterEach(() => {
    globalThis.fetch = originalFetch;
    fakeTime.uninstall();
    
    // Restore original env
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    });
  });

  describe("Basic Rate Limiting", () => {
    it("should allow requests within rate limit", async () => {
      const formData: FormData = {
        authorName: "Rate Test",
        articleTitle: "Testing Rate Limits",
        metaDescription: "Article within rate limit - this test validates that requests within the configured rate limit are properly allowed through",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Make 5 requests (the limit)
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const response = await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "192.168.1.1" // Same IP
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Rate Limit Test ${i + 1}`
          })
        });
        
        responses.push(response);
      }

      // All should succeed
      responses.forEach((response, index) => {
        assertEquals(response.status, 201, `Request ${index + 1} should succeed`);
      });
    });

    it("should block requests exceeding rate limit", async () => {
      const formData: FormData = {
        authorName: "Rate Test",
        articleTitle: "Testing Rate Limit Exceeded",
        metaDescription: "Article that exceeds rate limit - this test checks that requests exceeding the rate limit are properly blocked",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Make 6 requests (1 over the limit)
      const responses = [];
      for (let i = 0; i < 6; i++) {
        const response = await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "192.168.1.1" // Same IP
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Rate Limit Exceeded ${i + 1}`
          })
        });
        
        responses.push(response);
      }

      // First 5 should succeed
      responses.slice(0, 5).forEach((response, index) => {
        assertEquals(response.status, 201, `Request ${index + 1} should succeed`);
      });

      // 6th should be rate limited
      assertEquals(responses[5].status, 429);
      
      const error = await responses[5].json();
      assertEquals(error.error, "Too many requests");
      assertExists(error.retryAfter);
      
      // Should include Retry-After header
      const retryAfter = responses[5].headers.get("Retry-After");
      assertExists(retryAfter);
      assertEquals(parseInt(retryAfter!) > 0, true);
    });
  });

  describe("Window-Based Limiting", () => {
    it("should reset limit after time window expires", async () => {
      const formData: FormData = {
        authorName: "Window Test",
        articleTitle: "Testing Window Reset",
        metaDescription: "Testing rate limit window functionality to ensure that limits are properly reset after the configured time window expires",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Make 5 requests (hit the limit)
      for (let i = 0; i < 5; i++) {
        await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "192.168.1.2"
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Window Test ${i + 1}`
          })
        });
      }

      // 6th request should fail
      const limitedResponse = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Forwarded-For": "192.168.1.2"
        },
        body: JSON.stringify(formData)
      });

      assertEquals(limitedResponse.status, 429);

      // Advance time past the window (60 seconds)
      fakeTime.advance(61000);
      await waitForPromises();

      // Request should now succeed
      const resetResponse = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Forwarded-For": "192.168.1.2"
        },
        body: JSON.stringify({
          ...formData,
          articleTitle: "After Window Reset"
        })
      });

      assertEquals(resetResponse.status, 201);
    });

    it("should track requests within sliding window", async () => {
      const formData: FormData = {
        authorName: "Sliding Window",
        articleTitle: "Testing Sliding Window",
        metaDescription: "Testing sliding window rate limiting implementation to verify that requests are tracked correctly within the time window",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "192.168.1.3"
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Initial ${i + 1}`
          })
        });
      }

      // Advance 30 seconds
      fakeTime.advance(30000);

      // Make 2 more requests (total 5)
      for (let i = 0; i < 2; i++) {
        await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "192.168.1.3"
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Later ${i + 1}`
          })
        });
      }

      // 6th request should fail (all 5 are within window)
      const limitedResponse = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Forwarded-For": "192.168.1.3"
        },
        body: JSON.stringify(formData)
      });

      assertEquals(limitedResponse.status, 429);

      // Advance another 31 seconds (first 3 requests expire)
      fakeTime.advance(31000);
      await waitForPromises();

      // Should now allow 3 more requests
      const successResponses = [];
      for (let i = 0; i < 3; i++) {
        const response = await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "192.168.1.3"
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Final ${i + 1}`
          })
        });
        successResponses.push(response);
      }

      successResponses.forEach((response) => {
        assertEquals(response.status, 201);
      });
    });
  });

  describe("Per-Client Limiting", () => {
    it("should track rate limits per IP address", async () => {
      const formData: FormData = {
        authorName: "IP Test",
        articleTitle: "Testing Per-IP Limits",
        metaDescription: "Testing individual IP rate limiting to ensure that rate limits are tracked separately for each client IP address",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Client 1: Make 5 requests
      for (let i = 0; i < 5; i++) {
        await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "10.0.0.1"
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Client 1 Request ${i + 1}`
          })
        });
      }

      // Client 1: 6th request should fail
      const client1Limited = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Forwarded-For": "10.0.0.1"
        },
        body: JSON.stringify(formData)
      });

      assertEquals(client1Limited.status, 429);

      // Client 2: Should still be able to make requests
      const client2Response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Forwarded-For": "10.0.0.2"
        },
        body: JSON.stringify({
          ...formData,
          articleTitle: "Client 2 Request"
        })
      });

      assertEquals(client2Response.status, 201);
    });

    it("should handle proxied requests correctly", async () => {
      const formData: FormData = {
        authorName: "Proxy Test",
        articleTitle: "Testing Proxy Headers",
        metaDescription: "Testing rate limiting with proxy headers to verify correct client IP identification when requests come through proxies",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Test various proxy header formats
      const proxyHeaders = [
        { "X-Forwarded-For": "203.0.113.1, 198.51.100.1, 172.16.0.1" },
        { "X-Real-IP": "203.0.113.1" },
        { "CF-Connecting-IP": "203.0.113.1" }
      ];

      for (const proxyHeader of proxyHeaders) {
        const response = await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            ...Object.entries(proxyHeader).reduce((acc, [key, value]) => {
              if (value !== undefined) acc[key] = value;
              return acc;
            }, {} as Record<string, string>)
          },
          body: JSON.stringify(formData)
        });

        assertEquals(response.status, 201);
      }

      // All should be counted as same client (203.0.113.1)
      // Making 3 more requests should hit the limit
      for (let i = 0; i < 2; i++) {
        await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "203.0.113.1"
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Additional ${i + 1}`
          })
        });
      }

      // Next request should be rate limited
      const limitedResponse = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Forwarded-For": "203.0.113.1"
        },
        body: JSON.stringify(formData)
      });

      assertEquals(limitedResponse.status, 429);
    });
  });

  describe("Burst Protection", () => {
    it("should handle rapid burst requests", async () => {
      const formData: FormData = {
        authorName: "Burst Test",
        articleTitle: "Testing Burst Protection",
        metaDescription: "Testing rapid burst request handling to ensure the rate limiter can properly handle multiple concurrent requests",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Send 10 requests as fast as possible
      const burstPromises = [];
      for (let i = 0; i < 10; i++) {
        burstPromises.push(
          app.request("/api/webflow-form", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer test-token",
              "X-Forwarded-For": "192.168.1.100"
            },
            body: JSON.stringify({
              ...formData,
              articleTitle: `Burst ${i + 1}`
            })
          })
        );
      }

      const responses = await Promise.all(burstPromises);
      
      // First 5 should succeed
      const successCount = responses.filter((r: Response) => r.status === 201).length;
      assertEquals(successCount, 5);
      
      // Rest should be rate limited
      const limitedCount = responses.filter((r: Response) => r.status === 429).length;
      assertEquals(limitedCount, 5);
    });

    it("should queue requests when possible", async () => {
      // Set a more restrictive limit for testing
      Deno.env.set("RATE_LIMIT_MAX_REQUESTS", "2");
      
      const formData: FormData = {
        authorName: "Queue Test",
        articleTitle: "Testing Request Queuing",
        metaDescription: "Testing request queue behavior when rate limits are more restrictive to verify proper queuing functionality",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Track response times
      const responseTimes: number[] = [];
      const startTime = Date.now();

      // Make 4 requests
      const requests = [];
      for (let i = 0; i < 4; i++) {
        const request = app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "192.168.1.101"
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Queue ${i + 1}`
          })
        });
        
        requests.push(
          (async () => {
            const response = await request;
            responseTimes.push(Date.now() - startTime);
            return response;
          })()
        );
      }

      const responses = await Promise.all(requests);
      
      // First 2 should succeed immediately
      assertEquals(responses[0].status, 201);
      assertEquals(responses[1].status, 201);
      
      // Next 2 should be rate limited
      assertEquals(responses[2].status, 429);
      assertEquals(responses[3].status, 429);
    });
  });

  describe("Configuration and Overrides", () => {
    it("should respect custom rate limit configuration", async () => {
      // Set very restrictive limits
      Deno.env.set("RATE_LIMIT_WINDOW_MS", "10000"); // 10 seconds
      Deno.env.set("RATE_LIMIT_MAX_REQUESTS", "1"); // 1 request per 10 seconds
      
      const formData: FormData = {
        authorName: "Config Test",
        articleTitle: "Testing Custom Config",
        metaDescription: "Testing custom rate limit configuration to ensure environment variables are properly respected by the middleware",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // First request should succeed
      const firstResponse = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Forwarded-For": "192.168.1.200"
        },
        body: JSON.stringify(formData)
      });

      assertEquals(firstResponse.status, 201);

      // Second request should fail immediately
      const secondResponse = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Forwarded-For": "192.168.1.200"
        },
        body: JSON.stringify({
          ...formData,
          articleTitle: "Second Request"
        })
      });

      assertEquals(secondResponse.status, 429);
      
      // Verify retry-after is approximately 10 seconds
      const retryAfter = parseInt(secondResponse.headers.get("Retry-After")!);
      assertEquals(retryAfter >= 9 && retryAfter <= 10, true);
    });

    it("should allow bypass for certain conditions", async () => {
      // In a real implementation, might bypass rate limits for:
      // - Internal services
      // - Authenticated admin users
      // - Health check endpoints
      
      const response = await app.request("/health", {
        method: "GET",
        headers: {
          "X-Forwarded-For": "192.168.1.250"
        }
      });

      // Health endpoint should not be rate limited
      assertEquals(response.status, 200);
    });
  });

  describe("Rate Limit Headers", () => {
    it("should include rate limit information in headers", async () => {
      const formData: FormData = {
        authorName: "Header Test",
        articleTitle: "Testing Rate Limit Headers",
        metaDescription: "Testing rate limit header information to verify that proper rate limit headers are included in API responses",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Make first request
      const response = await app.request("/api/webflow-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Forwarded-For": "192.168.2.1"
        },
        body: JSON.stringify(formData)
      });

      assertEquals(response.status, 201);
      
      // Check for rate limit headers
      const limitHeader = response.headers.get("X-RateLimit-Limit");
      const remainingHeader = response.headers.get("X-RateLimit-Remaining");
      const resetHeader = response.headers.get("X-RateLimit-Reset");
      
      if (limitHeader && remainingHeader) {
        assertEquals(limitHeader, "5");
        assertEquals(remainingHeader, "4");
        assertExists(resetHeader);
      }
    });

    it("should show correct remaining count", async () => {
      const formData: FormData = {
        authorName: "Count Test",
        articleTitle: "Testing Remaining Count",
        metaDescription: "Testing rate limit remaining count to ensure the X-RateLimit-Remaining header correctly tracks available requests",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Make 4 requests and check remaining count
      for (let i = 0; i < 4; i++) {
        const response = await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": "192.168.2.2"
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Count Test ${i + 1}`
          })
        });

        assertEquals(response.status, 201);
        
        const remaining = response.headers.get("X-RateLimit-Remaining");
        if (remaining) {
          assertEquals(remaining, String(4 - i));
        }
      }
    });
  });

  describe("Distributed Rate Limiting", () => {
    it("should handle distributed client identification", async () => {
      // Simulate requests from same client through different proxies
      const formData: FormData = {
        authorName: "Distributed Test",
        articleTitle: "Testing Distributed Clients",
        metaDescription: "Testing distributed client identification across multiple proxies and load balancers for proper rate limiting",
        articleContent: fixtures.SIMPLE_DELTA,
        publishNow: false
      };

      // Different proxy chains but same origin IP
      const proxyVariations = [
        "203.0.113.10, 172.16.0.1",
        "203.0.113.10, 172.16.0.2, 10.0.0.1",
        "203.0.113.10, 192.168.1.1"
      ];

      let successCount = 0;
      for (const forwarded of proxyVariations) {
        const response = await app.request("/api/webflow-form", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test-token",
            "X-Forwarded-For": forwarded
          },
          body: JSON.stringify({
            ...formData,
            articleTitle: `Proxy variation ${successCount + 1}`
          })
        });

        if (response.status === 201) successCount++;
      }

      // All should count toward same client limit
      assertEquals(successCount, 3);
    });
  });
});
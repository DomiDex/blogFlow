/// <reference lib="deno.ns" />

import type { WebflowCollectionItem, WebflowApiError, WebflowListResponse } from "@/types/webflow.ts";

/**
 * Builder for creating mock Webflow API responses
 */
export class WebflowResponseBuilder {
  /**
   * Create a mock Webflow item response
   */
  static item(overrides?: Partial<WebflowCollectionItem>): WebflowCollectionItem {
    const id = this.generateId();
    const now = new Date().toISOString();
    
    return {
      id,
      cmsLocaleId: this.generateId(),
      lastPublished: undefined,
      lastUpdated: now,
      createdOn: now,
      isArchived: false,
      isDraft: true,
      fieldData: {
        name: "Test Article",
        slug: "test-article",
        "author-name": "John Doe",
        "meta-description": "Test article description",
        post: "<p>Test content</p>",
        "intro-text": "Test content introduction",
        "word-count": "50",
        "reading-time": "1 min read",
        "created-on": now,
        "updated-on": now,
        "published-on": undefined,
      },
      ...overrides,
    };
  }
  
  /**
   * Create a published item
   */
  static publishedItem(overrides?: Partial<WebflowCollectionItem>): WebflowCollectionItem {
    const now = new Date().toISOString();
    return this.item({
      isDraft: false,
      lastPublished: now,
      fieldData: {
        ...this.item().fieldData,
        "published-on": now,
      },
      ...overrides,
    });
  }
  
  /**
   * Create an error response
   */
  static error(status: number, message?: string): WebflowApiError {
    const errors: Record<number, WebflowApiError> = {
      400: {
        message: message || "Validation failed",
        code: "VALIDATION_ERROR",
        details: ["name", "slug"],
      },
      401: {
        message: message || "Invalid API token",
        code: "UNAUTHORIZED",
      },
      403: {
        message: message || "Access forbidden",
        code: "FORBIDDEN",
      },
      404: {
        message: message || "Resource not found",
        code: "NOT_FOUND",
      },
      409: {
        message: message || "Resource already exists",
        code: "CONFLICT",
        details: [{
          field: "slug",
          value: "existing-slug",
        }],
      },
      429: {
        message: message || "Rate limit exceeded",
        code: "RATE_LIMIT_ERROR",
        externalReference: "60",
      },
      500: {
        message: message || "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      },
      503: {
        message: message || "Service temporarily unavailable",
        code: "SERVICE_UNAVAILABLE",
      },
    };
    
    return errors[status] || errors[500];
  }
  
  /**
   * Create a collection list response
   */
  static collection(items: WebflowCollectionItem[] = []): WebflowListResponse<WebflowCollectionItem> {
    return {
      items,
      pagination: {
        limit: 100,
        offset: "0",
        total: items.length,
      },
    };
  }
  
  /**
   * Create a paginated collection response
   */
  static paginatedCollection(
    items: WebflowCollectionItem[],
    page: number = 1,
    limit: number = 100
  ): WebflowListResponse<WebflowCollectionItem> {
    const offset = (page - 1) * limit;
    const paginatedItems = items.slice(offset, offset + limit);
    
    return {
      items: paginatedItems,
      pagination: {
        limit,
        offset: offset.toString(),
        total: items.length,
      },
    };
  }
  
  /**
   * Create multiple items with incrementing data
   */
  static items(count: number, isDraft: boolean = true): WebflowCollectionItem[] {
    return Array.from({ length: count }, (_, i) => 
      this.item({
        isDraft,
        fieldData: {
          ...this.item().fieldData,
          name: `Test Article ${i + 1}`,
          slug: `test-article-${i + 1}`,
          "author-name": `Author ${i + 1}`,
        },
      })
    );
  }
  
  /**
   * Create a success response for operations
   */
  static success(message: string = "Operation successful"): { success: true; message: string } {
    return {
      success: true,
      message,
    };
  }
  
  /**
   * Create a publish response
   */
  static publishResponse(itemId: string): { publishedItemIds: string[] } {
    return {
      publishedItemIds: [itemId],
    };
  }
  
  /**
   * Create an update response
   */
  static updateResponse(item: WebflowCollectionItem): WebflowCollectionItem {
    return {
      ...item,
      lastUpdated: new Date().toISOString(),
      fieldData: {
        ...item.fieldData,
        "updated-on": new Date().toISOString(),
      },
    };
  }
  
  /**
   * Generate a realistic Webflow ID
   */
  private static generateId(): string {
    const chars = "0123456789abcdef";
    let id = "";
    for (let i = 0; i < 24; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }
  
  /**
   * Create a rate limit headers object
   */
  static rateLimitHeaders(
    limit: number = 60,
    remaining: number = 59,
    resetTime?: Date
  ): Record<string, string> {
    const reset = resetTime || new Date(Date.now() + 60000);
    
    return {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": reset.toISOString(),
    };
  }
}
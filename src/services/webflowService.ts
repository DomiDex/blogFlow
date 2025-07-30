/// <reference lib="deno.ns" />
import { logger } from "@utils/logger.ts";
import { parseNetworkError, parseWebflowError } from "@utils/webflowErrors.ts";
import { createWebflowRetryHandler, type WebflowRetryHandler } from "@utils/retry.ts";
import type {
  WebflowCollectionItem,
  WebflowCreateItemRequest,
  WebflowListResponse,
} from "../types/webflow.ts";

export interface WebflowServiceConfig {
  apiToken: string;
  siteId: string;
  collectionId: string;
  baseUrl?: string;
  timeout?: number;
}

export interface WebflowQueryOptions {
  limit?: number;
  offset?: string;
  sort?: string[];
  filter?: Record<string, unknown>;
}

export interface WebflowSlugCheckResult {
  exists: boolean;
  itemId?: string;
}

export class WebflowService {
  private readonly config: WebflowServiceConfig;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryHandler: WebflowRetryHandler;

  constructor(config: WebflowServiceConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || "https://api.webflow.com/v2";
    this.timeout = config.timeout || 30000;

    // Initialize retry handler with circuit breaker
    this.retryHandler = createWebflowRetryHandler({
      name: "webflow-api",
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringWindow: 300000, // 5 minutes
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        timeout: this.timeout,
      },
    });
  }

  /**
   * Get collection items with optional filtering and pagination
   */
  async getCollectionItems(
    options: WebflowQueryOptions = {},
  ): Promise<WebflowListResponse<WebflowCollectionItem>> {
    const url = new URL(`${this.baseUrl}/collections/${this.config.collectionId}/items`);

    // Add query parameters
    if (options.limit) url.searchParams.set("limit", options.limit.toString());
    if (options.offset) url.searchParams.set("offset", options.offset);
    if (options.sort) {
      options.sort.forEach((sort) => url.searchParams.append("sort", sort));
    }
    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        url.searchParams.set(`filter[${key}]`, String(value));
      });
    }

    const response = await this.retryHandler.execute(
      () =>
        this.makeRequest<WebflowListResponse<WebflowCollectionItem>>(url.toString(), {
          method: "GET",
        }),
      {
        operation: "getCollectionItems",
        collectionId: this.config.collectionId,
        options,
      },
    );

    logger.info("Retrieved collection items", {
      collectionId: this.config.collectionId,
      count: response.items?.length || 0,
      total: response.pagination?.total || 0,
    });

    return response;
  }

  /**
   * Create a new collection item
   */
  async createCollectionItem(data: WebflowCreateItemRequest): Promise<WebflowCollectionItem> {
    const url = `${this.baseUrl}/collections/${this.config.collectionId}/items`;

    // Ensure required fields are present
    if (!data.fieldData) {
      throw new Error("fieldData is required for creating collection items");
    }

    const response = await this.retryHandler.execute(
      () =>
        this.makeRequest<WebflowCollectionItem>(url, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      {
        operation: "createCollectionItem",
        collectionId: this.config.collectionId,
        slug: data.fieldData.slug,
      },
    );

    logger.info("Created collection item", {
      collectionId: this.config.collectionId,
      itemId: response.id,
      slug: data.fieldData.slug,
    });

    return response;
  }

  /**
   * Publish a collection item (make it live)
   */
  async publishItem(itemId: string): Promise<void> {
    const url = `${this.baseUrl}/collections/${this.config.collectionId}/items/${itemId}/publish`;

    await this.retryHandler.execute(
      () =>
        this.makeRequest<void>(url, {
          method: "POST",
          body: JSON.stringify({}),
        }),
      {
        operation: "publishItem",
        collectionId: this.config.collectionId,
        itemId,
      },
    );

    logger.info("Published collection item", {
      collectionId: this.config.collectionId,
      itemId,
    });
  }

  /**
   * Check if a slug already exists in the collection
   */
  async checkSlugExists(slug: string): Promise<WebflowSlugCheckResult> {
    try {
      // Get more items to check for exact matches since API filter might be doing partial matching
      const response = await this.getCollectionItems({
        limit: 100, // Get more items to increase chances of finding exact match
      });

      // Find exact slug match
      const exactMatch = response.items?.find((item: WebflowCollectionItem) =>
        item.fieldData.slug === slug
      );

      const exists = !!exactMatch;
      const itemId = exactMatch?.id;

      logger.debug("Slug existence check", {
        slug,
        exists,
        itemId,
        totalItemsChecked: response.items?.length || 0,
      });

      return { exists, itemId };
    } catch (error) {
      logger.error("Failed to check slug existence", {
        slug,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Get a specific collection item by ID
   */
  async getCollectionItem(itemId: string): Promise<WebflowCollectionItem> {
    const url = `${this.baseUrl}/collections/${this.config.collectionId}/items/${itemId}`;

    const response = await this.makeRequest<WebflowCollectionItem>(url, {
      method: "GET",
    });

    logger.debug("Retrieved collection item", {
      collectionId: this.config.collectionId,
      itemId,
    });

    return response;
  }

  /**
   * Update an existing collection item
   */
  async updateCollectionItem(
    itemId: string,
    data: WebflowCreateItemRequest,
  ): Promise<WebflowCollectionItem> {
    const url = `${this.baseUrl}/collections/${this.config.collectionId}/items/${itemId}`;

    const response = await this.makeRequest<WebflowCollectionItem>(url, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    logger.info("Updated collection item", {
      collectionId: this.config.collectionId,
      itemId,
      slug: data.fieldData?.slug,
    });

    return response;
  }

  /**
   * Test API connection and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to fetch collection items to test authentication (requires cms:read scope)
      await this.getCollectionItems({ limit: 1 });

      logger.info("Webflow API connection successful", {
        collectionId: this.config.collectionId,
        circuitHealth: this.retryHandler.isHealthy(),
      });

      return true;
    } catch (error) {
      logger.error("Webflow API connection failed", {
        collectionId: this.config.collectionId,
        error: error instanceof Error ? error : new Error(String(error)),
        circuitMetrics: this.retryHandler.getMetrics(),
      });
      return false;
    }
  }

  /**
   * Get retry handler metrics for monitoring
   */
  getRetryMetrics() {
    return this.retryHandler.getMetrics();
  }

  /**
   * Check if the circuit breaker is healthy
   */
  isCircuitHealthy(): boolean {
    return this.retryHandler.isHealthy();
  }

  /**
   * Reset the circuit breaker
   */
  resetCircuit(): void {
    this.retryHandler.reset();
    logger.info("Circuit breaker reset", {
      collectionId: this.config.collectionId,
    });
  }

  /**
   * Make HTTP request to Webflow API with proper headers and error handling
   */
  private async makeRequest<T>(url: string, options: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json",
          "accept-version": "1.0.0",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleApiError(response);
      }

      // Handle empty responses (like for publish endpoint)
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        return {} as T;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw parseNetworkError(new Error(`Request timeout after ${this.timeout}ms`));
      }

      if (error instanceof Error) {
        throw parseNetworkError(error);
      }

      throw error;
    }
  }

  /**
   * Handle API error responses with detailed error messages
   */
  private async handleApiError(response: Response): Promise<never> {
    let responseBody: unknown = null;

    try {
      responseBody = await response.json();
    } catch {
      // If we can't parse the error body, proceed with null
    }

    logger.error("Webflow API error", {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      responseBody,
    });

    const webflowError = parseWebflowError(response, responseBody);

    // Log the structured error
    logger.error("Parsed Webflow error", {
      error: webflowError,
    });

    throw webflowError;
  }
}

/**
 * Create and configure Webflow service instance
 */
export function createWebflowService(): WebflowService {
  const apiToken = Deno.env.get("WEBFLOW_API_TOKEN");
  const siteId = Deno.env.get("WEBFLOW_SITE_ID");
  const collectionId = Deno.env.get("WEBFLOW_COLLECTION_ID");

  if (!apiToken) {
    throw new Error("WEBFLOW_API_TOKEN environment variable is required");
  }

  if (!siteId) {
    throw new Error("WEBFLOW_SITE_ID environment variable is required");
  }

  if (!collectionId) {
    throw new Error("WEBFLOW_COLLECTION_ID environment variable is required");
  }

  return new WebflowService({
    apiToken,
    siteId,
    collectionId,
  });
}

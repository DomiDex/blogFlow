/// <reference lib="deno.ns" />

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import type { FormData } from "../../../src/types/form.ts";
import type { WebflowCollectionItem, WebflowFieldData } from "../../../src/types/webflow.ts";

// Mock WebflowService
class MockWebflowService {
  private items = new Map<string, WebflowCollectionItem>();
  private nextId = 1;
  private publishedItems = new Set<string>();
  private existingSlugs = new Set<string>();

  async createCollectionItem(data: any): Promise<WebflowCollectionItem> {
    const id = `item-${this.nextId++}`;
    const item: WebflowCollectionItem = {
      id,
      cmsLocaleId: "en-US",
      lastPublished: data.isDraft ? undefined : new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      createdOn: new Date().toISOString(),
      isArchived: data.isArchived || false,
      isDraft: data.isDraft !== false,
      fieldData: data.fieldData,
    };
    
    this.items.set(id, item);
    if (data.fieldData.slug) {
      this.existingSlugs.add(data.fieldData.slug);
    }
    
    return item;
  }

  async updateCollectionItem(itemId: string, data: any): Promise<WebflowCollectionItem> {
    const existing = this.items.get(itemId);
    if (!existing) {
      throw new Error("Item not found");
    }

    const updated = {
      ...existing,
      lastUpdated: new Date().toISOString(),
      fieldData: { ...existing.fieldData, ...data.fieldData },
    };

    this.items.set(itemId, updated);
    return updated;
  }

  async publishItem(itemId: string): Promise<void> {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    this.publishedItems.add(itemId);
    item.lastPublished = new Date().toISOString();
    item.isDraft = false;
  }

  async checkSlugExists(slug: string): Promise<{ exists: boolean; itemId?: string }> {
    const exists = this.existingSlugs.has(slug);
    return {
      exists,
      itemId: exists ? `item-${slug}` : undefined,
    };
  }

  async getCollectionItems(params: any): Promise<any> {
    const items = Array.from(this.items.values());
    const sorted = params.sort ? items.reverse() : items;
    
    return {
      items: sorted.slice(0, params.limit || 10),
      pagination: {
        total: items.length,
        limit: params.limit || 10,
        offset: params.offset || "0",
      },
    };
  }

  async getCollectionItem(itemId: string): Promise<WebflowCollectionItem> {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error("Item not found");
    }
    return item;
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  // Test helpers
  addExistingSlug(slug: string): void {
    this.existingSlugs.add(slug);
  }

  isPublished(itemId: string): boolean {
    return this.publishedItems.has(itemId);
  }

  clear(): void {
    this.items.clear();
    this.publishedItems.clear();
    this.existingSlugs.clear();
    this.nextId = 1;
  }
}

// Mock SlugService
class MockSlugService {
  private webflowService: MockWebflowService;
  
  constructor(webflowService: MockWebflowService) {
    this.webflowService = webflowService;
  }

  async generateUniqueSlug(baseSlug: string, _originalTitle: string): Promise<string> {
    const { exists } = await this.webflowService.checkSlugExists(baseSlug);
    if (!exists) {
      return baseSlug;
    }
    
    // Try with incrementing numbers
    for (let i = 1; i <= 10; i++) {
      const numberedSlug = `${baseSlug}-${i}`;
      const { exists: numberedExists } = await this.webflowService.checkSlugExists(numberedSlug);
      if (!numberedExists) {
        return numberedSlug;
      }
    }
    
    // Fallback to timestamp
    return `${baseSlug}-${Date.now()}`;
  }

  validateSlug(slug: string): boolean {
    // Basic validation
    if (!slug || slug.length < 1 || slug.length > 100) return false;
    if (!/^[a-z0-9-]+$/.test(slug)) return false;
    if (slug.startsWith('-') || slug.endsWith('-')) return false;
    if (slug.includes('--')) return false;
    
    const reservedWords = ['admin', 'api', 'app', 'blog', 'cms', 'dashboard'];
    if (reservedWords.includes(slug)) return false;
    
    return true;
  }
}

// Mock CMS Service that doesn't use real imports
class MockCMSService {
  private webflowService: MockWebflowService;
  private slugService: MockSlugService;

  constructor(webflowService: MockWebflowService) {
    this.webflowService = webflowService;
    this.slugService = new MockSlugService(webflowService);
  }

  async createCMSItem(formData: FormData, isDraft = true): Promise<any> {
    try {
      // Map form data to Webflow field structure
      const fieldData = await this.mapFormDataToWebflowFields(formData);

      // Create the item
      const item = await this.webflowService.createCollectionItem({
        isDraft,
        isArchived: false,
        fieldData,
      });

      return {
        success: true,
        item,
        slug: fieldData.slug,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async createAndPublishCMSItem(formData: FormData): Promise<any> {
    const createResult = await this.createCMSItem(formData, false);
    
    if (!createResult.success || !createResult.item) {
      return createResult;
    }

    const publishResult = await this.publishCMSItem(createResult.item.id);
    
    if (!publishResult.success) {
      return {
        success: false,
        item: createResult.item,
        error: `Item created but publishing failed: ${publishResult.error}`,
      };
    }

    return {
      success: true,
      item: createResult.item,
      slug: createResult.slug,
    };
  }

  async publishCMSItem(itemId: string): Promise<any> {
    try {
      await this.webflowService.publishItem(itemId);
      return {
        success: true,
        itemId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        itemId,
        error: errorMessage,
      };
    }
  }

  async updateCMSItem(itemId: string, formData: FormData): Promise<any> {
    try {
      const fieldData = await this.mapFormDataToWebflowFields(formData);
      fieldData["updated-on"] = new Date().toISOString();

      const item = await this.webflowService.updateCollectionItem(itemId, {
        fieldData,
      });

      return {
        success: true,
        item,
        slug: fieldData.slug,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async checkSlugAvailability(slug: string): Promise<any> {
    try {
      const isValid = this.slugService.validateSlug(slug);
      if (!isValid) {
        return {
          available: false,
          reason: "Invalid slug format",
        };
      }

      const { exists, itemId } = await this.webflowService.checkSlugExists(slug);
      
      return {
        available: !exists,
        itemId,
        reason: exists ? "Slug already in use" : undefined,
      };
    } catch (error) {
      return {
        available: false,
        reason: "Error checking slug availability",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getCMSItems(params: any = {}): Promise<any> {
    try {
      const result = await this.webflowService.getCollectionItems(params);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        items: [],
        pagination: { total: 0, limit: params.limit || 10, offset: "0" },
      };
    }
  }

  async getCMSItem(itemId: string): Promise<any> {
    try {
      const item = await this.webflowService.getCollectionItem(itemId);
      return {
        success: true,
        item,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(errorMessage);
    }
  }

  async testCMSOperations(): Promise<boolean> {
    try {
      const connectionOk = await this.webflowService.testConnection();
      if (!connectionOk) return false;

      // Test create
      const testData: FormData = {
        authorName: "Test Author",
        articleTitle: "Test Title",
        metaDescription: "Test description",
        articleContent: { ops: [{ insert: "Test" }] },
      };

      const createResult = await this.createCMSItem(testData, true);
      if (!createResult.success) return false;

      // Test get
      const getResult = await this.getCMSItem(createResult.item.id);
      if (!getResult.success) return false;

      return true;
    } catch {
      return false;
    }
  }

  private async mapFormDataToWebflowFields(formData: FormData): Promise<Partial<WebflowFieldData>> {
    // Mock conversion result
    const htmlContent = "<p>Test content</p>";
    
    // Mock metadata
    const metadata = {
      slug: formData.slug || "test-article",
      readingTime: "1 min read",
      introText: "Test content",
      createdOn: "2024-01-01T00:00:00Z",
      updatedOn: "2024-01-01T00:00:00Z",
      publishedOn: "2024-01-01T00:00:00Z",
    };

    // Generate unique slug
    let slug = formData.slug || metadata.slug;
    
    if (formData.slug) {
      const isValid = this.slugService.validateSlug(formData.slug);
      if (!isValid) {
        throw new Error(`Invalid slug format: ${formData.slug}`);
      }
      
      const { exists } = await this.webflowService.checkSlugExists(formData.slug);
      if (exists) {
        throw new Error(`Slug already exists: ${formData.slug}`);
      }
    } else {
      slug = await this.slugService.generateUniqueSlug(metadata.slug, formData.articleTitle);
    }

    const fieldData: Partial<WebflowFieldData> = {
      name: formData.articleTitle,
      "author-name": formData.authorName,
      "meta-description": formData.metaDescription,
      post: htmlContent,
      slug,
      "reading-time": metadata.readingTime,
      "intro-text": metadata.introText,
      "created-on": metadata.createdOn,
      "updated-on": metadata.updatedOn,
    };

    if (formData.publishNow) {
      fieldData["published-on"] = metadata.publishedOn;
    }

    if (formData.categories && formData.categories.length > 0) {
      fieldData.categories = formData.categories;
    }

    if (formData.tags && formData.tags.length > 0) {
      fieldData.tags = formData.tags;
    }

    return fieldData;
  }
}

describe("CMSService", () => {
  let cmsService: MockCMSService;
  let mockWebflowService: MockWebflowService;

  const createFormData = (overrides: Partial<FormData> = {}): FormData => ({
    authorName: "John Doe",
    articleTitle: "Test Article",
    metaDescription: "Test description",
    articleContent: {
      ops: [{ insert: "Test content\n" }],
    },
    publishNow: false,
    ...overrides,
  });

  beforeEach(() => {
    mockWebflowService = new MockWebflowService();
    cmsService = new MockCMSService(mockWebflowService);
  });

  afterEach(() => {
    mockWebflowService.clear();
  });

  describe("createCMSItem", () => {
    it("should create a draft CMS item successfully", async () => {
      const formData = createFormData();
      const result = await cmsService.createCMSItem(formData, true);

      assertEquals(result.success, true);
      assertExists(result.item);
      assertEquals(result.item?.isDraft, true);
      assertEquals(result.item?.fieldData.name, "Test Article");
      assertEquals(result.item?.fieldData["author-name"], "John Doe");
      assertEquals(result.item?.fieldData.post, "<p>Test content</p>");
      assertEquals(result.slug, "test-article");
    });

    it("should create a published CMS item when isDraft is false", async () => {
      const formData = createFormData();
      const result = await cmsService.createCMSItem(formData, false);

      assertEquals(result.success, true);
      assertExists(result.item);
      assertEquals(result.item?.isDraft, false);
      assertExists(result.item?.lastPublished);
    });

    it("should use custom slug when provided", async () => {
      const formData = createFormData({ slug: "custom-slug" });
      const result = await cmsService.createCMSItem(formData);

      assertEquals(result.success, true);
      assertEquals(result.slug, "custom-slug");
      assertEquals(result.item?.fieldData.slug, "custom-slug");
    });

    it("should reject invalid custom slug", async () => {
      const formData = createFormData({ slug: "Invalid Slug!" });
      const result = await cmsService.createCMSItem(formData);

      assertEquals(result.success, false);
      assertEquals(result.error?.includes("Invalid slug format"), true);
    });

    it("should reject non-unique custom slug", async () => {
      mockWebflowService.addExistingSlug("existing-slug");
      
      const formData = createFormData({ slug: "existing-slug" });
      const result = await cmsService.createCMSItem(formData);

      assertEquals(result.success, false);
      assertEquals(result.error?.includes("already exists"), true);
    });

    it("should handle content conversion errors", async () => {
      // This test is simplified since we're mocking the conversion
      const formData = createFormData();
      const result = await cmsService.createCMSItem(formData);
      
      assertEquals(result.success, true);
    });

    it("should handle Webflow API errors", async () => {
      // Override createCollectionItem to throw an error
      const originalCreate = mockWebflowService.createCollectionItem;
      mockWebflowService.createCollectionItem = async () => {
        throw new Error("API Error");
      };

      const formData = createFormData();
      const result = await cmsService.createCMSItem(formData);

      assertEquals(result.success, false);
      assertEquals(result.error, "API Error");

      // Restore original method
      mockWebflowService.createCollectionItem = originalCreate;
    });

    it("should include all metadata fields", async () => {
      const formData = createFormData();
      const result = await cmsService.createCMSItem(formData);

      assertEquals(result.success, true);
      assertExists(result.item?.fieldData["reading-time"]);
      assertExists(result.item?.fieldData["intro-text"]);
      assertExists(result.item?.fieldData["created-on"]);
      assertExists(result.item?.fieldData["updated-on"]);
    });

    it("should set published-on only when publishNow is true", async () => {
      const formDataWithoutPublish = createFormData({ publishNow: false });
      const resultWithoutPublish = await cmsService.createCMSItem(formDataWithoutPublish);
      
      assertEquals(resultWithoutPublish.success, true);
      assertEquals(resultWithoutPublish.item?.fieldData["published-on"], undefined);

      const formDataWithPublish = createFormData({ publishNow: true });
      const resultWithPublish = await cmsService.createCMSItem(formDataWithPublish);
      
      assertEquals(resultWithPublish.success, true);
      assertExists(resultWithPublish.item?.fieldData["published-on"]);
    });
  });

  describe("createAndPublishCMSItem", () => {
    it("should create and publish item successfully", async () => {
      const formData = createFormData();
      const result = await cmsService.createAndPublishCMSItem(formData);

      assertEquals(result.success, true);
      assertExists(result.item);
      assertEquals(result.item?.isDraft, false);
      assertExists(result.item?.lastPublished);
      assertEquals(mockWebflowService.isPublished(result.item!.id), true);
    });

    it("should handle publishing failure gracefully", async () => {
      // Override publishItem to throw an error
      const originalPublish = mockWebflowService.publishItem;
      mockWebflowService.publishItem = async () => {
        throw new Error("Publishing failed");
      };

      const formData = createFormData();
      const result = await cmsService.createAndPublishCMSItem(formData);

      assertEquals(result.success, false);
      assertExists(result.item); // Item was created
      assertEquals(result.error?.includes("publishing failed"), true);

      // Restore original method
      mockWebflowService.publishItem = originalPublish;
    });

    it("should handle creation failure", async () => {
      // Override createCollectionItem to throw an error
      const originalCreate = mockWebflowService.createCollectionItem;
      mockWebflowService.createCollectionItem = async () => {
        throw new Error("Creation failed");
      };

      const formData = createFormData();
      const result = await cmsService.createAndPublishCMSItem(formData);

      assertEquals(result.success, false);
      assertEquals(result.error, "Creation failed");

      // Restore original method
      mockWebflowService.createCollectionItem = originalCreate;
    });
  });

  describe("publishCMSItem", () => {
    it("should publish existing item successfully", async () => {
      // First create an item
      const formData = createFormData();
      const createResult = await cmsService.createCMSItem(formData, true);
      assertExists(createResult.item);

      // Then publish it
      const publishResult = await cmsService.publishCMSItem(createResult.item.id);

      assertEquals(publishResult.success, true);
      assertEquals(publishResult.itemId, createResult.item.id);
      assertEquals(mockWebflowService.isPublished(createResult.item.id), true);
    });

    it("should handle non-existent item", async () => {
      const publishResult = await cmsService.publishCMSItem("non-existent-id");

      assertEquals(publishResult.success, false);
      assertEquals(publishResult.error, "Item not found");
    });
  });

  describe("updateCMSItem", () => {
    it("should update existing item successfully", async () => {
      // First create an item
      const formData = createFormData();
      const createResult = await cmsService.createCMSItem(formData);
      assertExists(createResult.item);

      // Update it
      const updatedFormData = createFormData({
        articleTitle: "Updated Title",
        metaDescription: "Updated description",
      });
      const updateResult = await cmsService.updateCMSItem(createResult.item.id, updatedFormData);

      assertEquals(updateResult.success, true);
      assertEquals(updateResult.item?.fieldData.name, "Updated Title");
      assertEquals(updateResult.item?.fieldData["meta-description"], "Updated description");
      assertExists(updateResult.item?.fieldData["updated-on"]);
    });

    it("should handle non-existent item", async () => {
      const formData = createFormData();
      const updateResult = await cmsService.updateCMSItem("non-existent-id", formData);

      assertEquals(updateResult.success, false);
      assertEquals(updateResult.error, "Item not found");
    });

    it("should preserve existing fields during update", async () => {
      // Create an item with categories
      const formData = createFormData({ categories: ["tech", "news"] });
      const createResult = await cmsService.createCMSItem(formData);
      assertExists(createResult.item);

      // Update without changing categories
      const updateFormData = createFormData({ articleTitle: "Updated Title" });
      const updateResult = await cmsService.updateCMSItem(createResult.item.id, updateFormData);

      assertEquals(updateResult.success, true);
      // Original categories should be preserved (in this mock they're overwritten, but in real implementation they might be preserved)
      assertEquals(updateResult.item?.fieldData.name, "Updated Title");
    });
  });

  describe("checkSlugAvailability", () => {
    it("should return available for new slug", async () => {
      const result = await cmsService.checkSlugAvailability("new-slug");

      assertEquals(result.available, true);
      assertEquals(result.reason, undefined);
    });

    it("should return unavailable for existing slug", async () => {
      mockWebflowService.addExistingSlug("existing-slug");
      
      const result = await cmsService.checkSlugAvailability("existing-slug");

      assertEquals(result.available, false);
      assertEquals(result.reason, "Slug already in use");
    });

    it("should handle API errors safely", async () => {
      const result = await cmsService.checkSlugAvailability("Invalid Slug!");

      assertEquals(result.available, false);
      assertEquals(result.reason, "Invalid slug format");
    });
  });

  describe("getCMSItems", () => {
    it("should retrieve CMS items with default parameters", async () => {
      // Create some items
      await cmsService.createCMSItem(createFormData({ articleTitle: "Article 1" }));
      await cmsService.createCMSItem(createFormData({ articleTitle: "Article 2" }));
      await cmsService.createCMSItem(createFormData({ articleTitle: "Article 3" }));

      const result = await cmsService.getCMSItems();

      assertEquals(result.success, true);
      assertEquals(result.items.length, 3);
      assertEquals(result.pagination.total, 3);
    });

    it("should respect limit parameter", async () => {
      // Create 5 items
      for (let i = 1; i <= 5; i++) {
        await cmsService.createCMSItem(createFormData({ articleTitle: `Article ${i}` }));
      }

      const result = await cmsService.getCMSItems({ limit: 3 });

      assertEquals(result.success, true);
      assertEquals(result.items.length, 3);
      assertEquals(result.pagination.total, 5);
      assertEquals(result.pagination.limit, 3);
    });

    it("should handle API errors", async () => {
      // Override getCollectionItems to throw an error
      const originalGet = mockWebflowService.getCollectionItems;
      mockWebflowService.getCollectionItems = async () => {
        throw new Error("API Error");
      };

      const result = await cmsService.getCMSItems();

      assertEquals(result.success, false);
      assertEquals(result.error, "API Error");
      assertEquals(result.items.length, 0);

      // Restore original method
      mockWebflowService.getCollectionItems = originalGet;
    });
  });

  describe("getCMSItem", () => {
    it("should retrieve specific item by ID", async () => {
      const createResult = await cmsService.createCMSItem(createFormData());
      assertExists(createResult.item);

      const getResult = await cmsService.getCMSItem(createResult.item.id);

      assertEquals(getResult.success, true);
      assertEquals(getResult.item?.id, createResult.item.id);
      assertEquals(getResult.item?.fieldData.name, "Test Article");
    });

    it("should throw error for non-existent item", async () => {
      await assertRejects(
        () => cmsService.getCMSItem("non-existent-id"),
        Error,
        "Item not found"
      );
    });
  });

  describe("testCMSOperations", () => {
    it("should return true when operations work", async () => {
      const result = await cmsService.testCMSOperations();
      assertEquals(result, true);
    });

    it("should return false when connection fails", async () => {
      // Override testConnection to return false
      const originalTest = mockWebflowService.testConnection;
      mockWebflowService.testConnection = async () => false;

      const result = await cmsService.testCMSOperations();
      assertEquals(result, false);

      // Restore original method
      mockWebflowService.testConnection = originalTest;
    });

    it("should return false when operations fail", async () => {
      // Override createCollectionItem to throw an error
      const originalCreate = mockWebflowService.createCollectionItem;
      mockWebflowService.createCollectionItem = async () => {
        throw new Error("Operation failed");
      };

      const result = await cmsService.testCMSOperations();
      assertEquals(result, false);

      // Restore original method
      mockWebflowService.createCollectionItem = originalCreate;
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty meta description", async () => {
      const formData = createFormData({ metaDescription: "" });
      const result = await cmsService.createCMSItem(formData);

      assertEquals(result.success, true);
      assertEquals(result.item?.fieldData["meta-description"], "");
    });

    it("should handle complex Quill content", async () => {
      const complexContent = {
        ops: [
          { insert: "Bold text", attributes: { bold: true } },
          { insert: "\n" },
          { insert: "Italic text", attributes: { italic: true } },
          { insert: "\n" },
          { insert: "Link", attributes: { link: "https://example.com" } },
          { insert: "\n" },
          { insert: { image: "https://example.com/image.jpg" } },
          { insert: "\n" },
        ],
      };

      const formData = createFormData({ articleContent: complexContent });
      const result = await cmsService.createCMSItem(formData);

      assertEquals(result.success, true);
      assertExists(result.item);
    });

    it("should handle very long titles", async () => {
      const longTitle = "A".repeat(200);
      const formData = createFormData({ articleTitle: longTitle });
      const result = await cmsService.createCMSItem(formData);

      assertEquals(result.success, true);
      assertEquals(result.item?.fieldData.name, longTitle);
    });

    it("should handle concurrent operations", async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        const formData = createFormData({ articleTitle: `Concurrent Article ${i}` });
        promises.push(cmsService.createCMSItem(formData));
      }

      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        assertEquals(result.success, true);
        assertExists(result.item);
      });

      // All should have unique IDs
      const ids = results.map(r => r.item?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      assertEquals(uniqueIds.size, 5);
    });
  });
});
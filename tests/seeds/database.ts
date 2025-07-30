/// <reference lib="deno.ns" />

import { TestScenarios } from "../fixtures/scenarios.ts";
import { WebflowResponseBuilder } from "../builders/WebflowResponseBuilder.ts";
import { TestDataTracker } from "../utils/test-data.ts";
import type { FormData } from "@/types/form.ts";
import type { WebflowCollectionItem } from "@/types/webflow.ts";

// Global test data tracker
const testDataTracker = new TestDataTracker();

/**
 * Seed test data for integration tests
 */
export async function seedTestData(
  createItem: (data: FormData) => Promise<WebflowCollectionItem>,
): Promise<WebflowCollectionItem[]> {
  const items: WebflowCollectionItem[] = [];

  // Seed various test scenarios
  const testData = [
    { data: TestScenarios.validArticle.complete, tag: "complete" },
    { data: TestScenarios.validArticle.draft, tag: "draft" },
    { data: TestScenarios.edgeCases.specialChars, tag: "special-chars" },
    { data: TestScenarios.edgeCases.unicode, tag: "unicode" },
  ];

  for (const { data, tag } of testData) {
    try {
      // Add test tag to identify test data
      const taggedData = {
        ...data,
        articleTitle: `[TEST-${tag}] ${data.articleTitle}`,
      };

      const item = await createItem(taggedData);
      items.push(item);
      testDataTracker.track("webflow-item", item.id);
    } catch (error) {
      console.error(`Failed to seed test data for ${tag}:`, error);
    }
  }

  return items;
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(
  deleteItem: (id: string) => Promise<void>,
): Promise<void> {
  const trackedItems = testDataTracker.getTrackedItems();

  for (const { type, id } of trackedItems) {
    if (type === "webflow-item") {
      try {
        await deleteItem(id);
      } catch (error) {
        console.error(`Failed to cleanup item ${id}:`, error);
      }
    }
  }

  testDataTracker.clear();
}

/**
 * Create mock data for testing without actual API calls
 */
export function createMockDatabase(): {
  items: Map<string, WebflowCollectionItem>;
  create: (data: FormData) => Promise<WebflowCollectionItem>;
  update: (id: string, data: Partial<FormData>) => Promise<WebflowCollectionItem>;
  delete: (id: string) => Promise<void>;
  get: (id: string) => Promise<WebflowCollectionItem | null>;
  list: () => Promise<WebflowCollectionItem[]>;
  clear: () => void;
} {
  const items = new Map<string, WebflowCollectionItem>();

  return {
    items,

    async create(data: FormData): Promise<WebflowCollectionItem> {
      const item = WebflowResponseBuilder.item({
        fieldData: {
          name: data.articleTitle,
          slug: data.articleTitle.toLowerCase().replace(/\s+/g, "-"),
          "author-name": data.authorName,
          "meta-description": data.metaDescription,
          post: "<p>Mocked HTML content</p>",
          "intro-text": "Mocked intro text",
          "word-count": "100",
          "reading-time": "1 min read",
          "created-on": new Date().toISOString(),
          "updated-on": new Date().toISOString(),
          "published-on": data.publishNow ? new Date().toISOString() : undefined,
        },
        isDraft: !data.publishNow,
      });

      items.set(item.id, item);
      return item;
    },

    async update(id: string, data: Partial<FormData>): Promise<WebflowCollectionItem> {
      const existing = items.get(id);
      if (!existing) {
        throw new Error(`Item ${id} not found`);
      }

      const updated = WebflowResponseBuilder.updateResponse({
        ...existing,
        fieldData: {
          ...existing.fieldData,
          ...(data.articleTitle && { name: data.articleTitle }),
          ...(data.authorName && { "author-name": data.authorName }),
          ...(data.metaDescription && { "meta-description": data.metaDescription }),
        },
      });

      items.set(id, updated);
      return updated;
    },

    async delete(id: string): Promise<void> {
      items.delete(id);
    },

    async get(id: string): Promise<WebflowCollectionItem | null> {
      return items.get(id) || null;
    },

    async list(): Promise<WebflowCollectionItem[]> {
      return Array.from(items.values());
    },

    clear(): void {
      items.clear();
    },
  };
}

/**
 * Seed data for specific test scenarios
 */
export const TestSeeds = {
  /**
   * Seed data for rate limiting tests
   */
  rateLimiting: async (
    createItem: (data: FormData) => Promise<WebflowCollectionItem>,
  ): Promise<void> => {
    // Create items that will trigger rate limits
    const items = TestScenarios.stressTest.rapidFire;
    for (const item of items) {
      await createItem(item);
    }
  },

  /**
   * Seed data for pagination tests
   */
  pagination: async (
    createItem: (data: FormData) => Promise<WebflowCollectionItem>,
  ): Promise<WebflowCollectionItem[]> => {
    const items = TestScenarios.stressTest.largeBatch;
    const created: WebflowCollectionItem[] = [];

    for (const item of items) {
      created.push(await createItem(item));
    }

    return created;
  },

  /**
   * Seed data for search tests
   */
  search: async (
    createItem: (data: FormData) => Promise<WebflowCollectionItem>,
  ): Promise<void> => {
    const searchableItems = [
      { ...TestScenarios.validArticle.minimal, articleTitle: "JavaScript Tutorial" },
      { ...TestScenarios.validArticle.minimal, articleTitle: "TypeScript Guide" },
      { ...TestScenarios.validArticle.minimal, articleTitle: "Deno Handbook" },
      { ...TestScenarios.validArticle.minimal, articleTitle: "Node.js Basics" },
    ];

    for (const item of searchableItems) {
      await createItem(item);
    }
  },
};

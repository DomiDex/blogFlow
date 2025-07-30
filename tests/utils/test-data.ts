/// <reference lib="deno.ns" />

import type { FormData } from "@/types/form.ts";
import type { WebflowCollectionItem } from "@/types/webflow.ts";

/**
 * Utility functions for test data management
 */

/**
 * Create a snapshot of test data for comparison
 */
export function createSnapshot(data: any): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Compare data against a snapshot
 */
export function matchesSnapshot(data: any, snapshot: string): boolean {
  return createSnapshot(data) === snapshot;
}

/**
 * Generate unique test identifiers
 */
export function generateTestId(prefix: string = "test"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Create test data with unique values to avoid conflicts
 */
export function makeUnique<T extends Record<string, any>>(
  data: T,
  fields: string[] = ["name", "title", "slug"],
): T {
  const uniqueId = generateTestId();
  const result = { ...data } as any;

  fields.forEach((field) => {
    if (result[field] && typeof result[field] === "string") {
      result[field] = `${result[field]}-${uniqueId}`;
    }
  });

  return result as T;
}

/**
 * Validate that required fields are present
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[],
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter((field) => !data[field]);
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Clean sensitive data from test objects
 */
export function cleanSensitiveData<T extends Record<string, any>>(data: T): T {
  const sensitiveKeys = ["token", "apiKey", "password", "secret", "authorization"];
  const cleaned = { ...data };

  const clean = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(clean);
    }

    if (obj && typeof obj === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = clean(value);
        }
      }
      return result;
    }

    return obj;
  };

  return clean(cleaned);
}

/**
 * Merge test data with defaults
 */
export function withDefaults<T extends Record<string, any>>(
  data: Partial<T>,
  defaults: T,
): T {
  return { ...defaults, ...data };
}

/**
 * Create variations of test data
 */
export function createVariations<T extends Record<string, any>>(
  base: T,
  variations: Array<Partial<T>>,
): T[] {
  return variations.map((variation) => ({ ...base, ...variation }));
}

/**
 * Generate test data for pagination
 */
export function createPaginatedData<T>(
  itemGenerator: (index: number) => T,
  totalItems: number = 100,
  pageSize: number = 10,
): Array<{ page: number; items: T[] }> {
  const pages: Array<{ page: number; items: T[] }> = [];
  const totalPages = Math.ceil(totalItems / pageSize);

  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, totalItems);
    const items: T[] = [];

    for (let i = start; i < end; i++) {
      items.push(itemGenerator(i));
    }

    pages.push({ page, items });
  }

  return pages;
}

/**
 * Assert that data matches expected shape
 */
export function assertDataShape(
  actual: any,
  expected: Record<string, string>,
): void {
  for (const [key, type] of Object.entries(expected)) {
    if (!(key in actual)) {
      throw new Error(`Missing expected key: ${key}`);
    }

    const actualType = Array.isArray(actual[key]) ? "array" : typeof actual[key];
    if (actualType !== type) {
      throw new Error(`Type mismatch for ${key}: expected ${type}, got ${actualType}`);
    }
  }
}

/**
 * Create test doubles for external services
 */
export function createServiceDouble<T extends Record<string, any>>(
  methods: Array<keyof T>,
): T {
  const double: any = {};

  methods.forEach((method) => {
    double[method] = () => {
      throw new Error(`Method ${String(method)} not implemented in test double`);
    };
  });

  return double as T;
}

/**
 * Track test data for cleanup
 */
export class TestDataTracker {
  private items: Array<{ type: string; id: string }> = [];

  track(type: string, id: string): void {
    this.items.push({ type, id });
  }

  getTrackedItems(): Array<{ type: string; id: string }> {
    return [...this.items];
  }

  clear(): void {
    this.items = [];
  }
}

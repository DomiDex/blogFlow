/// <reference lib="deno.ns" />

/**
 * Central export point for all test data management utilities
 */

// Builders
export { FormDataBuilder } from "../builders/FormDataBuilder.ts";
export { WebflowResponseBuilder } from "../builders/WebflowResponseBuilder.ts";

// Generators
export { ContentGenerator, type ContentGeneratorOptions } from "../generators/content.ts";

// Fixtures
export { getScenario, getScenariosOfType, TestScenarios } from "../fixtures/scenarios.ts";

// Seeds
export { cleanupTestData, createMockDatabase, seedTestData, TestSeeds } from "../seeds/database.ts";

// Utilities
export {
  assertDataShape,
  cleanSensitiveData,
  createPaginatedData,
  createServiceDouble,
  createSnapshot,
  createVariations,
  generateTestId,
  makeUnique,
  matchesSnapshot,
  TestDataTracker,
  validateRequiredFields,
  withDefaults,
} from "../utils/test-data.ts";

// Re-export existing fixtures for backward compatibility
export * from "../fixtures/quill-delta.ts";
export * from "../fixtures/webflow-responses.ts";

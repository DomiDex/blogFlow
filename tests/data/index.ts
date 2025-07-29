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
export { TestScenarios, getScenario, getScenariosOfType } from "../fixtures/scenarios.ts";

// Seeds
export { 
  seedTestData, 
  cleanupTestData, 
  createMockDatabase,
  TestSeeds 
} from "../seeds/database.ts";

// Utilities
export {
  createSnapshot,
  matchesSnapshot,
  generateTestId,
  makeUnique,
  validateRequiredFields,
  cleanSensitiveData,
  withDefaults,
  createVariations,
  createPaginatedData,
  assertDataShape,
  createServiceDouble,
  TestDataTracker,
} from "../utils/test-data.ts";

// Re-export existing fixtures for backward compatibility
export * from "../fixtures/quill-delta.ts";
export * from "../fixtures/webflow-responses.ts";
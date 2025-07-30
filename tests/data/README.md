# Test Data Management

This directory contains utilities for managing test data across all test suites, providing consistent, maintainable, and realistic test data.

## Structure

```
tests/
├── data/
│   ├── index.ts          # Central exports
│   └── README.md         # This file
├── builders/             # Test data builders
│   ├── FormDataBuilder.ts
│   └── WebflowResponseBuilder.ts
├── generators/           # Content generators
│   └── content.ts
├── fixtures/            # Predefined test data
│   ├── scenarios.ts     # Test scenarios
│   ├── quill-delta.ts   # Quill content fixtures
│   └── webflow-responses.ts # API response fixtures
├── seeds/               # Database seeding
│   └── database.ts
└── utils/               # Test utilities
    └── test-data.ts
```

## Quick Start

### Using Builders

```typescript
import { FormDataBuilder } from "@tests/data";

// Create custom test data
const article = new FormDataBuilder()
  .withAuthor("Jane Doe")
  .withTitle("Test Article")
  .published()
  .build();

// Use predefined builders
const minimal = FormDataBuilder.minimal();
const complete = FormDataBuilder.complete();
```

### Using Scenarios

```typescript
import { TestScenarios } from "@tests/data";

// Use predefined scenarios
const validArticle = TestScenarios.validArticle.complete;
const edgeCase = TestScenarios.edgeCases.specialChars;
const invalidData = TestScenarios.invalid.shortContent;

// Get scenario by path
const scenario = getScenario("validArticle.minimal");
```

### Generating Content

```typescript
import { ContentGenerator } from "@tests/data";

// Generate Quill Delta content
const content = ContentGenerator.quillDelta({
  paragraphs: 3,
  includeFormatting: true,
  includeLists: true,
  includeCode: true,
});

// Generate article set
const articles = ContentGenerator.articleSet(10);
```

### Mocking Webflow Responses

```typescript
import { WebflowResponseBuilder } from "@tests/data";

// Create mock responses
const item = WebflowResponseBuilder.item();
const error = WebflowResponseBuilder.error(404);
const collection = WebflowResponseBuilder.collection(items);
```

## Best Practices

### 1. Use Builders for Custom Data

When you need specific test data:

```typescript
const customArticle = new FormDataBuilder()
  .withTitle("Specific Title for Test")
  .withContent(customContent)
  .build();
```

### 2. Use Scenarios for Common Cases

For standard test cases, use predefined scenarios:

```typescript
// Don't create new data for common cases
const article = TestScenarios.validArticle.minimal;

// Do use scenarios that match your test intent
const unicodeTest = TestScenarios.edgeCases.unicode;
```

### 3. Keep Test Data Isolated

Each test should create its own data:

```typescript
it("should handle concurrent requests", () => {
  // Create unique data for this test
  const articles = ContentGenerator.articleSet(5);
  // ... test implementation
});
```

### 4. Clean Up After Tests

Always clean up test data:

```typescript
afterEach(async () => {
  await cleanupTestData(deleteItem);
});
```

### 5. Use Meaningful Names

Make test intent clear:

```typescript
// Good
const articleWithSpecialChars = TestScenarios.edgeCases.specialChars;

// Bad
const testData1 = new FormDataBuilder().build();
```

## Available Scenarios

### Valid Articles

- `minimal` - Minimum valid data
- `complete` - All fields populated
- `draft` - Unpublished article
- `richFormatting` - Complex formatting

### Edge Cases

- `maxLength` - Maximum field lengths
- `specialChars` - Unicode and special characters
- `unicode` - Emoji and international text
- `longContent` - Performance testing
- `reservedWords` - Slug generation edge cases

### Invalid Data

- `missingAuthor` - Missing required field
- `shortContent` - Below minimum word count
- `emptyContent` - No content
- `shortMetaDescription` - Invalid meta description
- `shortTitle` - Title too short

### Stress Testing

- `rapidFire` - Multiple quick submissions
- `concurrent` - Parallel requests
- `largeBatch` - High volume testing

### Security Testing

- `xssAttempt` - XSS injection attempts
- `sqlInjection` - SQL injection attempts
- `htmlInjection` - HTML injection attempts

## Utilities

### Test Data Tracking

```typescript
const tracker = new TestDataTracker();
tracker.track("webflow-item", itemId);
// ... tests run
const tracked = tracker.getTrackedItems();
```

### Data Validation

```typescript
const validation = validateRequiredFields(data, ["authorName", "articleTitle"]);
if (!validation.valid) {
  console.log("Missing fields:", validation.missing);
}
```

### Unique Data Generation

```typescript
const uniqueArticle = makeUnique(article, ["articleTitle", "slug"]);
```

### Snapshot Testing

```typescript
const snapshot = createSnapshot(responseData);
expect(matchesSnapshot(actualData, snapshot)).toBe(true);
```

## Integration with Tests

### Unit Tests

```typescript
describe("SlugService", () => {
  it("should generate unique slug", async () => {
    const article = TestScenarios.validArticle.minimal;
    const slug = await slugService.generateUniqueSlug(article.articleTitle);
    expect(slug).toBeTruthy();
  });
});
```

### Integration Tests

```typescript
describe("Form Submission", () => {
  const { app } = setupIntegrationTest();

  it("should submit valid form", async () => {
    const formData = new FormDataBuilder()
      .withAuthor("Test Author")
      .published()
      .build();

    const response = await app.request("/api/webflow-form", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    expect(response.status).toBe(201);
  });
});
```

### Performance Tests

```typescript
describe("Performance", () => {
  it("should handle large batches", async () => {
    const articles = TestScenarios.stressTest.largeBatch;

    const start = performance.now();
    for (const article of articles) {
      await processArticle(article);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5000);
  });
});
```

## Extending the System

### Adding New Builders

Create new builders in `tests/builders/`:

```typescript
export class CustomBuilder {
  // Implementation
}
```

### Adding New Scenarios

Add to `tests/fixtures/scenarios.ts`:

```typescript
export const TestScenarios = {
  // ... existing scenarios

  customScenario: {
    myTest: new FormDataBuilder()
      .withTitle("Custom Test")
      .build(),
  },
};
```

### Adding New Generators

Add to `tests/generators/`:

```typescript
export class CustomGenerator {
  static generate(): any {
    // Implementation
  }
}
```

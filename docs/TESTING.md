# Testing Guide

## Overview

This project uses Deno's built-in testing framework with BDD-style tests for comprehensive quality assurance. Our testing strategy covers unit tests, integration tests, performance benchmarks, and memory leak detection.

## Table of Contents

- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Mocking Guidelines](#mocking-guidelines)
- [Coverage Goals](#coverage-goals)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Test Structure

```
tests/
├── unit/               # Unit tests for individual components
│   ├── services/       # Service layer tests
│   └── utils/          # Utility function tests
├── integration/        # Integration tests for API endpoints
│   ├── *.test.ts      # Standard integration tests
│   └── *.mock.test.ts # Mocked integration tests
├── performance/        # Performance and benchmark tests
│   ├── benchmark.test.ts
│   └── memory.test.ts
├── fixtures/           # Test data and mock responses
│   ├── quill-delta.ts
│   └── webflow-responses.ts
├── helpers/            # Test utilities and setup
│   ├── mock-app.ts    # Mock application setup
│   ├── test-env.ts    # Test environment config
│   └── test-utils.ts  # Testing utilities
└── mocks/             # Mock implementations
    └── webflow-service.ts
```

## Running Tests

### All Tests
```bash
deno task test
```

### Unit Tests Only
```bash
deno task test:unit
# or
deno test tests/unit --no-check --allow-all
```

### Integration Tests
```bash
deno task test:integration
# or
deno test tests/integration --no-check --allow-all
```

### Performance Tests
```bash
deno task test:performance
# or
deno test tests/performance --no-check --allow-all --allow-hrtime
```

### With Coverage
```bash
deno task test:coverage
# or
deno run --allow-all scripts/coverage.ts
```

### Watch Mode
```bash
deno task test:watch
# or
deno test --watch --no-check
```

### Specific Test File
```bash
deno test tests/unit/services/slugService.test.ts --no-check --allow-all
```

### Filter Tests
```bash
deno test --filter="should generate unique slug" --no-check --allow-all
```

## Writing Tests

### Test File Naming Conventions

- Unit tests: `*.test.ts`
- Integration tests: `*.test.ts` or `*.integration.test.ts`
- Mocked integration tests: `*.mock.test.ts`
- Performance tests: `*.bench.ts` or in `performance/` directory

### Basic Test Structure

```typescript
/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";

describe("Component Name", () => {
  let service: Service;
  
  beforeEach(() => {
    // Setup before each test
    service = new Service();
  });
  
  afterEach(() => {
    // Cleanup after each test
    service.cleanup();
  });
  
  describe("Feature/Method", () => {
    it("should do something specific", () => {
      // Arrange
      const input = "test";
      
      // Act
      const result = service.doSomething(input);
      
      // Assert
      assertEquals(result, "expected");
    });
    
    it("should handle edge cases", () => {
      // Test edge cases
    });
    
    it("should handle errors gracefully", () => {
      // Test error scenarios
    });
  });
});
```

### Async Tests

```typescript
it("should handle async operations", async () => {
  const result = await service.asyncOperation();
  assertExists(result);
});
```

### Testing Errors

```typescript
it("should throw on invalid input", () => {
  assertThrows(
    () => service.doSomething(null),
    Error,
    "Expected error message"
  );
});

it("should reject with error", async () => {
  await assertRejects(
    () => service.asyncOperation(),
    Error,
    "Expected error message"
  );
});
```

## Mocking Guidelines

### 1. Mock External Dependencies

```typescript
// Create mock service
const mockWebflowService = {
  async createItem(data: any) {
    return { id: "test-123", ...data };
  },
  async checkSlugExists(slug: string) {
    return { exists: false };
  }
};

// Use in tests
const service = new MyService(mockWebflowService);
```

### 2. Mock HTTP Requests

```typescript
// Setup mock fetch
const originalFetch = globalThis.fetch;
globalThis.fetch = createMockFetch(new Map([
  ["https://api.example.com/data", createMockResponse({ data: "test" })]
]));

// Restore after test
afterEach(() => {
  globalThis.fetch = originalFetch;
});
```

### 3. Mock Environment Variables

```typescript
import { setupTestEnvironment, restoreTestEnvironment } from "../helpers/test-env.ts";

// At the top of test file
setupTestEnvironment();

// After all tests
globalThis.addEventListener("unload", () => {
  restoreTestEnvironment();
});
```

### 4. Use Test Fixtures

```typescript
import * as fixtures from "../fixtures/quill-delta.ts";

it("should process complex content", () => {
  const result = processor.process(fixtures.COMPLEX_DELTA);
  assertExists(result);
});
```

## Coverage Goals

### Target Coverage Levels

- **Overall**: 80% minimum
- **Critical paths**: 95% minimum
- **New code**: 90% minimum
- **Services**: 85% minimum
- **Utils**: 90% minimum

### Checking Coverage

```bash
# Generate coverage report
deno task test:coverage

# View HTML report
open coverage/html/index.html
```

### Improving Coverage

1. Identify uncovered code in the coverage report
2. Add tests for missing branches and error cases
3. Test edge cases and boundary conditions
4. Ensure error paths are covered

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - uses: denoland/setup-deno@v1
      with:
        deno-version: v1.x
    
    - name: Run Tests
      run: deno task test
    
    - name: Generate Coverage
      run: deno task test:coverage
    
    - name: Upload Coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/coverage.lcov
```

## Best Practices

### 1. Test Organization

- Group related tests using `describe` blocks
- Use descriptive test names that explain what is being tested
- Follow the Arrange-Act-Assert pattern
- Keep tests focused and test one thing at a time

### 2. Test Data

- Use realistic test data
- Create reusable fixtures for common scenarios
- Avoid hardcoding values - use constants or fixtures
- Clean up test data after tests

### 3. Async Operations

- Always await async operations
- Use proper cleanup in afterEach hooks
- Test both success and failure paths
- Handle promise rejections

### 4. Performance

- Keep unit tests fast (< 50ms each)
- Mock external dependencies
- Use beforeEach/afterEach efficiently
- Avoid unnecessary setup/teardown

### 5. Maintainability

- Keep tests DRY but readable
- Extract common setup to helper functions
- Update tests when implementation changes
- Document complex test scenarios

## Troubleshooting

### Common Issues

#### 1. Resource Leaks
```
error: Leaking async ops or resources
```

**Solution**: Ensure all timers, intervals, and async operations are cleaned up:
```typescript
afterEach(() => {
  service.destroy(); // Clean up timers
  restore(); // Restore stubs
});
```

#### 2. Import Errors
```
error: Module not found
```

**Solution**: Check import paths and ensure all dependencies are available:
```typescript
// Use import maps
import { Service } from "@services/service.ts";
```

#### 3. Permission Errors
```
error: Requires env permission
```

**Solution**: Run tests with proper permissions:
```bash
deno test --allow-all
```

#### 4. Flaky Tests

**Solution**: 
- Avoid time-dependent tests
- Mock Date.now() and timers
- Use explicit waits instead of arbitrary timeouts
- Ensure proper test isolation

### Debugging Tests

```bash
# Run specific test with more output
deno test --filter="test name" --allow-all

# Run with --inspect for debugging
deno test --inspect-brk --allow-all

# Check for type errors
deno check tests/unit/mytest.test.ts
```

## Future Enhancements

- [ ] Visual regression testing for UI components
- [ ] Load testing for API endpoints
- [ ] Security testing (OWASP compliance)
- [ ] Mutation testing for test quality
- [ ] Contract testing with Webflow API
- [ ] E2E tests with real browser automation
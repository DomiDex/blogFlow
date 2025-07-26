# Webflow Middleware Development Rules

## Code Quality Standards

### 1. DRY (Don't Repeat Yourself)
- Extract common logic into utility functions in `/src/utils/`
- Create reusable middleware components for cross-cutting concerns
- Use configuration objects and constants instead of hardcoded values
- Implement service classes for complex business logic
- Create generic error handlers instead of repetitive try-catch blocks

### 2. Single Responsibility Principle
- Each module should have one clear purpose
- Services handle external integrations (Webflow API)
- Utils contain pure functions without side effects
- Middleware handles request/response modifications
- Routes only orchestrate, never contain business logic

### 3. Type Safety
- Always define explicit TypeScript types/interfaces
- Use Zod schemas for runtime validation AND type inference
- Avoid `any` type - use `unknown` with proper type guards
- Export shared types from `/src/types/index.ts`
- Prefer type inference over explicit typing where obvious

### 4. Error Handling
- Use custom error classes extending base `AppError`
- Always include error context (request ID, operation, field)
- Map external errors to internal error types
- Return consistent error response format
- Log errors with appropriate severity levels

### 5. Async/Await Patterns
- Always use async/await over raw promises
- Handle promise rejections properly
- Use Promise.all() for parallel operations
- Implement proper timeout handling for external calls
- Never mix callbacks with promises

## Project-Specific Rules

### 6. Webflow API Integration
- Always include retry logic with exponential backoff
- Check rate limits before making requests
- Validate API responses with Zod schemas
- Cache slug lookups to minimize API calls
- Handle all documented error codes explicitly

### 7. Content Processing
- Sanitize ALL user input, especially Quill content
- Validate field lengths against Webflow limits
- Strip HTML for text-only fields (slug, intro)
- Preserve formatting only in designated rich text fields
- Handle edge cases (empty content, malformed Delta)

### 8. Security Best Practices
- Never log sensitive data (API tokens, full requests)
- Implement request signing for webhooks
- Use environment variables for all configuration
- Validate CORS origins against allowlist
- Implement rate limiting per IP and globally

### 9. Performance Optimization
- Use streaming for large content processing
- Implement connection pooling for API clients
- Cache frequently accessed data (slug checks)
- Minimize middleware chain for each route
- Use early returns to avoid unnecessary processing

### 10. Testing Requirements
- Write tests BEFORE implementation (TDD)
- Minimum 80% code coverage for services
- Test error scenarios, not just happy paths
- Use fixtures for complex test data
- Mock external dependencies consistently

## Code Style Guidelines

### 11. Naming Conventions
```typescript
// Services: PascalCase with "Service" suffix
class WebflowService { }

// Utils: camelCase, descriptive verbs
function generateUniqueSlug() { }

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Interfaces: PascalCase with "I" prefix for models
interface IArticleData { }

// Types: PascalCase, descriptive nouns
type WebflowResponse = { }

// Files: kebab-case matching exports
// webflow-service.ts, content-processor.ts
```

### 12. Function Design
- Max 30 lines per function (extract if larger)
- Max 3 parameters (use options object if more)
- Return early for guard clauses
- One return type per function
- Document complex algorithms inline

### 13. Module Organization
```typescript
// Standard import order
// 1. Deno standard library
import { serve } from "@std/http/server";

// 2. External dependencies  
import { Hono } from "@hono/hono";
import { z } from "zod";

// 3. Internal - absolute paths
import { config } from "@/config";

// 4. Internal - relative paths
import { validateRequest } from "./utils";

// 5. Types last
import type { WebflowItem } from "@/types";
```

### 14. Comments and Documentation
- Use JSDoc for public APIs
- Explain WHY, not WHAT
- Document edge cases and gotchas
- Keep comments up-to-date with code
- No commented-out code in commits

### 15. Git Commit Standards
```bash
# Format: <type>(<scope>): <subject>
feat(api): add retry logic to Webflow client
fix(validation): handle empty Quill deltas
docs(readme): update deployment instructions
test(slug): add collision handling tests
refactor(middleware): extract rate limit logic

# Types: feat, fix, docs, test, refactor, perf, chore
# Scope: api, validation, middleware, config, etc.
# Subject: imperative mood, no period
```

## Development Workflow

### 16. Branch Strategy
- `main` - production ready code
- `develop` - integration branch
- `feature/<task-number>-<description>` - new features
- `fix/<issue>-<description>` - bug fixes
- Always branch from `develop`, PR back to `develop`

### 17. Code Review Checklist
- [ ] Types are properly defined
- [ ] Error handling is comprehensive
- [ ] Tests cover edge cases
- [ ] No hardcoded values
- [ ] Security implications considered
- [ ] Performance impact assessed
- [ ] Documentation updated

### 18. Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Environment variables documented
- [ ] API rate limits configured
- [ ] Error monitoring enabled
- [ ] Health checks verified

## Anti-Patterns to Avoid

### 19. Common Mistakes
```typescript
// ❌ BAD: Nested ternaries
const status = isValid ? isPublished ? 'live' : 'draft' : 'error';

// ✅ GOOD: Early returns or switch
if (!isValid) return 'error';
return isPublished ? 'live' : 'draft';

// ❌ BAD: Modifying parameters
function processData(data: Data) {
  data.field = transform(data.field); // mutates input
}

// ✅ GOOD: Return new object
function processData(data: Data): ProcessedData {
  return { ...data, field: transform(data.field) };
}

// ❌ BAD: Catching and ignoring errors
try {
  await riskyOperation();
} catch (e) {
  // silently fails
}

// ✅ GOOD: Handle or propagate meaningfully
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new OperationError('Failed to complete operation', { cause: error });
}
```

### 20. Performance Pitfalls
- Don't await in loops - use Promise.all()
- Don't parse/stringify repeatedly - cache results
- Don't make unnecessary API calls - batch when possible
- Don't block event loop - use workers for CPU tasks
- Don't ignore memory leaks - clean up intervals/timeouts
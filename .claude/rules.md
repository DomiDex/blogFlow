# Claude Rules for Webflow Middleware Project

## Project Context
You are working on a Deno-based middleware that processes Webflow form submissions (with Quill.js rich text) and creates CMS entries via Webflow API v2.

## Code Quality Principles

### 1. Type Safety is Mandatory
- Never use `any` - use `unknown` with type guards
- Define explicit return types for all functions
- Use Zod for runtime validation AND type inference
- Export shared types from `/src/types/`

### 2. Error Handling Pattern
```typescript
// Always wrap external calls
try {
  const result = await externalCall();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new AppError('User-friendly message', { 
    code: 'OPERATION_FAILED',
    cause: error 
  });
}
```

### 3. DRY Code Rules
- If you write similar code twice, extract it
- Use services for business logic
- Use utils for pure functions
- Use middleware for cross-cutting concerns
- Constants go in `config/constants.ts`

### 4. Async Best Practices
```typescript
// ❌ Never
for (const item of items) {
  await processItem(item); // Sequential - slow!
}

// ✅ Always
await Promise.all(items.map(item => processItem(item)));
```

### 5. Security First
- Sanitize ALL user input with DOMPurify
- Validate request data with Zod
- Never log sensitive data (tokens, passwords)
- Check CORS origins against allowlist
- Implement rate limiting

## Project-Specific Patterns

### 6. Webflow API Calls
```typescript
// Always include:
// - Bearer token auth
// - Retry with exponential backoff
// - Rate limit checking
// - Response validation
// - Error mapping
```

### 7. Content Processing Flow
1. Validate Quill Delta format
2. Convert to HTML
3. Sanitize HTML
4. Extract metadata (slug, reading time, intro)
5. Map to CMS fields
6. Validate final structure

### 8. Field Mapping Rules
- Form has 4 fields → CMS needs 18 fields
- Auto-generate: slug, reading-time, intro-text, timestamps
- Preserve field name mappings exactly
- Handle missing/empty fields gracefully

### 9. Testing Requirements
- Test-first development (TDD)
- Cover error cases, not just success
- Use fixtures for complex data
- Mock all external dependencies
- Minimum 80% coverage

### 10. Performance Guidelines
- Cache slug lookups (expensive API call)
- Use streaming for large content
- Implement request queuing for rate limits
- Early return on validation failures
- Batch API operations when possible

## Code Style

### Naming Conventions
- Services: `WebflowService` (PascalCase + Service)
- Utils: `generateSlug()` (camelCase verb)
- Constants: `MAX_RETRY_COUNT` (SCREAMING_SNAKE)
- Types: `ArticleData` (PascalCase noun)
- Files: `webflow-service.ts` (kebab-case)

### File Structure
```typescript
// 1. Imports (ordered)
import { std } from "@std/lib";
import { external } from "npm:package";
import { internal } from "@/utils";
import type { Type } from "@/types";

// 2. Types/Interfaces
interface LocalType {}

// 3. Constants
const LOCAL_CONST = 42;

// 4. Main export
export function main() {}

// 5. Helper functions
function helper() {}
```

### Function Rules
- Max 30 lines (extract if larger)
- Single responsibility
- Early returns for guards
- Descriptive names
- JSDoc for public APIs

## Common Tasks

### When asked to "create endpoint":
1. Add route with validation middleware
2. Validate request with Zod
3. Process with proper error handling
4. Return consistent response format
5. Add integration test

### When asked to "handle errors":
1. Create custom error class
2. Include error code and context
3. Map to HTTP status code
4. Log with appropriate level
5. Return user-friendly message

### When asked to "process content":
1. Validate input format
2. Transform/convert data
3. Sanitize if needed
4. Generate metadata
5. Return typed result

## Anti-Patterns to Avoid
- Nested ternaries
- Modifying parameters
- Silent error catching
- Hardcoded values
- Synchronous loops with async operations
- Missing timeout handling
- Unvalidated external data

## Quick Decisions
- Validation library: Always Zod
- HTTP framework: Always Hono
- Test framework: Deno built-in
- Logging: Structured JSON
- Error format: Consistent AppError
- Date handling: Native Date or date-fns
- HTML sanitization: DOMPurify only
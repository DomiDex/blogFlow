# Subagent Instructions: Webflow Middleware Technical Research

## Project Context

You are tasked with gathering comprehensive technical information to create a detailed implementation guide for a Deno-based middleware server. This server will bridge Webflow forms with Webflow CMS using the Hono framework.

## Core Requirements

### 1. Webflow API v2 Research

**Primary Resource**: https://developers.webflow.com/data/v2.0.0/reference/rest-introduction

Gather information on:

- Authentication methods (specifically Bearer token implementation)
- CMS Collections API endpoints:
  - GET /collections/{collection_id}/items (for checking existing slugs)
  - POST /collections/{collection_id}/items (for creating items)
  - POST /collections/{collection_id}/items/{item_id}/publish
- Request/response formats and field mapping
- Rate limits (requests per minute/hour)
- Error codes and handling patterns
- Required headers and API versioning

### 2. Form Data Specifications

The form collects 4 fields that need to be mapped to an 18-field CMS collection:

**Form Fields** (source):

- Author Name: text input
- Article Title: text input
- Meta description: text input
- Your article: Quill.js rich text editor

**CMS Fields** (destination - from provided CSV):

- Name (String)
- Slug (String) - must be auto-generated
- Collection ID (String)
- Locale ID (String)
- Item ID (String)
- Archived (Boolean)
- Draft (Boolean)
- Created On (String)
- Updated On (String)
- Published On (String)
- Feature image (String)
- post (String) - main content field
- Reading Time (String) - must be calculated
- Meta description (String)
- intro text (String) - must be extracted
- Canonical link (String)
- author (String)
- author Name (String)

### 3. Technical Implementation Research

#### Deno + Hono Setup

- Latest Deno server setup with TypeScript
- Hono framework integration for Deno
- Middleware patterns in Hono
- CORS configuration for Webflow forms
- Environment variable management in Deno

#### Quill.js Processing

- Quill Delta format structure
- Converting Quill Delta to HTML
- Best libraries/methods for Delta-to-HTML conversion
- Handling formatting (bold, italic, headers, lists)
- Image handling in Quill content

#### Content Processing Algorithms

- Slug generation:
  - URL-safe character conversion
  - Uniqueness checking against existing CMS items
  - Length limits (Webflow typically 100 chars)
- Reading time calculation:
  - Industry standard WPM (words per minute)
  - HTML tag stripping for word count
  - Minimum reading time considerations
- Intro text extraction:
  - First 160 characters best practice
  - HTML tag handling
  - Ellipsis addition

#### Security Considerations

- Input validation strategies
- HTML sanitization to prevent XSS
- Rate limiting implementation
- API key security in Deno
- CORS policy configuration

### 4. Deployment Research

#### Deno Deploy

- Deployment configuration files
- Environment variable setup
- Build and deployment commands
- Monitoring and logging setup
- Auto-scaling considerations

#### Production Best Practices

- Error handling patterns
- Retry logic for API calls
- Request/response logging
- Performance optimization
- Health check endpoints

### 5. Code Architecture Research

Investigate best practices for:

- Project structure for Deno/Hono applications
- Service layer patterns
- Middleware organization
- Type safety with TypeScript
- Testing strategies for Deno

### 6. Additional Considerations

- Webhook implementation (if Webflow sends form data via webhook)
- Batch processing capabilities
- Data transformation middleware patterns
- API response caching strategies
- Monitoring and alerting setup

## Deliverable Format

Create a comprehensive guide with:

1. Step-by-step implementation phases
2. Complete code examples for each component
3. Configuration templates
4. Testing procedures
5. Deployment instructions
6. Troubleshooting section

## Recommended Project Folder Structure

```
root/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── config/
│   │   ├── index.ts              # Configuration loader
│   │   └── constants.ts          # Application constants
│   ├── middleware/
│   │   ├── cors.ts               # CORS configuration
│   │   ├── errorHandler.ts       # Global error handling
│   │   ├── rateLimiter.ts        # Rate limiting middleware
│   │   ├── requestLogger.ts      # Request/response logging
│   │   ├── security.ts           # Security headers
│   │   └── validation.ts         # Request validation middleware
│   ├── routes/
│   │   ├── index.ts              # Route registration
│   │   ├── health.ts             # Health check endpoint
│   │   └── webflow.ts            # Webflow form endpoint
│   ├── services/
│   │   ├── webflowService.ts     # Webflow API client
│   │   ├── contentProcessor.ts   # Quill.js to HTML conversion
│   │   └── metadataGenerator.ts  # Slug, reading time, etc.
│   ├── utils/
│   │   ├── validation.ts         # Zod schemas
│   │   ├── sanitizer.ts          # HTML sanitization
│   │   ├── logger.ts             # Logging utilities
│   │   └── errors.ts             # Custom error classes
│   └── types/
│       ├── webflow.ts            # Webflow type definitions
│       ├── form.ts               # Form data interfaces
│       └── index.ts              # Shared type exports
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── contentProcessor.test.ts
│   │   │   └── metadataGenerator.test.ts
│   │   └── utils/
│   │       └── validation.test.ts
│   ├── integration/
│   │   ├── webflowApi.test.ts
│   │   └── formSubmission.test.ts
│   └── fixtures/
│       ├── quillContent.json     # Sample Quill.js data
│       └── mockResponses.json    # Mock API responses
├── scripts/
│   ├── dev.ts                    # Development server with hot reload
│   ├── test-form.ts              # Test form submission script
│   └── check-env.ts              # Environment validation script
├── .env.example                  # Environment variable template
├── .env                          # Local environment variables (gitignored)
├── .gitignore
├── deno.json                     # Deno configuration and import map
├── deno.lock                     # Dependency lock file
├── README.md                     # Project documentation
├── DEPLOYMENT.md                 # Deployment instructions
└── docker-compose.yml            # Local development setup (optional)
```

### Key Folder Descriptions

- **src/config/**: Centralized configuration management
- **src/middleware/**: Reusable middleware components for cross-cutting concerns
- **src/routes/**: API endpoint definitions and route handlers
- **src/services/**: Business logic and external API integrations
- **src/utils/**: Shared utility functions and helpers
- **src/types/**: TypeScript type definitions and interfaces
- **tests/**: Comprehensive test suite with unit and integration tests
- **scripts/**: Development and deployment utility scripts

## Project Dependencies

### Core Dependencies

```json
// deno.json
{
  "tasks": {
    "dev": "deno run --watch --allow-net --allow-env --allow-read src/main.ts",
    "start": "deno run --allow-net --allow-env src/main.ts",
    "test": "deno test --allow-net --allow-env --allow-read",
    "deploy": "deployctl deploy --project=webflow-middleware --prod src/main.ts",
    "check": "deno check src/**/*.ts && deno lint && deno fmt --check"
  },
  "imports": {
    // Core framework
    "@hono/hono": "jsr:@hono/hono@^4.4.0",

    // Hono middleware and utilities
    "@hono/zod-validator": "jsr:@hono/zod-validator@^0.2.0",
    "@hono/cors": "jsr:@hono/hono/cors",
    "@hono/logger": "jsr:@hono/hono/logger",

    // Validation
    "zod": "npm:zod@^3.23.0",

    // Quill.js processing
    "quill-delta-to-html": "npm:quill-delta-to-html@^0.12.0",

    // HTML sanitization
    "dompurify": "npm:dompurify@^3.0.0",
    "jsdom": "npm:jsdom@^24.0.0",

    // Utilities
    "slugify": "npm:slugify@^1.6.6",
    "reading-time": "npm:reading-time@^1.5.0",

    // Testing (dev dependencies)
    "@std/testing": "jsr:@std/testing@^0.218.0",
    "@std/assert": "jsr:@std/assert@^0.218.0",

    // Standard library utilities
    "@std/dotenv": "jsr:@std/dotenv@^0.218.0",
    "@std/fmt": "jsr:@std/fmt@^0.218.0",
    "@std/http": "jsr:@std/http@^0.218.0"
  },
  "lint": {
    "include": ["src/"],
    "exclude": ["tests/fixtures/"],
    "rules": {
      "tags": ["recommended"]
    }
  },
  "fmt": {
    "include": ["src/", "tests/"],
    "exclude": ["tests/fixtures/"],
    "options": {
      "useTabs": false,
      "lineWidth": 100,
      "indentWidth": 2,
      "singleQuote": false,
      "proseWrap": "preserve"
    }
  }
}
```

### Dependency Descriptions

#### Core Framework

- **@hono/hono**: Lightweight web framework optimized for edge computing
- **@hono/zod-validator**: Request validation middleware using Zod schemas
- **@hono/cors**: CORS handling for cross-origin requests from Webflow
- **@hono/logger**: HTTP request/response logging

#### Data Processing

- **zod**: TypeScript-first schema validation
- **quill-delta-to-html**: Convert Quill.js Delta format to HTML
- **dompurify + jsdom**: HTML sanitization to prevent XSS attacks
- **slugify**: Generate URL-safe slugs from titles
- **reading-time**: Calculate estimated reading time from content

#### Deno Standard Library

- **@std/testing**: Testing utilities and assertions
- **@std/dotenv**: Environment variable loading for development
- **@std/fmt**: Code formatting utilities
- **@std/http**: HTTP utilities and status codes

### Optional Dependencies (for enhanced features)

```json
// Additional imports for extended functionality
{
  "imports": {
    // Caching
    "redis": "npm:redis@^4.6.0",

    // Monitoring
    "pino": "npm:pino@^8.19.0",

    // Rate limiting with Redis
    "rate-limiter-flexible": "npm:rate-limiter-flexible@^3.0.0",

    // API client utilities
    "ky": "npm:ky@^1.2.0",

    // Date handling
    "date-fns": "npm:date-fns@^3.3.0"
  }
}
```

### Development Tools

```bash
# Install Deno (if not already installed)
curl -fsSL https://deno.land/install.sh | sh

# Install Deno Deploy CLI
deno install -Arf jsr:@deno/deployctl

# Install development tools
deno install --allow-read --allow-write --allow-env -n denon https://deno.land/x/denon/denon.ts
```

### Version Considerations

- Use JSR (JavaScript Registry) for Deno-native packages when available
- Pin major versions to ensure stability
- For npm packages, use the `npm:` specifier
- Keep Deno standard library modules synchronized to the same version

## Detailed Explanation of Complicated Parts

### 1. Quill.js Delta Format Processing

Quill.js stores content in Delta format, which is a JSON structure describing text and formatting operations. Understanding this is crucial for proper conversion.

**Delta Structure Example:**

```json
{
  "ops": [
    { "insert": "Hello " },
    { "insert": "World", "attributes": { "bold": true } },
    { "insert": "\n", "attributes": { "header": 1 } },
    { "insert": "This is a list:\n" },
    { "insert": "Item 1\n", "attributes": { "list": "bullet" } },
    { "insert": "Item 2\n", "attributes": { "list": "bullet" } }
  ]
}
```

**Conversion Complexity:**

- Each operation (`op`) can have text and/or formatting attributes
- Block-level formatting (headers, lists) is applied to newline characters
- Inline formatting (bold, italic) is applied to text
- Images are stored as special insert operations with base64 or URLs

**Key Implementation Details:**

```typescript
// Complex aspects to handle:
// 1. Nested formatting (bold + italic + link)
// 2. Converting list operations to proper <ul>/<ol> tags
// 3. Handling embedded images and videos
// 4. Preserving whitespace and line breaks correctly
// 5. Converting Quill's custom attributes to valid HTML
```

### 2. Webflow API Authentication and Request Format

**Bearer Token Authentication:**

```typescript
// The token must be included in EVERY request
headers: {
  "Authorization": `Bearer ${WEBFLOW_API_TOKEN}`,
  "Content-Type": "application/json",
  "accept-version": "1.0.0" // API versioning
}
```

**Complex Field Mapping:** Webflow expects fields in a specific nested structure:

```typescript
{
  "fieldData": {
    // Field names must match EXACTLY with Webflow's internal field names
    // These often differ from display names
    "name": "Article Title",
    "slug": "article-title-2024",
    "_archived": false, // Note the underscore prefix
    "_draft": true,
    // Custom fields don't have underscores
    "author-name": "John Doe",
    "post": "<p>HTML content</p>"
  },
  "isDraft": true // Separate from fieldData
}
```

**Common Pitfalls:**

- Field names are case-sensitive and must match exactly
- Some fields use underscores, others use hyphens
- Boolean fields might need string values ("true"/"false")
- Date fields require ISO 8601 format

### 3. Rate Limiting Implementation

**In-Memory Rate Limiting Complexity:**

```typescript
// Complex aspects:
// 1. Memory cleanup for expired entries
// 2. Distributed rate limiting (multiple server instances)
// 3. Different limits for different endpoints
// 4. Handling time window resets

const rateLimitStore = new Map<
  string,
  {
    count: number;
    resetTime: number;
    firstRequest: number;
  }
>();

// Cleanup mechanism to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime + 60000) {
      // 1 minute buffer
      rateLimitStore.delete(key);
    }
  }
}, 300000); // Clean every 5 minutes
```

**Advanced Patterns:**

- Sliding window vs fixed window algorithms
- Token bucket implementation for burst handling
- IP extraction behind proxies (X-Forwarded-For)
- Rate limit headers (X-RateLimit-Remaining)

### 4. Middleware Execution Order in Hono

**Critical Order Dependencies:**

```typescript
// Order matters! Middleware executes top to bottom
app.use('*', requestIdMiddleware); // Must be first for logging
app.use('*', logger()); // Needs request ID
app.use('*', cors()); // Before routes for preflight
app.use('*', securityHeaders); // After CORS
app.use('*', rateLimiter); // Before expensive operations
app.use('*', errorHandler); // Wraps everything

// Route-specific middleware
app.post('/api/*', authenticate); // Only for API routes
app.post('/api/*', validateApiKey); // After authentication
```

**Execution Flow:**

1. Request enters → middleware executes in order
2. Route handler executes
3. Response returns ← middleware executes in reverse order

### 5. Zod Validation with Custom Error Messages

**Complex Validation Patterns:**

```typescript
const articleContentSchema = z
  .object({
    ops: z.array(z.any()).refine(
      (ops) => {
        // Custom validation for Quill content
        return (
          ops.length > 0 &&
          ops.some((op) => op.insert && op.insert.trim().length > 0)
        );
      },
      { message: 'Article content cannot be empty' }
    ),
  })
  .transform((data) => {
    // Transform during validation
    return {
      ...data,
      ops: data.ops.filter((op) => op.insert !== '\n\n\n'), // Remove excessive newlines
    };
  });

// Async validation for unique slugs
const slugSchema = z.string().refine(
  async (slug) => {
    const exists = await checkSlugExists(slug);
    return !exists;
  },
  { message: 'This slug is already in use' }
);
```

### 6. HTML Sanitization Security Considerations

**XSS Prevention Complexity:**

```typescript
// Dangerous content that must be sanitized:
// 1. <script> tags and JavaScript URLs
// 2. Event handlers (onclick, onerror, etc.)
// 3. Dangerous protocols (javascript:, data:)
// 4. Style tags with expressions
// 5. Object/embed tags

const sanitizeConfig = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'img',
    'pre',
    'code',
  ],
  ALLOWED_ATTR: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    '*': ['class'], // Allow classes for styling
  },
  ALLOWED_PROTOCOLS: ['http', 'https', 'mailto'],
  FORCE_BODY: true,
  // Custom hooks for additional processing
  BEFORE_SANITIZE: (node: any, data: any) => {
    // Pre-processing logic
  },
};
```

### 7. Unique Slug Generation with Collision Handling

**Complexity Points:**

```typescript
// Issues to handle:
// 1. Unicode characters in titles
// 2. Maximum length constraints (Webflow: 100 chars)
// 3. Reserved slugs (admin, api, etc.)
// 4. Concurrent slug creation (race conditions)
// 5. SEO-friendly slug generation

async function generateUniqueSlug(title: string): Promise<string> {
  // Step 1: Basic slug generation
  let baseSlug = title
    .toLowerCase()
    .normalize('NFKD') // Normalize Unicode
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric
    .replace(/^-+|-+$/g, '') // Trim hyphens
    .substring(0, 80); // Leave room for counters

  // Step 2: Check reserved words
  const reserved = ['admin', 'api', 'app', 'blog', 'docs'];
  if (reserved.includes(baseSlug)) {
    baseSlug = `post-${baseSlug}`;
  }

  // Step 3: Handle collisions with retry logic
  let slug = baseSlug;
  let attempts = 0;

  while (await checkSlugExists(slug)) {
    attempts++;
    // Use timestamp for uniqueness after 10 attempts
    slug =
      attempts > 10 ? `${baseSlug}-${Date.now()}` : `${baseSlug}-${attempts}`;
  }

  return slug;
}
```

### 8. Reading Time Calculation Algorithm

**Complex Factors:**

```typescript
// Considerations for accurate reading time:
// 1. Different reading speeds for different content types
// 2. Code blocks read slower than regular text
// 3. Images add viewing time
// 4. Lists are scanned faster than paragraphs
// 5. Technical content reads slower

function calculateReadingTime(html: string): number {
  const $ = cheerio.load(html);

  // Different WPM rates
  const rates = {
    text: 238, // Average adult reading speed
    code: 150, // Code is read slower
    technical: 200, // Technical content
  };

  let totalWords = 0;
  let codeWords = 0;
  let imageCount = 0;

  // Extract text content
  $('body')
    .find('*')
    .each((_, element) => {
      const $el = $(element);

      if ($el.is('pre, code')) {
        const words = $el.text().split(/\s+/).length;
        codeWords += words;
      } else if ($el.is('img')) {
        imageCount++;
      }
    });

  // Calculate regular text words
  const textContent = $('body').text();
  const regularWords = textContent.split(/\s+/).length - codeWords;

  // Calculate time
  const textTime = regularWords / rates.text;
  const codeTime = codeWords / rates.code;
  const imageTime = imageCount * 0.2; // 12 seconds per image

  const totalMinutes = textTime + codeTime + imageTime;

  return Math.max(1, Math.ceil(totalMinutes));
}
```

### 9. Error Handling and Recovery Patterns

**Complex Error Scenarios:**

```typescript
// Different error types need different handling:
// 1. Validation errors → 400 with field details
// 2. Webflow API errors → Pass through status codes
// 3. Network timeouts → Retry with backoff
// 4. Rate limits → 429 with retry-after
// 5. Unexpected errors → 500 with correlation ID

class ErrorHandler {
  static async handleWebflowError(error: any): Promise<Response> {
    // Webflow-specific error codes
    const errorMap = {
      COLLECTION_NOT_FOUND: 404,
      INVALID_FIELD_DATA: 400,
      RATE_LIMITED: 429,
      UNAUTHORIZED: 401,
    };

    // Extract Webflow error details
    if (error.response?.data?.code) {
      const code = error.response.data.code;
      const status = errorMap[code] || 500;

      return new Response(
        JSON.stringify({
          error: error.response.data.message,
          code: code,
          details: error.response.data.details,
          requestId: crypto.randomUUID(),
        }),
        { status }
      );
    }

    // Generic error handling
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        requestId: crypto.randomUUID(),
      }),
      { status: 500 }
    );
  }
}
```

### 10. Deno Deploy Configuration Complexities

**Environment and Deployment Issues:**

```typescript
// Deno Deploy limitations and workarounds:
// 1. No file system writes (use KV store instead)
// 2. Limited CPU time (optimize algorithms)
// 3. No native modules (use pure JS alternatives)
// 4. Environment variables must be set via CLI or dashboard

// deno.json for deployment
{
  "tasks": {
    // Development with all permissions
    "dev": "deno run --watch --allow-all src/main.ts",

    // Production with minimal permissions
    "start": "deno run --allow-net --allow-env=WEBFLOW_API_TOKEN,PORT src/main.ts",

    // Type checking before deployment
    "check": "deno check src/**/*.ts && deno lint",

    // Bundle for edge deployment
    "build": "deno bundle src/main.ts dist/bundle.js"
  },
  "deploy": {
    "project": "webflow-middleware",
    "exclude": ["tests/**", "scripts/**", ".env*"],
    "include": ["src/**", "deno.json"]
  }
}
```

**KV Store for Persistence:**

```typescript
// Replace file-based storage with Deno KV
const kv = await Deno.openKv();

// Store rate limit data
await kv.set(
  ['rateLimit', clientIP],
  {
    count: 1,
    resetTime: Date.now() + windowMs,
  },
  { expireIn: windowMs }
);

// Atomic operations for concurrent requests
await kv
  .atomic()
  .check({ key: ['slug', slug], versionstamp: null })
  .set(['slug', slug], true)
  .commit();
```

## Detailed Webflow Form Implementation

### 1. Webflow Form Structure and Setup

The form must be configured in Webflow with specific attributes and structure to properly send data to the middleware server.

**HTML Structure in Webflow:**

```html
<form
  id="article-submission-form"
  data-name="Article Submission Form"
  method="POST"
  action="https://your-middleware-server.deno.dev/api/webflow-form"
  class="article-form"
>
  <!-- Author Name Field -->
  <div class="form-field-wrapper">
    <label for="author-name" class="form-label">Author Name*</label>
    <input
      type="text"
      id="author-name"
      name="authorName"
      class="form-input w-input"
      maxlength="100"
      placeholder="Enter your full name"
      required
    />
    <div class="form-error-message" data-error-for="authorName">
      Please enter your name
    </div>
  </div>

  <!-- Article Title Field -->
  <div class="form-field-wrapper">
    <label for="article-title" class="form-label">Article Title*</label>
    <input
      type="text"
      id="article-title"
      name="articleTitle"
      class="form-input w-input"
      maxlength="200"
      placeholder="Enter a compelling title for your article"
      required
    />
    <div class="form-error-message" data-error-for="articleTitle">
      Please enter an article title
    </div>
  </div>

  <!-- Meta Description Field -->
  <div class="form-field-wrapper">
    <label for="meta-description" class="form-label">Meta Description*</label>
    <textarea
      id="meta-description"
      name="metaDescription"
      class="form-textarea w-input"
      maxlength="300"
      rows="3"
      placeholder="Write a brief description of your article (for SEO)"
      required
    ></textarea>
    <div class="character-count">
      <span id="meta-description-count">0</span>/300
    </div>
    <div class="form-error-message" data-error-for="metaDescription">
      Please enter a meta description
    </div>
  </div>

  <!-- Quill.js Editor Container -->
  <div class="form-field-wrapper">
    <label for="article-content" class="form-label">Your Article*</label>
    <div id="article-editor" class="quill-editor-container">
      <!-- Quill toolbar -->
      <div id="toolbar" class="quill-toolbar">
        <span class="ql-formats">
          <select class="ql-header">
            <option selected>Normal</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>
        </span>
        <span class="ql-formats">
          <button class="ql-bold"></button>
          <button class="ql-italic"></button>
          <button class="ql-underline"></button>
          <button class="ql-strike"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-list" value="ordered"></button>
          <button class="ql-list" value="bullet"></button>
          <button class="ql-blockquote"></button>
          <button class="ql-code-block"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-link"></button>
          <button class="ql-image"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-clean"></button>
        </span>
      </div>
      <!-- Quill editor -->
      <div id="editor" class="quill-content"></div>
    </div>
    <!-- Hidden input to store Quill content -->
    <input type="hidden" name="articleContent" id="article-content-input" />
    <div class="form-error-message" data-error-for="articleContent">
      Please write your article content
    </div>
  </div>

  <!-- Publish Options -->
  <div class="form-field-wrapper">
    <label class="checkbox-label w-checkbox">
      <input
        type="checkbox"
        name="publishNow"
        id="publish-now"
        class="checkbox w-checkbox-input"
      />
      <span class="checkbox-text">Publish immediately</span>
    </label>
    <div class="form-help-text">Leave unchecked to save as draft</div>
  </div>

  <!-- Submit Button -->
  <div class="form-submit-wrapper">
    <button type="submit" class="submit-button w-button" id="submit-button">
      Submit Article
    </button>
    <div class="submit-loading" style="display: none;">
      <div class="spinner"></div>
      <span>Submitting your article...</span>
    </div>
  </div>

  <!-- Success/Error Messages -->
  <div class="form-success-message w-form-done" style="display: none;">
    <div>Thank you! Your article has been submitted successfully.</div>
  </div>
  <div class="form-error-message w-form-fail" style="display: none;">
    <div>Oops! Something went wrong. Please try again.</div>
  </div>
</form>
```

### 2. Webflow Form Settings Configuration

**In Webflow Designer:**

1. **Form Settings:**

   - Method: POST
   - Action: Your middleware endpoint URL
   - Name: "Article Submission Form"

2. **Form Notifications:**

   - Disable default Webflow form notifications
   - Disable form submission email (handled by middleware)

3. **Custom Attributes to Add:**

   ```
   data-custom-submit="true"
   data-api-endpoint="https://your-middleware-server.deno.dev/api/webflow-form"
   ```

### 3. JavaScript Implementation for Form Handling

**Complete client-side code to embed in Webflow:**

```javascript
<!-- Include Quill.js -->
<link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
<script src="https://cdn.quilljs.com/1.3.7/quill.js"></script>

<script>
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Quill editor
  const quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: '#toolbar',
      clipboard: {
        matchVisual: false // Prevent formatting issues
      }
    },
    placeholder: 'Write your article here...',
    formats: [
      'header', 'bold', 'italic', 'underline', 'strike',
      'blockquote', 'code-block', 'list', 'link', 'image'
    ]
  });

  // Character counter for meta description
  const metaDescTextarea = document.getElementById('meta-description');
  const metaDescCount = document.getElementById('meta-description-count');

  metaDescTextarea.addEventListener('input', function() {
    const length = this.value.length;
    metaDescCount.textContent = length;

    // Add warning class if near limit
    if (length > 280) {
      metaDescCount.classList.add('warning');
    } else {
      metaDescCount.classList.remove('warning');
    }
  });

  // Form submission handler
  const form = document.getElementById('article-submission-form');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Clear previous errors
    document.querySelectorAll('.form-error-message').forEach(el => {
      el.style.display = 'none';
    });

    // Validate Quill content
    const content = quill.getContents();
    const text = quill.getText().trim();

    if (text.length < 50) {
      showError('articleContent', 'Article must be at least 50 characters long');
      return;
    }

    // Store Quill content in hidden input
    document.getElementById('article-content-input').value = JSON.stringify(content);

    // Show loading state
    const submitButton = document.getElementById('submit-button');
    const loadingDiv = document.querySelector('.submit-loading');
    submitButton.style.display = 'none';
    loadingDiv.style.display = 'flex';

    // Prepare form data
    const formData = {
      authorName: form.authorName.value.trim(),
      articleTitle: form.articleTitle.value.trim(),
      metaDescription: form.metaDescription.value.trim(),
      articleContent: content,
      publishNow: form.publishNow.checked
    };

    try {
      // Submit to middleware
      const response = await fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      // Success handling
      form.style.display = 'none';
      document.querySelector('.form-success-message').style.display = 'block';

      // Optional: Redirect after success
      setTimeout(() => {
        window.location.href = `/articles/${result.item.slug}`;
      }, 2000);

    } catch (error) {
      // Error handling
      console.error('Submission error:', error);

      if (error.field) {
        showError(error.field, error.message);
      } else {
        document.querySelector('.form-error-message.w-form-fail').style.display = 'block';
      }
    } finally {
      // Reset loading state
      submitButton.style.display = 'block';
      loadingDiv.style.display = 'none';
    }
  });

  // Helper function to show field errors
  function showError(fieldName, message) {
    const errorEl = document.querySelector(`[data-error-for="${fieldName}"]`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';

      // Scroll to error
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Auto-save draft functionality
  let autoSaveTimer;
  quill.on('text-change', function() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      saveDraft();
    }, 5000); // Auto-save after 5 seconds of inactivity
  });

  function saveDraft() {
    const draftData = {
      authorName: form.authorName.value,
      articleTitle: form.articleTitle.value,
      metaDescription: form.metaDescription.value,
      articleContent: quill.getContents(),
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('articleDraft', JSON.stringify(draftData));
    console.log('Draft saved');
  }

  // Load draft on page load
  const savedDraft = localStorage.getItem('articleDraft');
  if (savedDraft) {
    const draft = JSON.parse(savedDraft);
    const loadDraft = confirm('Found a saved draft. Would you like to load it?');

    if (loadDraft) {
      form.authorName.value = draft.authorName || '';
      form.articleTitle.value = draft.articleTitle || '';
      form.metaDescription.value = draft.metaDescription || '';

      if (draft.articleContent) {
        quill.setContents(draft.articleContent);
      }
    }
  }
});
</script>
```

### 4. CSS Styling for Webflow Custom Code

```css
<style>
/* Quill Editor Styling */
.quill-editor-container {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  overflow: hidden;
}

.quill-toolbar {
  border: none;
  border-bottom: 1px solid #e5e5e5;
  background: #f8f9fa;
}

.quill-content {
  min-height: 300px;
  max-height: 600px;
  overflow-y: auto;
}

.ql-editor {
  font-size: 16px;
  line-height: 1.6;
  padding: 20px;
}

/* Character counter */
.character-count {
  text-align: right;
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}

.character-count .warning {
  color: #ff6b6b;
  font-weight: bold;
}

/* Loading state */
.submit-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #666;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Error states */
.form-error-message {
  color: #dc3545;
  font-size: 14px;
  margin-top: 5px;
  display: none;
}

.form-field-wrapper.error .form-input,
.form-field-wrapper.error .form-textarea {
  border-color: #dc3545;
}

/* Success message */
.form-success-message {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}
</style>
```

### 5. Webflow Custom Attributes and Settings

**Essential Form Attributes:**

```
Form Element:
- data-name: "Article Submission Form"
- data-redirect: "/thank-you" (optional)
- data-custom-submit: "true"

Input Fields:
- name: Must match expected JSON keys (authorName, articleTitle, etc.)
- required: Add to enforce client-side validation
- maxlength: Enforce character limits

Hidden Fields:
- Store Quill Delta JSON
- CSRF token (if implementing)
- User ID (if authenticated)
```

### 6. Security Considerations for the Form

1. **CSRF Protection:**

   ```javascript
   // Generate and validate CSRF tokens
   const csrfToken = generateCSRFToken();
   formData.csrfToken = csrfToken;
   ```

2. **Input Validation:**

   - Client-side: Basic validation for UX
   - Server-side: Comprehensive validation (never trust client)

3. **Rate Limiting:**

   - Implement client-side submission throttling
   - Server-side rate limiting per IP

4. **Content Security:**

   - Sanitize Quill content server-side
   - Validate image URLs
   - Prevent script injection

### 7. Testing the Form Integration

**Test Scenarios:**

1. Valid submission with all fields
2. Missing required fields
3. Exceeding character limits
4. Empty Quill editor
5. Network failure handling
6. Draft save/load functionality
7. Concurrent submissions
8. XSS attempts in rich text

## Priority Information

Focus on:

1. Exact Webflow API v2 request formats
2. Quill.js to HTML conversion accuracy
3. Production-ready error handling
4. Security best practices
5. Clear code examples that can be directly implemented

## Research Method

1. Start with official documentation (Webflow API, Deno, Hono)
2. Look for recent (2024-2025) implementation examples
3. Verify current best practices for each technology
4. Cross-reference multiple sources for accuracy
5. Prioritize official sources over community content

The final guide should be suitable for implementation with Claude Code or similar AI coding assistants, with clear phases that can be executed step-by-step.

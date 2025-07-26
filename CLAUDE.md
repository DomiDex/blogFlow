# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Webflow Form to CMS Middleware project - a Deno-based server that bridges Webflow forms with Webflow CMS using the Hono framework. The system processes article submissions from a Quill.js rich text editor and creates properly formatted CMS entries with 18 fields from 4 form inputs.

## Key Technologies

- **Runtime**: Deno (latest)
- **Framework**: Hono (edge-optimized web framework)
- **API**: Webflow API v2
- **Content Processing**: Quill.js Delta to HTML conversion
- **Validation**: Zod schemas
- **Deployment**: Deno Deploy

## Development Commands

```bash
# Development with hot reload
deno task dev

# Run production server
deno task start

# Run all tests
deno task test

# Deploy to Deno Deploy
deno task deploy

# Type check, lint, and format check
deno task check

# Check environment configuration
deno run --allow-env --allow-read scripts/check-env.ts

# Test form submission
deno run --allow-net --allow-env scripts/test-form.ts
```

## Architecture

### Request Flow
1. Webflow form submits to `/api/webflow-form` endpoint
2. CORS middleware validates origin
3. Rate limiter checks request limits
4. Zod validates form data structure
5. Quill Delta converts to sanitized HTML
6. Metadata generator creates slug, reading time, intro text
7. Field mapper transforms 4 fields to 18 CMS fields
8. Webflow API client creates/publishes CMS item
9. Response returned with item details or error

### Core Services

- **WebflowService**: Handles all Webflow API v2 operations with retry logic
- **ContentProcessor**: Converts Quill.js Delta format to HTML
- **MetadataGenerator**: Creates slugs, calculates reading time, extracts intro text
- **FieldMapper**: Maps form fields to CMS structure with proper formatting

### Middleware Stack (Order Matters)
1. Request ID generation
2. Logger (needs request ID)
3. CORS (before routes)
4. Security headers
5. Rate limiting
6. Error handler (wraps all routes)

## Field Mappings

Form inputs map to CMS fields:
- `authorName` → `author-name` 
- `articleTitle` → `name`
- `metaDescription` → `meta-description`
- `articleContent` (Quill Delta) → `post` (HTML)

Auto-generated fields:
- `slug`: From title, unique, max 100 chars
- `reading-time`: Based on word count (238 WPM)
- `intro-text`: First 160 chars of content
- Timestamps: `created-on`, `updated-on`, `published-on`

## Critical Implementation Details

### Webflow API Authentication
```typescript
headers: {
  "Authorization": `Bearer ${WEBFLOW_API_TOKEN}`,
  "Content-Type": "application/json",
  "accept-version": "1.0.0"
}
```

### Quill Delta Processing
- Handle nested formatting (bold + italic + link)
- Convert list operations to proper HTML tags
- Preserve whitespace and line breaks
- Block formatting applies to newline characters

### Slug Generation
- Normalize Unicode characters
- Check uniqueness against existing CMS items
- Handle reserved words (admin, api, etc.)
- Add timestamp suffix after 10 collision attempts

### Rate Limiting
- In-memory store with cleanup interval
- Configurable via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX_REQUESTS
- Returns 429 with retry-after header

## Task Implementation Order

Follow the numbered tasks in `/tasks` directory:
1. **Phase 1 (01-05)**: Environment setup and configuration
2. **Phase 2 (06-10)**: Core middleware infrastructure
3. **Phase 3 (11-15)**: Webflow API integration
4. **Phase 4 (16-20)**: Content processing pipeline
5. **Phase 5 (21-23)**: Business logic implementation
6. **Phase 6 (24-26)**: Testing setup
7. **Phase 7 (27-30)**: Deployment preparation

## Environment Variables

Required in `.env`:
- `WEBFLOW_API_TOKEN`: Bearer token for API v2
- `WEBFLOW_COLLECTION_ID`: Target CMS collection
- `WEBFLOW_SITE_ID`: Webflow site identifier

## Testing Approach

- Unit tests for services and utilities
- Integration tests for API endpoints
- Test fixtures in `tests/fixtures/` for Quill content and API responses
- Mock Webflow API responses for development

## Deployment Notes

- Deno Deploy limitations: No file writes, use KV store for persistence
- Environment variables set via Deploy dashboard
- Health check endpoint at `/health` for monitoring
- Automatic HTTPS and global CDN included
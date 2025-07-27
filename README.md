# Webflow Form to CMS Middleware

A Deno-based middleware server that processes form submissions from Webflow and creates CMS entries.

## Features
- Processes Quill.js rich text content
- Auto-generates slugs and metadata
- Validates and sanitizes input
- Creates Webflow CMS items via API v2

## Setup
See individual task files in `/tasks` directory for setup instructions.

## Development
```bash
deno task dev
```

## Testing
```bash
deno task test
```

## Deployment
See DEPLOYMENT.md for production deployment instructions.
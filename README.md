# Webflow Form to CMS Middleware

A high-performance Deno-based middleware server that bridges Webflow forms with Webflow CMS, enabling seamless article submission and publishing workflows.

## 🚀 Overview

This middleware processes rich-text article submissions from Webflow forms, transforms the content, generates metadata, and creates properly formatted CMS entries using the Webflow API v2. Built with Deno and Hono for edge-optimized performance.

## ✨ Features

- **Rich Text Processing**: Converts Quill.js Delta format to clean, sanitized HTML
- **Smart Metadata Generation**:
  - Auto-generates SEO-friendly slugs
  - Calculates reading time (based on 238 WPM)
  - Extracts intro text from content
  - Handles Unicode and special characters
- **Robust Validation**:
  - Zod schema validation
  - Content sanitization with DOMPurify
  - Minimum word count enforcement
- **Production-Ready**:
  - Rate limiting with sliding window
  - Comprehensive error handling
  - Security headers (CSP, CORS, etc.)
  - Request/response logging
  - Retry logic for API failures

## 📋 Prerequisites

- [Deno](https://deno.land/) v1.40+ installed
- Webflow account with API access
- Webflow CMS collection configured

## 🛠️ Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/webflow-form-middleware.git
cd webflow-form-middleware
```

2. Create `.env` file:

```bash
cp .env.example .env
```

3. Configure environment variables:

```env
# Required
WEBFLOW_API_TOKEN=your_api_token_here
WEBFLOW_COLLECTION_ID=your_collection_id_here
WEBFLOW_SITE_ID=your_site_id_here

# Optional (with defaults)
PORT=8000
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGINS=https://yourdomain.webflow.io,http://localhost:3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
```

## 🚀 Quick Start

### Development

```bash
# Run with hot-reload
deno task dev

# Run tests
deno task test

# Type check and lint
deno task check
```

### Production

```bash
# Start production server
deno task start

# Deploy to Deno Deploy
deno task deploy
```

## 📡 API Endpoints

### POST `/api/webflow-form`

Processes form submission and creates CMS item.

**Request Body:**

```json
{
  "authorName": "Jane Smith",
  "articleTitle": "Getting Started with Deno",
  "metaDescription": "Learn how to build modern web applications with Deno",
  "articleContent": {
    "ops": [{ "insert": "Your article content here..." }]
  },
  "publishNow": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "item_123",
    "slug": "getting-started-with-deno",
    "isPublished": false
  }
}
```

### GET `/health`

Health check endpoint for monitoring.

## 🧪 Testing

```bash
# Run all tests
deno task test

# Run unit tests only
deno task test:unit

# Run integration tests
deno task test:integration

# Generate coverage report
deno task test:coverage

# Run tests in watch mode
deno task test:watch
```

## 📁 Project Structure

```
├── src/
│   ├── config/          # Configuration management
│   ├── middleware/      # Express-style middleware
│   │   ├── cors.ts      # CORS configuration
│   │   ├── errorHandler.ts
│   │   ├── logger.ts
│   │   ├── rateLimiter.ts
│   │   └── security.ts  # Security headers
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   │   ├── cmsService.ts
│   │   ├── contentProcessor.ts
│   │   ├── fieldMapper.ts
│   │   ├── metadataGenerator.ts
│   │   ├── slugService.ts
│   │   └── webflowService.ts
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Utilities
│   ├── app.ts          # App factory
│   └── main.ts         # Entry point
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   ├── fixtures/       # Test data
│   └── helpers/        # Test utilities
├── scripts/            # Utility scripts
├── docs/               # Documentation
└── deno.json          # Deno configuration
```

## 🔧 Configuration

### Webflow CMS Collection

Your Webflow CMS collection should have these fields:

| Field Name       | Field ID         | Type       | Required |
| ---------------- | ---------------- | ---------- | -------- |
| Name             | name             | Plain Text | Yes      |
| Slug             | slug             | Plain Text | Yes      |
| Author Name      | author-name      | Plain Text | Yes      |
| Meta Description | meta-description | Plain Text | No       |
| Post Content     | post             | Rich Text  | Yes      |
| Intro Text       | intro-text       | Plain Text | No       |
| Word Count       | word-count       | Number     | No       |
| Reading Time     | reading-time     | Plain Text | No       |
| Published On     | published-on     | Date/Time  | No       |

### Rate Limiting

Configure rate limits via environment variables:

- `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 10)

## 🚀 Deployment

### Deno Deploy

1. Install Deno Deploy CLI:

```bash
deno install -Arf jsr:@deno/deployctl
```

2. Deploy:

```bash
deno task deploy
```

3. Set environment variables in Deno Deploy dashboard

### Self-Hosted

1. Build and run with Docker:

```bash
docker build -t webflow-middleware .
docker run -p 8000:8000 --env-file .env webflow-middleware
```

2. Or use PM2:

```bash
pm2 start --interpreter="deno" --interpreter-args="run --allow-net --allow-env" src/main.ts
```

## 📊 Monitoring

- Health endpoint: `GET /health`
- Structured JSON logging
- Request ID tracking
- Performance metrics in logs

## 🔒 Security

- CORS protection with configurable origins
- Rate limiting per IP
- Security headers (CSP, HSTS, etc.)
- Input validation and sanitization
- API token authentication
- No sensitive data in logs

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Deno](https://deno.land/) and [Hono](https://hono.dev/)
- Uses [Webflow API v2](https://developers.webflow.com/)
- Rich text processing with [quill-delta-to-html](https://github.com/nozer/quill-delta-to-html)

## 📞 Support

- Create an issue for bug reports or feature requests
- Check [docs/](docs/) for detailed documentation

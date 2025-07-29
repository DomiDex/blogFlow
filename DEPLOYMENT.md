# Deployment Guide

This guide covers how to deploy the Webflow Form to CMS Middleware application to Deno Deploy.

## Prerequisites

- Deno installed locally (v1.40+)
- Webflow API credentials
- Deno Deploy account (free tier available)

## Environment Setup

### 1. Configure Environment Variables

Copy the example environment files and configure them:

```bash
# For local development
cp .env.example .env

# For preview/staging
cp .env.example .env.preview

# For production
cp .env.example .env.production
```

### 2. Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `WEBFLOW_API_TOKEN` | Your Webflow API token with 'Bearer' prefix | `Bearer wf_xxxxx` |
| `WEBFLOW_COLLECTION_ID` | The ID of your blog collection | `123456789abcdef` |
| `WEBFLOW_SITE_ID` | Your Webflow site ID | `987654321fedcba` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `https://example.com` |

### 3. Check Environment Configuration

```bash
# Verify your environment is correctly configured
deno task deploy:check
```

## Deployment Methods

### Method 1: Using Deployment Scripts (Recommended)

#### Preview Deployment

```bash
# Deploy to preview environment
deno task deploy:preview
```

#### Production Deployment

```bash
# Deploy to production
deno task deploy:prod
```

### Method 2: Using deployctl Directly

```bash
# Install deployctl
deno install -Arf jsr:@deno/deployctl

# Deploy to preview
deployctl deploy --project=webflow-middleware src/main.ts

# Deploy to production
deployctl deploy --project=webflow-middleware --prod src/main.ts
```

### Method 3: GitHub Actions (CI/CD)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Deno Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      
      - name: Run tests
        run: deno test --allow-all
      
      - name: Deploy to Deno Deploy
        uses: denoland/deployctl@v1
        with:
          project: webflow-middleware
          entrypoint: src/main.ts
          production: ${{ github.ref == 'refs/heads/main' }}
```

## Local Testing

### Preview Mode

Run the application in preview mode with hot reload:

```bash
deno task preview

# With custom port
deno task preview --port=3000

# Open browser automatically
deno task preview --open
```

### Build for Production

Create an optimized build:

```bash
deno task build

# With bundling
deno task build --bundle
```

## Health Monitoring

The application provides several health check endpoints:

- `/health` - Detailed health status including memory usage and dependencies
- `/health/ready` - Readiness probe for load balancers
- `/health/metrics` - Prometheus-compatible metrics
- `/ping` - Simple liveness check

Example health check:

```bash
curl https://your-app.deno.dev/health
```

## Production Best Practices

### 1. Security

- Never commit `.env` files
- Use strong API tokens
- Configure CORS appropriately
- Enable HSTS in production

### 2. Performance

- Monitor memory usage via `/health` endpoint
- Use the metrics endpoint for monitoring
- Configure appropriate rate limits

### 3. Monitoring

Set up monitoring for:
- Response times
- Error rates
- Memory usage
- Rate limit violations

### 4. Rollback Strategy

If deployment fails:

```bash
# List recent deployments
deployctl deployments list --project=webflow-middleware

# Rollback to previous deployment
deployctl deployments rollback --project=webflow-middleware
```

## Troubleshooting

### Environment Variables Not Loading

```bash
# Check current environment
deno task deploy:check

# Verify .env file exists
ls -la .env*
```

### Deployment Fails

1. Check logs in Deno Deploy dashboard
2. Verify all tests pass: `deno test --allow-all`
3. Check type errors: `deno check src/**/*.ts`
4. Verify environment variables are set in Deno Deploy

### API Connection Issues

1. Verify Webflow API token is valid
2. Check collection ID exists
3. Monitor `/health` endpoint for API connectivity

## Scaling Considerations

Deno Deploy automatically scales your application based on traffic. Consider:

- Rate limiting configuration for high traffic
- Caching strategies for Webflow API calls
- Monitoring memory usage under load

## Cost Optimization

- Use preview deployments for testing
- Monitor usage in Deno Deploy dashboard
- Configure appropriate rate limits
- Enable response compression (already configured)

## Support

For deployment issues:
- Check Deno Deploy status: https://status.deno.com/
- Review logs in Deno Deploy dashboard
- File issues: https://github.com/your-org/webflow-middleware/issues
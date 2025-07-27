# Task: Setup Hono Framework

## Priority: High

## Description

Initialize the Hono web framework as the core of the middleware application. Set up the basic application structure with proper typing and middleware support.

## Dependencies

- 03-configure-dependencies.md (Dependencies must be configured)

## Implementation Steps

1. **Create Main Application Entry Point**

   ```typescript
   // src/main.ts
   import { Hono } from '@hono/hono';
   import { serve } from '@std/http/server';
   import { config } from '@config/index';
   import { registerRoutes } from '@routes/index';
   import { registerMiddleware } from '@middleware/index';

   // Create Hono app with strict typing
   const app = new Hono();

   // Register global middleware
   registerMiddleware(app);

   // Register routes
   registerRoutes(app);

   // Start server
   const port = config.PORT || 8000;
   console.log(`⚡ Server running on http://localhost:${port}`);

   serve(app.fetch, { port });
   ```

2. **Create Middleware Registration**

   ```typescript
   // src/middleware/index.ts
   import type { Hono } from '@hono/hono';
   import { cors } from '@hono/cors';
   import { logger } from '@hono/logger';

   export function registerMiddleware(app: Hono): void {
     // Logger must be first
     app.use('*', logger());

     // CORS configuration
     app.use(
       '*',
       cors({
         origin: ['https://*.webflow.io', 'https://*.webflow.com'],
         allowMethods: ['POST', 'GET', 'OPTIONS'],
         allowHeaders: ['Content-Type', 'Authorization'],
         exposeHeaders: ['X-Request-Id'],
         maxAge: 86400,
         credentials: true,
       })
     );

     // Additional middleware will be added in subsequent tasks
   }
   ```

3. **Create Route Registration**

   ```typescript
   // src/routes/index.ts
   import type { Hono } from '@hono/hono';
   import { healthRoutes } from './health';
   import { webflowRoutes } from './webflow';

   export function registerRoutes(app: Hono): void {
     // Health check routes
     app.route('/', healthRoutes);

     // Webflow form submission routes
     app.route('/api', webflowRoutes);

     // 404 handler
     app.notFound((c) => {
       return c.json(
         {
           error: 'Not Found',
           message: 'The requested endpoint does not exist',
           path: c.req.path,
         },
         404
       );
     });
   }
   ```

4. **Create Basic Health Check Route**

   ```typescript
   // src/routes/health.ts
   import { Hono } from '@hono/hono';

   export const healthRoutes = new Hono();

   healthRoutes.get('/health', (c) => {
     return c.json({
       status: 'healthy',
       timestamp: new Date().toISOString(),
       service: 'webflow-middleware',
       version: '1.0.0',
     });
   });

   healthRoutes.get('/', (c) => {
     return c.json({
       message: 'Webflow Form to CMS Middleware',
       endpoints: {
         health: '/health',
         form: '/api/webflow-form',
       },
     });
   });
   ```

5. **Create Webflow Route Placeholder**

   ```typescript
   // src/routes/webflow.ts
   import { Hono } from '@hono/hono';

   export const webflowRoutes = new Hono();

   // Placeholder - will be implemented in later tasks
   webflowRoutes.post('/webflow-form', async (c) => {
     return c.json({
       message: 'Webflow form endpoint - implementation pending',
       received: true,
     });
   });
   ```

6. **Test the Setup**

   ```bash
   # Run the development server
   deno task dev

   # In another terminal, test the health endpoint
   curl http://localhost:8000/health

   # Test CORS preflight
   curl -X OPTIONS http://localhost:8000/api/webflow-form \
     -H "Origin: https://example.webflow.io" \
     -H "Access-Control-Request-Method: POST"
   ```

## Acceptance Criteria

- [ ] Hono application initializes without errors
- [ ] Server starts on configured port
- [ ] Health check endpoint returns 200 OK
- [ ] CORS is properly configured for Webflow domains
- [ ] 404 handler returns proper error response
- [ ] Middleware executes in correct order
- [ ] TypeScript types are properly configured

## Estimated Time

1-2 hours

## Resources

- [Hono Documentation](https://hono.dev/)
- [Hono Middleware Guide](https://hono.dev/middleware/builtin/cors)
- Middleware setup from big_plan.md (lines 154-161)
- [Deno HTTP Server](https://deno.land/std/http/server.ts)
- websearch
- think

# Task: Configure Environment Variables

## Priority: High

## Description

Set up environment variable management for both development and production environments. Create configuration loader with validation and type safety.

## Dependencies

- 03-configure-dependencies.md (Need @std/dotenv)
- 04-setup-hono-framework.md (Application structure)

## Implementation Steps

1. **Create .env.example File**

   ```bash
   # .env.example
   # Server Configuration
   PORT=8000
   NODE_ENV=development

   # Webflow API Configuration
   WEBFLOW_API_TOKEN=your_webflow_api_token_here
   WEBFLOW_COLLECTION_ID=your_collection_id_here
   WEBFLOW_SITE_ID=your_site_id_here

   # Security
   CORS_ORIGINS=https://*.webflow.io,https://*.webflow.com
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX_REQUESTS=10

   # Optional: Monitoring
   SENTRY_DSN=
   LOG_LEVEL=info
   ```

2. **Create Configuration Loader**

   ```typescript
   // src/config/index.ts
   import { load } from '@std/dotenv';
   import { z } from 'zod';

   // Load environment variables in development
   if (Deno.env.get('NODE_ENV') !== 'production') {
     await load();
   }

   // Define configuration schema
   const configSchema = z.object({
     // Server
     PORT: z.coerce.number().default(8000),
     NODE_ENV: z
       .enum(['development', 'test', 'production'])
       .default('development'),

     // Webflow API
     WEBFLOW_API_TOKEN: z.string().min(1),
     WEBFLOW_COLLECTION_ID: z.string().min(1),
     WEBFLOW_SITE_ID: z.string().min(1),

     // Security
     CORS_ORIGINS: z
       .string()
       .transform((val) => val.split(',').map((origin) => origin.trim())),
     RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
     RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),

     // Optional
     SENTRY_DSN: z.string().optional(),
     LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
   });

   // Parse and validate configuration
   function loadConfig() {
     try {
       const env = Object.fromEntries(
         Object.entries(Deno.env.toObject()).filter(
           ([key]) => configSchema.shape[key as keyof typeof configSchema.shape]
         )
       );

       return configSchema.parse(env);
     } catch (error) {
       if (error instanceof z.ZodError) {
         console.error('❌ Configuration validation failed:');
         console.error(error.format());
         Deno.exit(1);
       }
       throw error;
     }
   }

   export const config = loadConfig();
   export type Config = typeof config;
   ```

3. **Create Constants File**

   ```typescript
   // src/config/constants.ts
   export const API_VERSION = '1.0.0';
   export const SERVICE_NAME = 'webflow-middleware';

   // Webflow API
   export const WEBFLOW_API_BASE_URL = 'https://api.webflow.com/v2';
   export const WEBFLOW_API_VERSION = '1.0.0';

   // Field mappings
   export const CMS_FIELD_MAPPINGS = {
     // Form fields -> CMS fields
     authorName: 'author-name',
     articleTitle: 'name',
     metaDescription: 'meta-description',
     articleContent: 'post',
   } as const;

   // Content processing
   export const READING_SPEED_WPM = {
     text: 238,
     code: 150,
     technical: 200,
   } as const;

   export const SLUG_CONFIG = {
     maxLength: 100,
     reservedSlugs: ['admin', 'api', 'app', 'blog', 'docs'],
   } as const;

   export const CONTENT_LIMITS = {
     minArticleLength: 50,
     introTextLength: 160,
     maxTitleLength: 200,
     maxMetaDescriptionLength: 300,
   } as const;
   ```

4. **Create Environment Validation Script**

   ```typescript
   // scripts/check-env.ts
   import { config } from '@config/index';

   console.log('🔍 Checking environment configuration...');

   // Check required variables
   const required = [
     'WEBFLOW_API_TOKEN',
     'WEBFLOW_COLLECTION_ID',
     'WEBFLOW_SITE_ID',
   ];

   const missing = required.filter(
     (key) => !config[key as keyof typeof config]
   );

   if (missing.length > 0) {
     console.error('❌ Missing required environment variables:');
     missing.forEach((key) => console.error(`  - ${key}`));
     Deno.exit(1);
   }

   // Test Webflow API token format
   if (!config.WEBFLOW_API_TOKEN.startsWith('Bearer ')) {
     console.warn("⚠️  WEBFLOW_API_TOKEN should include 'Bearer ' prefix");
   }

   console.log('✅ Environment configuration is valid!');
   console.log('🌍 Environment:', config.NODE_ENV);
   console.log('🔗 Port:', config.PORT);
   console.log(
     '🔒 Rate limit:',
     `${config.RATE_LIMIT_MAX_REQUESTS} requests per ${config.RATE_LIMIT_WINDOW_MS}ms`
   );
   ```

5. **Create Local .env File**

   ```bash
   # Copy example and fill in your values
   cp .env.example .env

   # Edit .env with your actual values
   # Make sure .env is in .gitignore!
   ```

6. **Test Configuration**
   ```bash
   # Run environment check
   deno run --allow-env --allow-read scripts/check-env.ts
   ```

## Acceptance Criteria

- [ ] .env.example contains all required variables
- [ ] Configuration loads and validates correctly
- [ ] Type-safe config object is exported
- [ ] Missing required variables cause clear error
- [ ] Constants file contains all field mappings
- [ ] Environment check script runs successfully
- [ ] .env is properly gitignored

## Estimated Time

1-2 hours

## Resources

- Environment variables from throughout big_plan.md
- [Deno Environment Variables](https://deno.land/manual/basics/env_variables)
- [Zod Schema Validation](https://zod.dev/)
- [dotenv for Deno](https://deno.land/std/dotenv)
- websearch
- think hard

# Task: Configure Dependencies

## Priority: High

## Description

Set up deno.json configuration file with all required dependencies, import maps, tasks, and project settings as specified in the plan.

## Dependencies

- 02-create-project-structure.md (Project structure must exist)

## Implementation Steps

1. **Create deno.json Configuration**

   ```json
   {
     "tasks": {
       "dev": "deno run --watch --allow-net --allow-env --allow-read src/main.ts",
       "start": "deno run --allow-net --allow-env src/main.ts",
       "test": "deno test --allow-net --allow-env --allow-read",
       "deploy": "deployctl deploy --project=webflow-middleware --prod src/main.ts",
       "check": "deno check src/**/*.ts && deno lint && deno fmt --check"
     },
     "imports": {
       "@hono/hono": "jsr:@hono/hono@^4.4.0",
       "@hono/zod-validator": "jsr:@hono/zod-validator@^0.2.0",
       "@hono/cors": "jsr:@hono/hono/cors",
       "@hono/logger": "jsr:@hono/hono/logger",
       "zod": "npm:zod@^3.23.0",
       "quill-delta-to-html": "npm:quill-delta-to-html@^0.12.0",
       "dompurify": "npm:dompurify@^3.0.0",
       "jsdom": "npm:jsdom@^24.0.0",
       "slugify": "npm:slugify@^1.6.6",
       "reading-time": "npm:reading-time@^1.5.0",
       "@std/testing": "jsr:@std/testing@^0.218.0",
       "@std/assert": "jsr:@std/assert@^0.218.0",
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

2. **Create Import Aliases** (add to imports in deno.json)

   ```json
   {
     "imports": {
       "@/": "./src/",
       "@config/": "./src/config/",
       "@middleware/": "./src/middleware/",
       "@routes/": "./src/routes/",
       "@services/": "./src/services/",
       "@utils/": "./src/utils/",
       "@types/": "./src/types/"
     }
   }
   ```

3. **Install Dependencies** (verify all resolve)

   ```bash
   # Check that all dependencies resolve
   deno check src/main.ts

   # Cache all dependencies
   deno cache --reload src/main.ts
   ```

4. **Create Type Check Script**

   ```typescript
   // scripts/check-deps.ts
   console.log('Checking all dependencies...');

   try {
     await import('@hono/hono');
     await import('zod');
     await import('quill-delta-to-html');
     console.log('✅ All core dependencies resolved');
   } catch (error) {
     console.error('❌ Dependency error:', error);
     Deno.exit(1);
   }
   ```

5. **Run Dependency Check**
   ```bash
   deno run scripts/check-deps.ts
   ```

## Acceptance Criteria

- [ ] deno.json created with all dependencies from the plan
- [ ] All import maps configured correctly
- [ ] Tasks defined for dev, test, deploy, and check
- [ ] Linting and formatting rules configured
- [ ] All dependencies resolve without errors
- [ ] Import aliases work correctly

## Estimated Time

30 minutes - 1 hour

## Resources

- Dependencies list from big_plan.md (lines 220-330)
- [Deno Configuration](https://deno.land/manual/getting_started/configuration_file)
- [JSR Registry](https://jsr.io/)
- [npm compatibility](https://deno.land/manual/node/npm_specifiers)
- websearch
  -think

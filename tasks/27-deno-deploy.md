# Task 27: Deno Deploy Configuration

## Priority: Critical

## Description
Configure and prepare the application for deployment on Deno Deploy, including environment setup, build configuration, and deployment scripts.

## Dependencies
- All core functionality completed
- Task 26: Test Fixtures (completed)

## Implementation Steps

1. **Deno Configuration**
   ```json
   // deno.json updates
   {
     "deploy": {
       "project": "webflow-middleware",
       "exclude": ["tests/**", ".env*"],
       "include": ["src/**", "deno.json"]
     }
   }
   ```

2. **Environment Variables**
   - WEBFLOW_API_TOKEN
   - WEBFLOW_COLLECTION_ID
   - ALLOWED_ORIGINS
   - RATE_LIMIT_WINDOW
   - LOG_LEVEL

3. **Deployment Scripts**
   ```typescript
   scripts/:
   - deploy.ts
   - check-env.ts
   - build.ts
   - preview.ts
   ```

4. **Production Optimizations**
   - Remove development dependencies
   - Minify responses
   - Enable compression
   - Optimize imports
   - Tree shaking

5. **Deno Deploy Setup**
   ```bash
   # Install deployctl
   deno install -Arf jsr:@deno/deployctl
   
   # Deploy commands
   deployctl deploy --prod
   deployctl deploy --preview
   ```

6. **Health Checks**
   - Add /health endpoint
   - Include version info
   - Check dependencies
   - Monitor memory usage

## Acceptance Criteria
- [ ] Deployment configured
- [ ] Environment vars set
- [ ] Scripts working
- [ ] Health check live
- [ ] Zero downtime deploy
- [ ] Rollback capability

## Time Estimate: 4 hours

## Resources
- [Deno Deploy Documentation](https://deno.com/deploy/docs)
- [Deployment Best Practices](https://docs.deno.com/deploy/manual)
- [Environment Variables](https://docs.deno.com/deploy/manual/environment-variables)
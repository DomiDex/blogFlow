# Task 06: CORS Middleware Implementation

## Priority: High

## Description
Implement Cross-Origin Resource Sharing (CORS) middleware to allow Webflow forms to communicate with the Deno server. This middleware must handle preflight requests and configure appropriate headers for secure cross-origin communication.

## Dependencies
- Task 01: Project Setup (completed)
- Task 02: Development Environment (completed)

## Implementation Steps

1. **Create CORS Middleware File**
   - Create `src/middleware/cors.ts`
   - Import Hono CORS middleware
   - Configure allowed origins, methods, and headers

2. **Configure CORS Options**
   - Set allowed origins (Webflow domains)
   - Configure allowed methods (GET, POST, OPTIONS)
   - Set allowed headers (Content-Type, Authorization)
   - Configure credentials handling
   - Set max age for preflight caching

3. **Handle Preflight Requests**
   - Implement OPTIONS request handling
   - Return appropriate headers for preflight
   - Ensure 204 No Content response

4. **Environment-Based Configuration**
   - Development: Allow localhost origins
   - Production: Restrict to Webflow domains
   - Support dynamic origin validation

5. **Security Headers**
   - Add X-Content-Type-Options
   - Add X-Frame-Options
   - Add X-XSS-Protection
   - Configure Content-Security-Policy

6. **Testing**
   - Test with curl preflight requests
   - Verify browser CORS behavior
   - Test with actual Webflow form

## Acceptance Criteria
- [ ] CORS middleware properly configured
- [ ] Preflight requests handled correctly
- [ ] Webflow forms can submit successfully
- [ ] Security headers implemented
- [ ] Environment-specific configuration works
- [ ] No CORS errors in browser console

## Time Estimate: 2 hours

## Resources
- [Hono CORS Middleware Documentation](https://hono.dev/middleware/cors)
- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Webflow Custom Code Documentation](https://university.webflow.com/lesson/custom-code)
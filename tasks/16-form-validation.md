# Task 16: Form Data Validation

## Priority: Critical

## Description
Implement comprehensive validation for incoming form data using Zod schemas, ensuring data integrity and providing clear validation errors.

## Dependencies
- Task 01: Project Setup (completed)
- Task 08: Error Handling (completed)

## Implementation Steps

1. **Create Validation Schemas**
   - Create `src/utils/validation.ts`
   - Define Zod schemas for form data
   - Add custom validation rules
   - Include error messages

2. **Form Data Schema**
   ```typescript
   const formSchema = z.object({
     authorName: z.string().min(2).max(100),
     articleTitle: z.string().min(10).max(200),
     metaDescription: z.string().min(50).max(300),
     articleContent: z.object({
       ops: z.array(z.any()).min(1)
     }),
     publishNow: z.boolean().optional()
   });
   ```

3. **Content Validation**
   - Validate Quill.js structure
   - Check minimum content length
   - Verify no empty content
   - Validate embedded media

4. **Custom Validators**
   - No profanity check
   - URL validation in content
   - Email format validation
   - Phone number format

5. **Validation Middleware**
   - Create `src/middleware/validation.ts`
   - Parse request body
   - Run validation
   - Format error responses

6. **Error Response Format**
   ```typescript
   {
     error: "Validation failed",
     fields: {
       authorName: "Name too short",
       articleTitle: "Title required"
     }
   }
   ```

## Acceptance Criteria
- [ ] All fields validated
- [ ] Clear error messages
- [ ] Zod schemas defined
- [ ] Custom rules working
- [ ] Proper error format
- [ ] Client-friendly messages

## Time Estimate: 3 hours

## Resources
- [Zod Documentation](https://zod.dev/)
- [Hono Zod Validator](https://hono.dev/middleware/zod-validator)
- [Validation Best Practices](https://www.sitepoint.com/javascript-form-validation-best-practices/)
# Task 20: Field Mapping Service

## Priority: High

## Description
Implement a service that maps form fields to Webflow CMS fields, handling naming conventions, data transformations, and field requirements.

## Dependencies
- Task 12: CMS Operations (completed)
- Task 19: Metadata Generator (completed)

## Implementation Steps

1. **Create Field Mapper**
   - Create `src/services/fieldMapper.ts`
   - Define mapping configuration
   - Handle field transformations
   - Validate required fields

2. **Field Mapping Configuration**
   ```typescript
   const fieldMap = {
     // Form field -> CMS field
     'authorName': 'author-name',
     'articleTitle': 'name',
     'metaDescription': 'meta-description',
     'articleContent': 'post',
     // Generated fields
     'slug': 'slug',
     'readingTime': 'reading-time',
     'introText': 'intro-text'
   };
   ```

3. **Data Transformations**
   - Boolean string conversion
   - Date formatting (ISO 8601)
   - HTML content processing
   - Number to string conversion
   - Array handling

4. **Webflow Field Structure**
   ```typescript
   {
     fieldData: {
       // User fields
       name: formData.articleTitle,
       "author-name": formData.authorName,
       // System fields
       _archived: false,
       _draft: !formData.publishNow,
       // Generated fields
       slug: metadata.slug,
       "reading-time": metadata.readingTime
     }
   }
   ```

5. **Validation Rules**
   - Required field checking
   - Type validation
   - Length constraints
   - Format verification

6. **Default Values**
   - Set archive to false
   - Draft based on publishNow
   - Empty strings for optional
   - Current date for timestamps

## Acceptance Criteria
- [ ] All fields mapped correctly
- [ ] Transformations working
- [ ] Validation implemented
- [ ] Defaults applied
- [ ] Webflow format correct
- [ ] No missing mappings

## Time Estimate: 3 hours

## Resources
- [Webflow CMS Fields](https://university.webflow.com/lesson/intro-to-the-webflow-cms)
- [JavaScript Object Mapping](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries)
- [Data Transformation Patterns](https://www.patterns.dev/posts/transformation-pattern)
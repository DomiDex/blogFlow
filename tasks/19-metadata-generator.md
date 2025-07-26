# Task 19: Metadata Generator Service

## Priority: High

## Description
Create a service that generates all required metadata fields including reading time, intro text, and other computed fields for the Webflow CMS.

## Dependencies
- Task 17: Quill Converter (completed)
- Task 21: Reading Time Calculator (will provide algorithm)
- Task 23: Intro Text Extractor (will provide algorithm)

## Implementation Steps

1. **Create Metadata Service**
   - Create `src/services/metadataGenerator.ts`
   - Aggregate all metadata functions
   - Handle field dependencies
   - Return complete metadata object

2. **Metadata Fields**
   ```typescript
   interface ArticleMetadata {
     slug: string,
     readingTime: string,
     introText: string,
     createdOn: string,
     updatedOn: string,
     publishedOn?: string,
     wordCount: number,
     characterCount: number
   }
   ```

3. **Field Generation**
   - Calculate reading time from HTML
   - Extract intro text (first 160 chars)
   - Generate ISO timestamps
   - Count words accurately
   - Set canonical link

4. **Integration Points**
   - Call from CMS operations
   - Use validated input data
   - Apply business rules
   - Format for Webflow

5. **Business Rules**
   - Minimum 1 minute reading time
   - Intro text with ellipsis
   - UTC timestamps
   - SEO-friendly formatting

6. **Performance**
   - Cache calculations
   - Optimize algorithms
   - Batch processing ready
   - Minimal dependencies

## Acceptance Criteria
- [ ] All metadata generated
- [ ] Accurate calculations
- [ ] Proper formatting
- [ ] Fast performance
- [ ] No missing fields
- [ ] Business rules applied

## Time Estimate: 3 hours

## Resources
- [Reading Time Algorithms](https://github.com/ngryman/reading-time)
- [Meta Description Best Practices](https://moz.com/learn/seo/meta-description)
- [ISO 8601 Date Format](https://www.iso.org/iso-8601-date-and-time-format.html)
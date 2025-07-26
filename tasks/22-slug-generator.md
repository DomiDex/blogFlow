# Task 22: Slug Generator Utility

## Priority: High

## Description
Create a utility that generates SEO-friendly URL slugs from article titles, handling special characters, length limits, and ensuring uniqueness.

## Dependencies
- None (base utility)

## Implementation Steps

1. **Create Slug Generator**
   - Create `src/utils/slugGenerator.ts`
   - Implement transformation rules
   - Handle edge cases
   - Add configuration options

2. **Transformation Rules**
   ```typescript
   1. Convert to lowercase
   2. Remove special characters
   3. Replace spaces with hyphens
   4. Remove accents/diacritics
   5. Trim to max length (80)
   6. Remove stop words (optional)
   ```

3. **Character Handling**
   - Unicode normalization
   - Accent removal (café → cafe)
   - Special char replacement
   - Emoji removal
   - Preserve alphanumeric

4. **Edge Cases**
   - Multiple spaces/hyphens
   - Leading/trailing hyphens
   - All special characters
   - Empty input
   - Very long titles

5. **SEO Optimization**
   - Remove common stop words
   - Preserve important keywords
   - Maintain readability
   - Length optimization

6. **Configuration Options**
   ```typescript
   interface SlugOptions {
     maxLength: number,
     separator: string,
     lowercase: boolean,
     removeStopWords: boolean,
     customReplacements: Map
   }
   ```

## Acceptance Criteria
- [ ] Clean slug output
- [ ] Special chars handled
- [ ] Length limits enforced
- [ ] SEO-friendly format
- [ ] Unicode support
- [ ] No invalid characters

## Time Estimate: 2 hours

## Resources
- [Slugify npm Package](https://www.npmjs.com/package/slugify)
- [URL Slug Best Practices](https://moz.com/blog/15-seo-best-practices-for-structuring-urls)
- [Unicode Normalization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)
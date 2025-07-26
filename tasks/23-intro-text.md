# Task 23: Intro Text Extractor

## Priority: Medium

## Description
Implement a utility that extracts the first 160 characters of article content for use as intro text/preview, handling HTML content appropriately.

## Dependencies
- Task 17: Quill Converter (provides HTML content)

## Implementation Steps

1. **Create Intro Text Utility**
   - Create `src/utils/introTextExtractor.ts`
   - Strip HTML tags safely
   - Extract plain text
   - Format with ellipsis

2. **Extraction Algorithm**
   ```typescript
   1. Parse HTML content
   2. Extract text nodes only
   3. Normalize whitespace
   4. Take first 160 characters
   5. Find last complete word
   6. Add ellipsis if truncated
   ```

3. **HTML Handling**
   - Remove all tags
   - Preserve text content
   - Handle entities (&amp;)
   - Normalize line breaks
   - Remove extra spaces

4. **Smart Truncation**
   - Don't cut mid-word
   - Respect sentence boundaries
   - Remove trailing punctuation
   - Add ellipsis correctly

5. **Edge Cases**
   - Short content (<160 chars)
   - Code blocks in content
   - Lists at beginning
   - Media-only content
   - Empty paragraphs

6. **Output Format**
   - Plain text only
   - Single line
   - No HTML entities
   - Proper ellipsis (...)
   - Trimmed whitespace

## Acceptance Criteria
- [ ] Clean text extraction
- [ ] 160 character limit
- [ ] Word boundaries respected
- [ ] Ellipsis when truncated
- [ ] No HTML in output
- [ ] Handles edge cases

## Time Estimate: 2 hours

## Resources
- [Text Truncation Best Practices](https://css-tricks.com/snippets/css/truncate-string-with-ellipsis/)
- [HTML to Text Conversion](https://www.npmjs.com/package/html-to-text)
- [Meta Description Guidelines](https://developers.google.com/search/docs/appearance/snippet)
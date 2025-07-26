# Task 21: Reading Time Calculator

## Priority: Medium

## Description
Implement an accurate reading time calculator that analyzes HTML content and provides estimated reading time based on word count and content complexity.

## Dependencies
- Task 17: Quill Converter (completed - provides HTML)

## Implementation Steps

1. **Create Reading Time Utility**
   - Create `src/utils/readingTime.ts`
   - Implement word counting algorithm
   - Add complexity factors
   - Format output string

2. **Reading Speed Configuration**
   ```typescript
   const readingSpeeds = {
     text: 238,      // Average WPM
     technical: 200, // Technical content
     code: 150,      // Code blocks
     list: 250       // Lists scan faster
   };
   ```

3. **Content Analysis**
   - Strip HTML tags for text
   - Count words accurately
   - Identify code blocks
   - Count images/media
   - Detect technical content

4. **Calculation Algorithm**
   ```typescript
   1. Extract plain text
   2. Count total words
   3. Identify code blocks
   4. Add image viewing time (12s)
   5. Apply reading speeds
   6. Round to nearest minute
   ```

5. **Output Formatting**
   - "1 min read" (singular)
   - "5 min read" (plural)
   - Minimum 1 minute
   - Localization ready

6. **Performance Optimization**
   - Efficient HTML parsing
   - Cache calculations
   - Minimize regex usage
   - Stream processing ready

## Acceptance Criteria
- [ ] Accurate word count
- [ ] Code blocks handled
- [ ] Images considered
- [ ] Proper formatting
- [ ] Performance optimized
- [ ] Minimum 1 minute

## Time Estimate: 2 hours

## Resources
- [Reading Time npm Package](https://www.npmjs.com/package/reading-time)
- [Average Reading Speed Research](https://www.sciencedirect.com/science/article/abs/pii/S0749596X19300786)
- [HTML Text Extraction](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText)
# Webflow Form to CMS Integration Guide

This guide explains how to integrate your Webflow forms with the BlogFlow middleware to automatically create CMS items from form submissions.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Webflow Setup](#webflow-setup)
4. [Form Configuration](#form-configuration)
5. [Testing Your Integration](#testing-your-integration)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)

## Overview

The BlogFlow middleware acts as a bridge between your Webflow forms and Webflow CMS, automatically:
- Processing rich text content from Quill.js editors
- Generating SEO-friendly slugs
- Calculating reading time
- Creating properly formatted CMS items
- Handling draft/publish states

## Prerequisites

Before starting, ensure you have:

1. **Webflow API Token**
   - Go to [Webflow Account Settings](https://webflow.com/dashboard/account/apps)
   - Generate a new API token
   - Grant permissions for CMS operations

2. **Collection Setup**
   - A CMS collection with these required fields:
     - `name` (Plain Text) - Article title
     - `slug` (Slug) - URL slug
     - `author-name` (Plain Text) - Author name
     - `meta-description` (Plain Text) - SEO description
     - `post` (Rich Text) - Article content
     - `reading-time` (Plain Text) - Auto-calculated
     - `intro-text` (Plain Text) - Auto-generated excerpt

3. **Collection and Site IDs**
   - Find in Webflow Designer URL or via API

## Webflow Setup

### Step 1: Create Your Form

In Webflow Designer, create a form with these fields:

```html
<form id="blog-submission-form">
  <!-- Author Name -->
  <input type="text" name="authorName" required>
  
  <!-- Article Title -->
  <input type="text" name="articleTitle" required>
  
  <!-- Meta Description -->
  <textarea name="metaDescription" required></textarea>
  
  <!-- Article Content (Hidden - populated by Quill) -->
  <input type="hidden" name="articleContent">
  
  <!-- Optional: Publish immediately -->
  <input type="checkbox" name="publishNow">
  
  <button type="submit">Submit Article</button>
</form>
```

### Step 2: Add Quill.js Editor

Add to your page's custom code (before `</body>`):

```html
<!-- Quill CSS -->
<link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">

<!-- Quill JS -->
<script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>

<!-- Editor Container -->
<div id="editor-container" style="height: 400px;"></div>

<script>
// Initialize Quill
const quill = new Quill('#editor-container', {
  theme: 'snow',
  modules: {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['link', 'blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  }
});

// Handle form submission
document.getElementById('blog-submission-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Get form data
  const formData = new FormData(e.target);
  
  // Add Quill content
  const articleContent = quill.getContents();
  
  // Prepare submission data
  const submissionData = {
    authorName: formData.get('authorName'),
    articleTitle: formData.get('articleTitle'),
    metaDescription: formData.get('metaDescription'),
    articleContent: articleContent,
    publishNow: formData.get('publishNow') === 'on'
  };
  
  try {
    // Submit to your middleware
    const response = await fetch('https://your-middleware-url.com/api/webflow-form', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify(submissionData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Article submitted successfully!');
      // Clear form
      e.target.reset();
      quill.setContents([]);
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    alert('Submission failed: ' + error.message);
  }
});
</script>
```

### Step 3: Configure CORS

Add your Webflow domain to the middleware's allowed origins:

1. In your `.env` file:
   ```
   CORS_ORIGINS=https://your-site.webflow.io,https://your-custom-domain.com
   ```

2. Or for published sites:
   ```
   CORS_ORIGINS=https://*.webflow.io,https://your-domain.com
   ```

## Form Configuration

### Required Fields

| Field Name | Type | Description | Validation |
|------------|------|-------------|------------|
| `authorName` | String | Author's display name | 2-100 characters |
| `articleTitle` | String | Article headline | 10-200 characters |
| `metaDescription` | String | SEO meta description | 50-300 characters |
| `articleContent` | Quill Delta | Rich text content | Min 50 words |

### Optional Fields

| Field Name | Type | Description | Default |
|------------|------|-------------|---------|
| `publishNow` | Boolean | Publish immediately | `false` (draft) |
| `slug` | String | Custom URL slug | Auto-generated |
| `categories` | Array | Category IDs | `[]` |
| `tags` | Array | Tag values | `[]` |
| `featuredImage` | String | Image URL | `null` |

### Quill Delta Format

The middleware expects Quill's Delta format:

```json
{
  "ops": [
    { "insert": "Welcome to My Blog Post", "attributes": { "header": 1 } },
    { "insert": "\n\n" },
    { "insert": "This is a paragraph with " },
    { "insert": "bold text", "attributes": { "bold": true } },
    { "insert": " and " },
    { "insert": "a link", "attributes": { "link": "https://example.com" } },
    { "insert": ".\n" }
  ]
}
```

## Testing Your Integration

### Using the Test Form

1. Start the test server:
   ```bash
   deno task test:form
   ```

2. Open `http://localhost:3000/test-form.html`

3. Fill out the form and submit

### Using the Test Script

```bash
deno run --allow-net --allow-env --allow-read scripts/test-form.ts
```

### Verify in Webflow

1. Go to your Webflow CMS collection
2. Check for the new item (draft or published)
3. Verify all fields are populated correctly

## Troubleshooting

### Common Issues

#### 401 Unauthorized
- **Cause**: Invalid API token
- **Solution**: 
  - Ensure token is in `.env` without "Bearer" prefix
  - Verify token has CMS permissions
  - Check token hasn't expired

#### CORS Errors
- **Cause**: Domain not in allowed origins
- **Solution**: 
  - Add your domain to `CORS_ORIGINS` in `.env`
  - Include both staging (*.webflow.io) and production domains

#### 429 Rate Limited
- **Cause**: Too many requests
- **Solution**: 
  - Default limit: 100 requests per minute
  - Adjust `RATE_LIMIT_MAX_REQUESTS` if needed

#### Content Shows as [object Object]
- **Cause**: JSON formatting issue
- **Solution**: This is display-only; content is stored correctly in Webflow

### Debug Mode

Enable detailed logging:
```env
LOG_LEVEL=debug
```

Check server logs for detailed error information.

## API Reference

### POST /api/webflow-form

Creates a new CMS item from form data.

**Request:**
```json
{
  "authorName": "string",
  "articleTitle": "string", 
  "metaDescription": "string",
  "articleContent": { "ops": [...] },
  "publishNow": false
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Article created successfully",
  "data": {
    "itemId": "xxx",
    "slug": "article-slug",
    "published": false
  },
  "item": { ... }
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### POST /api/webflow-form/draft

Saves a draft with partial data.

### PUT /api/webflow-form/:itemId

Updates an existing CMS item.

### Health Check

**GET /health** - Returns server status

## Best Practices

1. **Content Guidelines**
   - Minimum 50 words for articles
   - Use semantic HTML from Quill
   - Include meta descriptions for SEO

2. **Security**
   - Always use HTTPS in production
   - Implement form validation client-side
   - Consider adding reCAPTCHA for public forms

3. **Performance**
   - Batch submissions if creating multiple items
   - Monitor rate limits
   - Use draft mode for immediate feedback

## Support

For issues or questions:
- Check server logs: `tail -f /tmp/server.log`
- Review the [GitHub repository](https://github.com/your-repo)
- Ensure all environment variables are set correctly

## Next Steps

1. Customize field mappings in `src/services/fieldMapper.ts`
2. Add webhook notifications for new articles
3. Implement author authentication
4. Set up monitoring with Sentry (optional)
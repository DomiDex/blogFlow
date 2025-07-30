# Webflow Form Integration Guide

This guide explains how to integrate a Webflow form with the BlogFlow API to submit articles directly to your CMS.

## Table of Contents
- [Prerequisites](#prerequisites)
- [API Endpoint](#api-endpoint)
- [Form Setup in Webflow](#form-setup-in-webflow)
- [Required Form Fields](#required-form-fields)
- [Adding the Integration Script](#adding-the-integration-script)
- [Testing Your Integration](#testing-your-integration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

1. **API Deployment**: Ensure your BlogFlow API is deployed and accessible
2. **Webflow API Token**: Make sure your API token is configured correctly in your deployment environment
3. **Collection IDs**: Verify your Webflow Collection ID is set in the environment variables

## API Endpoint

Your form will submit to:
```
https://[your-deployment-url]/api/webflow-form
```

The API accepts both:
- **JSON requests** with `Content-Type: application/json`
- **Form-encoded requests** with `Content-Type: application/x-www-form-urlencoded`

## Form Setup in Webflow

### Step 1: Create Your Form

1. Add a Form Block to your Webflow page
2. Add the following form elements:

| Field Type | Name Attribute | Label | Required |
|------------|---------------|-------|----------|
| Text Input | `authorName` | Author Name | Yes |
| Email Input | `authorEmail` | Author Email | Yes |
| Text Input | `articleTitle` | Article Title | Yes |
| Textarea | `metaDescription` | Meta Description | Yes |
| Text Input | `tags` | Tags (comma-separated) | No |
| Text Input | `categories` | Categories (comma-separated) | No |
| Checkbox | `publishNow` | Publish Immediately | No |

### Step 2: Add Rich Text Editor

Add a div element with `id="editor"` where you want the rich text editor to appear:
```html
<div id="editor"></div>
```

### Step 3: Configure Form Settings

1. Select your form element in Webflow Designer
2. In the Form Settings panel:
   - **Clear the Action field** (leave it empty)
   - **Set Method to POST**
   - **Turn OFF Webflow Forms** (if available)
3. Add a custom attribute to the form:
   - Click Element Settings (gear icon)
   - Add Custom Attribute: `data-custom-form="true"`

## Adding the Integration Script

### Step 1: Add Quill CSS

In your page's Custom Code settings, add to the **Inside <head> tag** section:

```html
<link href="https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.css" rel="stylesheet">
```

### Step 2: Add Integration Script

In the **Before </body> tag** section, add:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js"></script>

<script>
document.addEventListener('DOMContentLoaded', function() {
  // Wait for Webflow to initialize
  setTimeout(function() {
    // Find form with custom attribute
    var form = document.querySelector('form[data-custom-form="true"]');
    if (!form) {
      console.error('No form with data-custom-form="true" found');
      return;
    }
    
    // Remove any Webflow handlers
    var newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    form = newForm;
    
    // Prevent default submission
    form.action = 'javascript:void(0)';
    form.method = 'post';
    
    // Initialize Quill editor
    var quill = null;
    if (document.getElementById('editor')) {
      quill = new Quill('#editor', {
        theme: 'snow',
        placeholder: 'Write your article content here...',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'blockquote'],
            [{ 'align': [] }],
            ['clean']
          ]
        }
      });
    }
    
    // Handle form submission
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Show loading state
      var submitBtn = form.querySelector('[type="submit"]');
      var originalText = '';
      if (submitBtn) {
        originalText = submitBtn.value || submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.value = 'Submitting...';
        submitBtn.textContent = 'Submitting...';
      }
      
      // Collect form data
      var formData = new FormData(form);
      var data = {};
      
      // Convert FormData to object
      formData.forEach(function(value, key) {
        if (!key.startsWith('_')) { // Skip Webflow internal fields
          data[key] = value;
        }
      });
      
      // Add Quill content
      if (quill) {
        var delta = quill.getContents();
        var plainText = quill.getText().trim();
        
        // Validate minimum content length
        if (plainText.split(/\s+/).length < 50) {
          alert('Article must be at least 50 words');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.value = originalText;
            submitBtn.textContent = originalText;
          }
          return;
        }
        
        data.articleContent = delta;
      }
      
      // Process special fields
      data.publishNow = data.publishNow === 'on' || data.publishNow === 'true';
      
      if (data.tags && typeof data.tags === 'string') {
        data.tags = data.tags.split(',').map(function(tag) {
          return tag.trim();
        }).filter(Boolean);
      }
      
      if (data.categories && typeof data.categories === 'string') {
        data.categories = data.categories.split(',').map(function(cat) {
          return cat.trim();
        }).filter(Boolean);
      }
      
      // Ensure required fields have defaults
      data.authorEmail = data.authorEmail || data.email || '';
      data.metaDescription = data.metaDescription || data.description || '';
      
      console.log('Submitting form data:', data);
      
      // Submit to API
      fetch('https://YOUR-DEPLOYMENT-URL/api/webflow-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      })
      .then(function(response) {
        return response.json().then(function(result) {
          return { status: response.status, data: result };
        });
      })
      .then(function(response) {
        if (response.status === 200 && response.data.success) {
          // Success - show message
          alert('Success! Article published with ID: ' + response.data.data.itemId);
          
          // Reset form
          form.reset();
          if (quill) quill.setText('');
          
          // Optional: Redirect to success page
          // window.location.href = '/success';
        } else {
          // Error - show details
          var errorMsg = response.data.message || 'Submission failed';
          if (response.data.fields) {
            var fieldErrors = Object.entries(response.data.fields)
              .map(function(entry) {
                return entry[0] + ': ' + entry[1].join(', ');
              })
              .join('\\n');
            if (fieldErrors) {
              errorMsg += '\\n\\n' + fieldErrors;
            }
          }
          alert('Error: ' + errorMsg);
        }
      })
      .catch(function(error) {
        console.error('Network error:', error);
        alert('Network error. Please check your connection and try again.');
      })
      .finally(function() {
        // Reset submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.value = originalText;
          submitBtn.textContent = originalText;
        }
      });
      
      return false;
    });
    
    console.log('BlogFlow form handler initialized successfully');
  }, 500); // Wait 500ms for Webflow
});
</script>
```

**Important**: Replace `YOUR-DEPLOYMENT-URL` with your actual deployment URL.

## Testing Your Integration

1. **Check Browser Console**:
   - Open Developer Tools (F12)
   - Look for "BlogFlow form handler initialized successfully"
   - Check for any error messages

2. **Test Submission**:
   - Fill out all required fields
   - Write at least 50 words in the editor
   - Submit the form
   - Check console for submission logs

3. **Verify in Webflow CMS**:
   - Log into your Webflow account
   - Navigate to your CMS collection
   - Confirm the new article appears

## Troubleshooting

### Form Still Redirects

If the form redirects to a thank you page:
1. Ensure you've removed all values from the form's Action field
2. Verify the custom attribute `data-custom-form="true"` is added
3. Check that the script is loading (look for console logs)
4. Try publishing your Webflow site again

### 429 Rate Limit Errors

If you see "Too many requests" errors:
1. Wait 1-5 minutes before trying again
2. The API has rate limits to prevent spam:
   - 100 validation requests per minute
   - 50 form submissions per 5 minutes

### 401 Unauthorized Errors

If you see authentication errors:
1. Verify your `WEBFLOW_API_TOKEN` environment variable
2. Ensure the token does NOT include "Bearer " prefix
3. Check that your collection ID is correct

### Content Validation Errors

Common validation requirements:
- Article content must be at least 50 words
- Author name, email, and title are required
- Email must be a valid format

### CORS Errors

If you see CORS errors:
1. Ensure your domain is included in the `CORS_ORIGINS` environment variable
2. For Webflow sites, the following should be included:
   - `https://*.webflow.io`
   - `https://*.webflow.com`
   - Your custom domain if applicable

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Article created successfully",
  "data": {
    "itemId": "123456789",
    "slug": "article-title-slug",
    "authorName": "John Doe",
    "articleTitle": "Article Title",
    "published": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "fields": {
    "articleContent": ["Content too short: 30 words (minimum: 50)"]
  }
}
```

## Environment Variables

Ensure these are set in your deployment:

```env
WEBFLOW_API_TOKEN=your-token-here
WEBFLOW_COLLECTION_ID=your-collection-id
WEBFLOW_SITE_ID=your-site-id
CORS_ORIGINS=https://*.webflow.io,https://*.webflow.com,https://your-domain.com
```

## Support

For issues or questions:
1. Check the browser console for detailed error messages
2. Review the server logs in your deployment dashboard
3. Ensure all environment variables are correctly set
4. Verify your Webflow API token has the necessary permissions
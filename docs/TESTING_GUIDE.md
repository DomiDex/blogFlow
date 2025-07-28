# Testing Guide: Webflow Form Integration

This guide provides detailed instructions for testing the Webflow form submission middleware with an actual Webflow form.

## 🚀 Quick Start: Test with Local Web Server (Recommended)

This approach avoids CORS issues when testing locally.

### Step 1: Start the API server
```bash
deno task dev
```
Wait for: `🎯 Ready to process form submissions!`

### Step 2: In a new terminal, start the test form server
```bash
deno task test:form
```
This will serve the test form at http://localhost:3000

### Step 3: Open your browser
Go to: http://localhost:3000/test-form.html

### Step 4: Submit the form
- The form is pre-filled with sample data
- Click "Submit to Webflow"
- You should see a success message with the created item details

## 🧪 Alternative Testing Methods

### Option 1: Test with API Script
For quick API testing without a browser:
```bash
deno task test:api
```

### Option 2: Test with cURL
```bash
curl -X POST http://localhost:8000/api/webflow-form \
  -H "Content-Type: application/json" \
  -d '{
    "authorName": "Test Author",
    "articleTitle": "Test Article",
    "metaDescription": "Test description",
    "articleContent": {
      "ops": [
        {"insert": "Hello World!\\n"}
      ]
    }
  }'
```

### Option 3: Direct File Access
If you've updated CORS to allow "null" origin:
1. Simply open `test-form.html` in your browser
2. Make sure the server is running (`deno task dev`)
3. Submit the form

**Note**: This may cause CORS errors. Use the local web server method instead.

## Prerequisites

Before testing, ensure you have:

1. **Webflow API Token** - Get this from your Webflow account settings
2. **Collection ID** - The ID of your Webflow CMS collection
3. **Site ID** - Your Webflow site identifier
4. **A Webflow form** - Set up in your Webflow project

## Step 1: Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Webflow credentials:
```env
# Webflow API Configuration (REQUIRED)
WEBFLOW_API_TOKEN=your_actual_token_here
WEBFLOW_COLLECTION_ID=your_collection_id_here
WEBFLOW_SITE_ID=your_site_id_here

# Server Configuration
PORT=8000
NODE_ENV=development

# Security - Add your Webflow domains
CORS_ORIGINS=https://your-site.webflow.io,https://your-site.webflow.com
```

### How to Find Your Webflow Credentials:

#### API Token:
1. Log in to Webflow
2. Go to Account Settings → Integrations → API Access
3. Generate a new token with CMS permissions
4. Copy the token (you won't see it again!)

#### Site ID:
1. Go to your Webflow project settings
2. Click on "Integrations" tab
3. Find "Site ID" at the top
4. Copy the ID (looks like: `5f1212312312312312312312`)

#### Collection ID:
1. Open your Webflow project
2. Go to CMS Collections
3. Click on your blog/article collection
4. Look at the URL: `https://webflow.com/design/yoursite?tab=collection&cid=YOUR_COLLECTION_ID`
5. Copy the `cid` parameter value

## Step 2: Verify Environment Setup

Run the environment check script:
```bash
deno run --allow-env --allow-read scripts/check-env.ts
```

This will verify:
- All required environment variables are set
- Values are in the correct format
- API token has proper structure

## Step 3: Start the Development Server

Start the server with hot reload:
```bash
deno task dev
```

You should see:
```
🚀 Server running at http://localhost:8000
📝 Health check: http://localhost:8000/health
🔧 Environment: development
```

## Step 4: Test with the Test Script

### Basic Test:
```bash
deno run --allow-net --allow-env --allow-read scripts/test-form.ts
```

### Full Test Suite (includes validation tests):
```bash
deno run --allow-net --allow-env --allow-read scripts/test-form.ts --all
```

The test script will:
- Submit a sample article with rich text content
- Show the full request/response cycle
- Display any errors with helpful debugging info
- Confirm if the item was created in Webflow

## Step 5: Set Up Webflow Form (Actual Integration)

### In Webflow Designer:

1. **Create a Form** with these exact field names:
   ```
   - authorName (Text Input)
   - articleTitle (Text Input)
   - metaDescription (Textarea)
   - articleContent (Hidden field or Textarea)
   ```

2. **Configure Form Settings**:
   - Method: POST
   - Action: `https://your-server.com/api/webflow-form`
   - Or use Webflow's form endpoint and redirect

3. **Add Quill.js Editor** (for rich text):
   ```html
   <!-- In your page's custom code -->
   <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
   <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
   
   <!-- Replace textarea with div for Quill -->
   <div id="editor" style="height: 400px;"></div>
   
   <script>
   // Initialize Quill
   var quill = new Quill('#editor', {
     theme: 'snow',
     modules: {
       toolbar: [
         ['bold', 'italic', 'underline'],
         ['link', 'blockquote', 'code'],
         [{ 'list': 'ordered'}, { 'list': 'bullet' }],
         [{ 'header': [1, 2, 3, false] }],
         ['clean']
       ]
     }
   });
   
   // On form submit, get Delta content
   document.querySelector('form').addEventListener('submit', function(e) {
     // Get the hidden input for articleContent
     var hiddenInput = document.querySelector('input[name="articleContent"]');
     
     // Set the value to Quill Delta JSON
     hiddenInput.value = JSON.stringify(quill.getContents());
   });
   </script>
   ```

## Step 6: Test with Real Form Submission

### Option A: Direct API Test (Recommended for Development)

1. Use a tool like Postman, Insomnia, or cURL:

```bash
curl -X POST http://localhost:8000/api/webflow-form \
  -H "Content-Type: application/json" \
  -H "Origin: https://your-site.webflow.io" \
  -d '{
    "authorName": "Jane Smith",
    "articleTitle": "My First Blog Post",
    "metaDescription": "This is a test of the Webflow integration",
    "articleContent": "{\"ops\":[{\"insert\":\"Hello World!\\n\"}]}"
  }'
```

### Option B: Test from Webflow (Production)

1. Deploy your server (see deployment guide)
2. Update your form action to your server URL
3. Submit a test article from your published Webflow site

## Step 7: Verify in Webflow CMS

1. Go to your Webflow project
2. Open the CMS collection
3. Check for the new item with:
   - Correct title and author
   - Properly formatted HTML content
   - Generated slug
   - Reading time
   - Intro text

## Troubleshooting

### Common Issues:

1. **CORS Error**:
   - Add your Webflow domain to `CORS_ORIGINS` in `.env`
   - Format: `https://your-site.webflow.io`

2. **401 Unauthorized**:
   - Check your API token is valid
   - Ensure token has CMS write permissions

3. **404 Collection Not Found**:
   - Verify your Collection ID
   - Check the collection exists and is not archived

4. **Validation Errors**:
   - Check field names match exactly
   - Ensure Quill Delta is valid JSON
   - Author name and title are required

5. **Connection Refused**:
   - Make sure server is running (`deno task dev`)
   - Check the port isn't already in use

### Debug Mode:

Set `LOG_LEVEL=debug` in `.env` for verbose logging:
```env
LOG_LEVEL=debug
```

This will show:
- All incoming requests
- Validation details
- Webflow API calls
- Error stack traces

## Testing Different Scenarios

### 1. Test Rich Text Formatting:
Modify the Quill Delta in `scripts/test-form.ts` to test:
- Headers (H1-H3)
- Bold, italic, underline
- Links
- Lists (ordered/unordered)
- Code blocks

### 2. Test Edge Cases:
- Very long articles (performance)
- Special characters and Unicode
- Empty content
- Duplicate titles (slug generation)

### 3. Test Error Handling:
- Invalid API token
- Rate limiting
- Network timeouts
- Malformed requests

## Production Testing Checklist

Before going live:

- [ ] Test with production Webflow API token
- [ ] Verify CORS settings for production domain
- [ ] Test rate limiting behavior
- [ ] Confirm error messages are user-friendly
- [ ] Check monitoring/logging is working
- [ ] Test with real content from actual users
- [ ] Verify backup/retry mechanisms
- [ ] Load test with expected traffic

## Monitoring

After deployment, monitor:
- Server health endpoint: `/health`
- Response times
- Error rates
- Webflow API usage
- Rate limit hits

## Need Help?

1. Check server logs for detailed error messages
2. Run `deno task check` to verify code
3. Use `scripts/check-env.ts` to validate configuration
4. Enable debug logging for more details

Happy testing! 🚀
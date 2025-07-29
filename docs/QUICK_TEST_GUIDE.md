# Quick Test Guide for Webflow Form

## 🚀 Option 1: Test with Local Web Server (Recommended)

This avoids CORS issues when testing locally.

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

## 🧪 Option 2: Test with API Script

For quick API testing without a browser:

```bash
deno task test:api
```

This will:
- Send a test article to your Webflow CMS
- Show the full request/response
- Display any errors with debugging info

## 🔧 Option 3: Test with cURL

```bash
curl -X POST http://localhost:8000/api/webflow-form \
  -H "Content-Type: application/json" \
  -d '{
    "authorName": "Test Author",
    "articleTitle": "Test Article",
    "metaDescription": "Test description",
    "articleContent": {
      "ops": [
        {"insert": "Hello World!\n"}
      ]
    }
  }'
```

## 📝 Option 4: Direct File Access (If CORS allows)

If you've updated CORS to allow "null" origin:

1. Simply open `test-form.html` in your browser
2. Make sure the server is running (`deno task dev`)
3. Submit the form

## 🎯 What Success Looks Like

```json
{
  "success": true,
  "data": {
    "id": "xxx",
    "slug": "test-article",
    "name": "Test Article",
    "author-name": "Test Author",
    "post": "<h1>Hello World!</h1>",
    "reading-time": "1 min read",
    "intro-text": "Hello World!",
    "published-on": "2025-07-28T..."
  }
}
```

## ❌ Common Issues

### "Failed to fetch" or CORS error
- Use Option 1 (local web server) instead of opening HTML directly
- Make sure server is running on port 8000

### "Address already in use"
- Another process is using port 8000
- Kill it: `lsof -ti:8000 | xargs kill -9` (on Mac/Linux)
- Or change PORT in .env

### "Validation failed"
- Make sure `articleContent` is an object with `ops` array
- Check field names match exactly
- Author name and title are required

### "401 Unauthorized"
- Check your WEBFLOW_API_TOKEN in .env
- Token needs CMS write permissions

## 🔍 Debug Mode

For more details, set in .env:
```
LOG_LEVEL=debug
```

Then restart the server to see detailed logs.

## 📊 Check Server Health

Visit: http://localhost:8000/health

Should return:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": "...",
  "environment": "development"
}
```
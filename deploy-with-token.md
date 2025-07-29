# Deploy with Access Token

Since the browser authorization isn't working, let's use an access token instead:

## Step 1: Get Access Token from Deno Deploy

1. Go to: https://dash.deno.com/account#access-tokens
2. Click "New Access Token"
3. Name it: "CLI Deploy" (or any name you prefer)
4. Copy the token (it starts with `ddp_`)

## Step 2: Set the Token

Run this command with your token:
```bash
export DENO_DEPLOY_TOKEN=ddp_YOUR_TOKEN_HERE
```

## Step 3: Deploy

Now run:
```bash
deployctl deploy --project=webflow-middleware --token=$DENO_DEPLOY_TOKEN src/main.ts
```

## Alternative: Deploy from Dashboard UI

If the CLI still doesn't work, you can deploy directly from the dashboard:

1. Go to: https://dash.deno.com/projects
2. Click "New Project"
3. Name: `webflow-middleware`
4. Choose "Empty Project"
5. Go to Settings → Environment Variables
6. Add all your environment variables:
   - WEBFLOW_API_TOKEN
   - WEBFLOW_COLLECTION_ID
   - WEBFLOW_SITE_ID
   - etc.
7. Go to Deployments tab
8. Click "Deploy from GitHub" or use the playground to paste your code

## Quick Deploy Command

Once you have the token set:
```bash
# For preview
deployctl deploy --project=webflow-middleware src/main.ts

# For production
deployctl deploy --project=webflow-middleware --prod src/main.ts
```
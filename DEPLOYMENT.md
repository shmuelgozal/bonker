# Deployment Guide - Deploy Your App Online for Free

This guide will help you deploy the Bonker ammunition management system to be accessible from your Android phone.

## System Architecture
- **Backend**: Node.js/Express running on Fly.io (persistent storage, always-on, free)
- **Frontend**: React/Vite deployed to Netlify (free)  
- **Database**: SQLite (persisted to Fly.io volume)
- **Cost**: Completely FREE

## Prerequisites

1. **GitHub Account** - Sign up at https://github.com (free)
2. **Fly.io Account** - Sign up at https://fly.io (free)
3. **Netlify Account** - Sign up at https://netlify.com (free)
4. **Fly.io CLI** - Download from https://fly.io/docs/getting-started/installing-flyctl/

## Step 1: Set Up GitHub Repository

### 1.1 Create a GitHub Repository

1. Go to https://github.com/new
2. Repository name: `bonker-ammo-management`
3. Description: `Ammunition Bunker Management System`
4. Make it **PUBLIC**
5. Click "Create repository"

### 1.2 Upload Your Code to GitHub

1. Open Terminal/PowerShell in your project folder:
   ```powershell
   cd c:\Users\shmuel.gozal\myWork\bonker
   git init
   git add .
   git commit -m "Initial commit: Bonker ammo management system"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/bonker-ammo-management.git
   git push -u origin main
   ```

## Step 2: Deploy Backend to Fly.io

### 2.1 Install Fly.io CLI

1. Download and install from: https://fly.io/docs/getting-started/installing-flyctl/
2. Verify installation:
   ```
   flyctl version
   ```

### 2.2 Create Fly.io App

1. Open Terminal in your project folder
2. Run:
   ```
   flyctl auth login
   ```
3. Follow prompts to log in
4. Create app:
   ```
   flyctl launch
   ```
5. When asked:
   - App name: `bonker-api`
   - Region: Choose closest to you (e.g., `iad` for North America)
   - Postgres database: **No**
   - Redis: **No**

### 2.3 Deploy

```
flyctl deploy
```

### 2.4 Get Your Backend URL

After deployment completes:
```
flyctl open
```

This will open your live API at `https://bonker-api.fly.dev` (your app name may differ)

**Copy this URL - you'll need it for the frontend!**

## Step 3: Deploy Frontend to Netlify

### 3.1 Update Frontend API URL

1. Open `tester/client/netlify.toml`
2. Replace the API URL with your Fly.io URL:
   ```toml
   [build.environment]
     VITE_API_BASE_URL = "https://bonker-api.fly.dev"  # ← Use YOUR URL from Step 2.4
   ```

3. Commit and push:
   ```
   git add .
   git commit -m "Update API URL for deployment"
   git push
   ```

### 3.2 Deploy to Netlify

1. Go to https://netlify.com
2. Click "Add new site" → "Import an existing project"
3. Select GitHub
4. Authorize Netlify to access GitHub
5. Select your `bonker-ammo-management` repository
6. **Build settings:**
   - Base directory: `tester/client`
   - Build command: `npm run build`
   - Publish directory: `dist`
7. Click "Deploy site"

**Wait 2-3 minutes for build to complete**

### 3.3 Get Your Frontend URL

After build completes, your frontend will be live at a URL like:
`https://bonker-ammo-management.netlify.app`

## Step 4: Access from Android Phone

### 4.1 Get Your Public URL

Your app is now live at:
```
https://bonker-ammo-management.netlify.app
```

### 4.2 Open on Android

1. Open any browser on your Android phone (Chrome, Firefox, etc.)
2. Enter the URL from above
3. Bookmark it for quick access
4. To make it feel like an app, add to homescreen:
   - **Chrome**: Menu (⋮) → "Add to Home screen"
   - **Firefox**: Menu (≡) → "Add to Home screen"

## Step 5: Test the Deployment

1. Open the URL on your Android phone
2. Test basic features:
   - View bunkers ✓
   - Create issuance ✓
   - Export gaps to CSV ✓

## Troubleshooting

### API Connection Issues
- Check that frontend VITE_API_BASE_URL matches your Fly.io URL
- Make sure both deployments are complete (no "Deploying" status)

### Fly.io App Went to Sleep
- Free Fly.io apps sleep after 30 minutes of inactivity
- First request after sleep takes 30 seconds to wake
- Consider upgrading to paid Fly.io for always-on ($5/month)

### Database/Data Issues
- Fly.io persists your SQLite database to a volume
- Your data will survive app restarts

## Maintenance

### Updating Your App

After making changes locally:

```powershell
# Update backend
git add .
git commit -m "Update: [description]"
git push
flyctl deploy

# Frontend auto-deploys from GitHub
# Just push your changes and Netlify rebuilds automatically
```

## Optional: Upgrade for Better Performance

After trying the free version, you can upgrade:

1. **Fly.io**: Add paid plan ($5/month) for always-on, better performance
2. **Netlify**: Free tier is excellent, paid plans for higher limits
3. **Database**: Keep using free SQLite via Fly.io persistence

## Support

- Fly.io Docs: https://fly.io/docs/
- Netlify Docs: https://docs.netlify.com/
- React/Vite: https://vitejs.dev/

---

**Your app is now live and accessible worldwide from any device!** 🎉

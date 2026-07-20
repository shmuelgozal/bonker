# Deployment Guide - Deploy Your App Online for Free

This guide will help you deploy the Bonker ammunition management system to be accessible from your Android phone.

## System Architecture
- **Backend**: Node.js/Express running on Render.com (free, persists SQLite)
- **Frontend**: React/Vite deployed to Netlify (free)  
- **Database**: SQLite (persisted to Render.com)
- **Cost**: Completely FREE (no payment card required)

## Prerequisites

1. **GitHub Account** - Sign up at https://github.com (free)
2. **Render.com Account** - Sign up at https://dashboard.render.com (free, no credit card)
3. **Netlify Account** - Sign up at https://netlify.com (free)

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

## Step 2: Deploy Backend to Render.com

### 2.1 Create Render.com Account

1. Go to https://dashboard.render.com
2. Sign up with GitHub (easiest) or email
3. Verify email if needed

### 2.2 Create Web Service

1. Click **"New +"** button
2. Select **"Web Service"**
3. Connect GitHub repository:
   - Click "Connect account" if needed
   - Authorize Render to access your GitHub
   - Select `bonker` repository
4. Fill in the form:
   - **Name**: `bonker-api`
   - **Environment**: Node
   - **Build Command**: `cd tester/server && npm install && npm run build`
   - **Start Command**: `cd tester/server && npm start`
   - **Instance Type**: Free
5. Click **"Create Web Service"**

### 2.3 Wait for Deployment

Deployment takes 3-5 minutes. You'll see:
- Build in progress
- Build success
- Service running

Once complete, you'll have a URL like:
```
https://bonker-api.onrender.com
```

**Copy this URL - you'll need it for the frontend!**

### 2.4 Monitor Logs (if needed)

If deployment fails, check the "Logs" tab to see errors

## Step 3: Deploy Frontend to Netlify

### 3.1 Update Frontend API URL

1. Open `tester/client/netlify.toml`
2. Replace the API URL with your Render.com URL:
   ```toml
   [build.environment]
     VITE_API_BASE_URL = "https://bonker-api.onrender.com"  # ← Use YOUR URL from Step 2.4
   ```

3. Commit and push:
   ```
   git add .
   git commit -m "Update API URL for Render deployment"
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
- Check that frontend VITE_API_BASE_URL matches your Render.com URL
- Make sure both deployments are complete (no "Deploying" status)
- Check Render.com dashboard for any error logs

### Render.com App Went to Sleep
- Free Render.com apps sleep after 15 minutes of inactivity
- First request after sleep takes 30 seconds to wake
- Consider upgrading to paid Render for always-on service ($7/month)

### Database/Data Issues
- SQLite database is persisted on Render.com
- Your data will survive app restarts
- If issues occur, check Render dashboard logs

## Maintenance

### Updating Your App

After making changes locally:

```powershell
# Update backend (push to GitHub, Render auto-deploys)
git add .
git commit -m "Update: [description]"
git push

# Frontend auto-deploys from GitHub
# Just push your changes and Netlify rebuilds automatically
```

Render.com will automatically detect the push and redeploy your backend.

## Optional: Upgrade for Better Performance

After trying the free version, you can upgrade:

1. **Fly.io**: Add paid plan ($5/month) for always-on, better performance
2. **Netlify**: Free tier is excellent, paid plans for higher limits
3. **Database**: Keep using free SQLite via Fly.io persistence

## Support

- Render.com Docs: https://render.com/docs
- Netlify Docs: https://docs.netlify.com/
- React/Vite: https://vitejs.dev/

---

**Your app is now live and accessible worldwide from any device!** 🎉

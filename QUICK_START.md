# 🚀 QUICK START - Deploy Online in 15 Minutes

This guide will get your Bonker app live and accessible from your Android phone **completely FREE**.

## Prerequisites (FREE accounts - NO credit card needed)

1. GitHub account: https://github.com/signup
2. Render.com account: https://dashboard.render.com (free, no payment)
3. Netlify account: https://app.netlify.com (free tier)

---

## STEP 1: Prepare GitHub (2 minutes)

### 1.1 Create GitHub Repository

Go to: https://github.com/new

Fill in:
- **Repository name**: `bonker`
- **Description**: `Ammunition Bunker Management System`
- **Public**: ✅ Make it public
- Click: **Create repository**

Copy the HTTPS URL (looks like: `https://github.com/YOUR_USERNAME/bonker.git`)

### 1.2 Push Your Code

Open PowerShell and run:

```powershell
cd c:\Users\shmuel.gozal\myWork\bonker

# Configure git (use your GitHub username)
git config user.name "YOUR_NAME"
git config user.email "YOUR_EMAIL@example.com"

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/bonker.git
git branch -M main
git push -u origin main
```

✅ **Your code is now on GitHub!**

---

## STEP 2: Deploy Backend to Render.com (5 minutes)

### 2.1 Sign Up to Render

Go to: https://dashboard.render.com

Sign up with GitHub (easier) or email

### 2.2 Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect GitHub:
   - Click "Connect account"
   - Authorize Render
   - Select your `bonker` repository

3. Configure the service:
   - **Name**: `bonker-api`
   - **Runtime**: Node
   - **Build Command**: `cd tester/server && npm install && npm run build`
   - **Start Command**: `cd tester/server && npm start`
   - **Plan**: Free

4. Click **"Create Web Service"**

### 2.3 Wait for Deployment

Takes about 3-5 minutes. When complete, you'll see a URL like:
```
https://bonker-api.onrender.com
```

**SAVE THIS URL - You'll need it next!** 📌

---

## STEP 3: Deploy Frontend to Netlify (5 minutes)

### 3.1 Update API URL

Edit file: `tester/client/netlify.toml`

Find this line:
```toml
VITE_API_BASE_URL = "https://bonker-api.onrender.com"
```

Replace `bonker-api.onrender.com` with YOUR Render.com URL from Step 2.3

Save the file.

### 3.2 Push Changes to GitHub

```powershell
cd c:\Users\shmuel.gozal\myWork\bonker

git add .
git commit -m "Update API URL for deployment"
git push
```

### 3.3 Deploy to Netlify

Go to: https://app.netlify.com

Click: **Add new site** → **Import an existing project**

1. Select **GitHub**
2. Authorize Netlify
3. Select your `bonker` repository
4. Fill in:
   - **Base directory**: `tester/client`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click: **Deploy site**

⏳ **Wait 2-3 minutes for build to complete**

When done, Netlify shows your frontend URL (looks like: `https://bonker-abc123.netlify.app`)

---

## STEP 4: Access from Android Phone ✅

### 4.1 Open in Browser

On your Android phone:

1. Open Chrome/Firefox
2. Go to your Netlify URL
3. Wait 5-10 seconds for data to load (first load is slower)

### 4.2 Add to Home Screen

In Chrome:
- Menu (⋮) → **Add to Home screen** → Name it "Bonker"

In Firefox:
- Menu (≡) → **Add to Home screen** → Name it "Bonker"

Now you have an app icon on your home screen! 🎉

---

## STEP 5: Test Everything

From your phone, test:

- ✅ View bunkers
- ✅ Create issuance
- ✅ Export gaps to CSV
- ✅ Navigate around the app

**If something doesn't work**, check:

1. Is your Fly.io app running?
   ```
   flyctl status
   ```

2. Is Netlify build complete?
   - Check site on Netlify dashboard

3. Is the API URL correct?
   - Check `tester/client/netlify.toml`

---

## TROUBLESHOOTING

### Backend Not Responding

1. Check Render dashboard: https://dashboard.render.com
2. Click your `bonker-api` service
3. Check "Logs" tab for errors
4. If build failed, check build command syntax

### Slow First Load

Free Render.com apps sleep after 15 minutes. First request wakes them (takes ~30 seconds).

### Data Lost After Restart

Your data is persisted. Should be there when app restarts.

---

## UPGRADING (Optional)

After testing free version:

### Keep Backend Always-On
In Render dashboard, upgrade from Free to Paid plan (~$7/month for always-on)

Click your service → Settings → Change Plan

### Add Authentication
Follow GitHub auth tutorial in README.md

### Add MongoDB
Update code to use MongoDB Atlas (free 512MB tier)

---

## 🎉 YOU'RE DONE!

Your app is live! Share the URL with your team:

```
https://your-netlify-app.netlify.app
```

Works on:
- ✅ Android phones
- ✅ iPhones
- ✅ Tablets
- ✅ Desktops
- ✅ Worldwide

Accessible anywhere with internet! 🌍

---

## 📚 Learn More

- **Render.com**: https://render.com/docs
- **Netlify**: https://docs.netlify.com/
- **Full Guide**: See `DEPLOYMENT.md`

**Questions?** Check the logs or create a GitHub issue!

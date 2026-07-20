# MongoDB Migration Guide

Complete guide to migrate your Bunker app from SQLite to MongoDB for persistent cloud storage.

## Phase 1: Set Up MongoDB Atlas (Free Tier)

### Step 1: Create Account & Free Cluster

1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up (email, free tier, no credit card needed)
3. Create a **Free M0 Cluster** (512MB storage - perfect for this app)
4. Choose region closest to you (or `us-east-1` for Render compatibility)
5. Wait for cluster to initialize (5-10 minutes)

### Step 2: Get Connection String

1. In MongoDB Atlas dashboard, click **Database** → **Connect**
2. Choose **Drivers** option
3. Copy the connection string (looks like):
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. **Save this** - you'll need it for testing and deployment

### Step 3: Allow Network Access

1. In Atlas, go to **Security** → **Network Access**
2. Click **Add IP Address**
3. Add `0.0.0.0/0` to allow all IPs (required for Render.com to connect)
4. Click **Confirm**

---

## Phase 2: Test Locally with Migration

### Step 1: Install Node Dependencies

```bash
cd tester/server
npm install
```

### Step 2: Create `.env` File

Create `tester/server/.env` with your MongoDB connection string:

```bash
MONGODB_URI=mongodb+srv://your_username:your_password@cluster.mongodb.net/bonker?retryWrites=true&w=majority
PORT=3001
NODE_ENV=development
```

**Where to get it:** From MongoDB Atlas (see Phase 1, Step 2)

### Step 3: Run Local Migration

```bash
cd tester/server

# Compile TypeScript
npm run build

# Run migration script
npx ts-node src/migrate-to-mongodb.ts
```

**Expected output:**
```
🔗 Connecting to MongoDB...
✅ Connected to MongoDB
📖 Opening SQLite database...
📤 Migrating Units...
  ✅ Migrated X units
📤 Migrating Bunkers...
  ✅ Migrated X bunkers
[... more tables ...]
✅ Migration completed successfully!
```

### Step 4: Verify Data in MongoDB

1. Go to MongoDB Atlas dashboard
2. Click **Collections** 
3. You should see your tables: `units`, `bunkers`, `ammotypes`, `inventory`, etc.
4. Click into each collection to see your migrated data ✅

### Step 5: Test Server Locally

```bash
npm run dev
```

Visit `http://localhost:3001/api/health` - should return:
```json
{ "status": "ok", "timestamp": "..." }
```

---

## Phase 3: Deploy to Render

### Step 1: Add Environment Variable to Render

1. Go to your Render.com backend service
2. Click **Environment**
3. Add new variable:
   - **Key:** `MONGODB_URI`
   - **Value:** Your MongoDB connection string (from Phase 1, Step 2)
4. Click **Save Changes** → service will redeploy automatically

### Step 2: Trigger Deployment

Render will auto-rebuild and restart with MongoDB connection. Check deployment logs:
- Go to **Logs** tab
- Look for: `✅ MongoDB connected successfully`

### Step 3: Test Backend API

Visit: `https://bonker-api.onrender.com/api/health`

Should return `{ "status": "ok", ... }` ✅

---

## Phase 4: Test Full App (Frontend + Backend)

1. Visit your Netlify frontend URL
2. Navigate through the app
3. Try creating a unit, bunker, or checking inventory
4. All data should persist! ✅

---

## Troubleshooting

### Migration fails: "SQLITE_CANTOPEN"
- **Cause:** SQLite database file not found
- **Solution:** Run migration from `tester/server` directory
- Verify `data/bonker.db` exists in that directory

### "MONGODB_URI not set"
- **Cause:** Missing .env file or variable not exported
- **Solution:** Check that `.env` exists and has the correct MongoDB URI
- Verify with: `echo $MONGODB_URI` in terminal

### Render deployment fails: "Cannot connect to MongoDB"
- **Cause:** MongoDB connection string not set in Render environment
- **Solution:** Go to Render dashboard → Environment → verify `MONGODB_URI` is set
- Also check: MongoDB Atlas → Network Access → `0.0.0.0/0` is allowed

### "Permission denied" in MongoDB Atlas
- **Cause:** Network IP not whitelisted
- **Solution:** In MongoDB Atlas → Security → Network Access → ensure `0.0.0.0/0` is added

---

## What's Next?

✅ **Database:** Data now persists across deployments  
✅ **Backend:** Connected to MongoDB  
✅ **Frontend:** Already connected via API  

Your app is now **fully cloud-ready**! 🎉

### Optional Enhancements:
- **Always-on backend:** Upgrade Render to paid ($7/month) to remove 15-min auto-sleep
- **Database backups:** MongoDB Atlas includes automatic backups
- **Monitoring:** Set up Render alerts for deployment failures

---

## Questions?

Check logs:
- **Local:** Terminal output when running `npm run dev`
- **Render:** Dashboard → Logs tab
- **MongoDB:** Atlas → Activity

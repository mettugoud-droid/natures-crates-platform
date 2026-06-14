# DEPLOYMENT CHECKLIST & GUIDE

## Pre-Deployment Status

| Item | Status | Evidence |
|------|--------|----------|
| TypeScript Compilation | PASS | 0 errors (verified) |
| Unit Tests | PASS | 17/17 passing (verified) |
| Server Boot | PASS | Port 3001, all 8 connectors (verified) |
| Database Migration | PASS | 18 tables, 40 indexes (verified) |
| Seed Data | PASS | 20 products, 10 suppliers, 8 competitors (verified) |
| Authentication | PASS | 401 without key, 200 with valid key (verified) |
| RBAC | PASS | Admin/Analyst/Viewer hierarchy (verified) |
| DB Crash Recovery | PASS | Server survives DB kill (verified) |
| Docker Build | PASS | 280MB image (verified) |
| Margin Calculator | PASS | Full P&L with real numbers (verified) |
| Opportunity Scoring | PASS | 7-factor model producing 64/100 (verified) |

---

## 1. GitHub Repository Setup

```bash
# Create repository on GitHub (via github.com/new)
# Name: natures-crates-platform
# Visibility: Private

# Then locally:
cd natures-crates-platform
git remote add origin git@github.com:YOUR_ORG/natures-crates-platform.git
git push -u origin main
```

---

## 2. Environment Variables Required

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `3001` (Railway auto-assigns) |
| `DB_HOST` | Yes | Railway PostgreSQL host |
| `DB_PORT` | Yes | `5432` |
| `DB_NAME` | Yes | `natures_crates` |
| `DB_USER` | Yes | Railway PostgreSQL user |
| `DB_PASSWORD` | Yes | Railway PostgreSQL password |
| `DB_SSL` | Yes | `true` |
| `REDIS_HOST` | No | Optional (rate limiter falls back to memory) |
| `CLERK_SECRET_KEY` | Yes | From clerk.com dashboard |
| `CLERK_PUBLISHABLE_KEY` | Yes | From clerk.com dashboard |
| `API_KEYS` | Yes | `your_admin_key:admin:admin,your_viewer_key:viewer:viewer` |
| `ANTHROPIC_API_KEY` | Recommended | For AI recommendations |
| `KEEPA_API_KEY` | Recommended | For Amazon data |
| `DATAFORSEO_LOGIN` | Recommended | For Google Trends |
| `DATAFORSEO_PASSWORD` | Recommended | For Google Trends |
| `BRIGHT_DATA_API_KEY` | Optional | For Flipkart data |
| `APIFY_API_KEY` | Optional | For supplier discovery |
| `FRONTEND_URL` | Yes | Your Vercel frontend URL |
| `CRON_ENABLED` | Yes | `true` |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Railway backend URL (e.g., `https://natures-crates-api.up.railway.app`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | From clerk.com dashboard |

---

## 3. Railway Deployment (Backend + PostgreSQL)

### Step 1: Create Railway Project
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init
```

### Step 2: Add PostgreSQL
```bash
# In Railway dashboard:
# 1. Click "New Service" → "Database" → "PostgreSQL"
# 2. Copy the DATABASE_URL connection string
# 3. The DB variables are auto-injected into your service
```

### Step 3: Deploy Backend
```bash
# In Railway dashboard or CLI:
railway up

# Or configure via dashboard:
# Root Directory: packages/backend
# Build Command: cd ../.. && npm install && npm run build --workspace=@natures-crates/shared && cd packages/backend && npm run build
# Start Command: node dist/src/index.js
```

### Step 4: Run Migrations
```bash
# Connect to Railway database
railway run psql $DATABASE_URL -f packages/backend/src/db/migrations/001_initial_schema.sql

# Run seeds
railway run psql $DATABASE_URL -f packages/backend/src/db/seeds/001_data_sources.sql
railway run psql $DATABASE_URL -f packages/backend/src/db/seeds/002_sample_products.sql
railway run psql $DATABASE_URL -f packages/backend/src/db/seeds/003_sample_suppliers.sql
railway run psql $DATABASE_URL -f packages/backend/src/db/seeds/004_sample_competitors.sql
```

### Step 5: Set Environment Variables
```bash
railway variables set NODE_ENV=production
railway variables set CLERK_SECRET_KEY=sk_live_...
railway variables set API_KEYS=nc_admin_2024:admin:admin,nc_analyst_2024:analyst:analyst
railway variables set CRON_ENABLED=true
railway variables set FRONTEND_URL=https://natures-crates.vercel.app
```

---

## 4. Vercel Deployment (Frontend)

### Step 1: Connect Repository
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd packages/frontend
vercel --prod
```

### Step 2: Configure in Vercel Dashboard
- Framework: Next.js
- Root Directory: `packages/frontend`
- Build Command: `cd ../.. && npm install && npm run build --workspace=@natures-crates/shared && cd packages/frontend && npm run build`
- Output Directory: `.next`

### Step 3: Set Environment Variables in Vercel
```
NEXT_PUBLIC_API_URL = https://your-railway-backend.up.railway.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_...
```

---

## 5. PostgreSQL Backup Strategy

### Automated Daily Backups (Railway)
Railway PostgreSQL includes automated daily backups with 7-day retention.

### Manual Backup
```bash
# Create backup
railway run pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip backup_20260614.sql.gz
railway run psql $DATABASE_URL < backup_20260614.sql
```

### Recommended: Weekly export to S3/GCS
```bash
# Cron job on any server:
0 3 * * 0 railway run pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://nc-backups/weekly/$(date +%Y%m%d).sql.gz
```

---

## 6. Rollback Strategy

### Code Rollback
```bash
# Railway supports instant rollback to previous deployment
railway rollback

# Or deploy specific commit
git revert HEAD
git push origin main
# Railway auto-deploys
```

### Database Rollback
```bash
# Railway: Restore from automated backup in dashboard
# Manual: Use the backup files from Step 5
```

### Feature Flag Approach
```bash
# Disable specific connectors without redeploying:
# POST /api/compliance/connectors/keepa/disable
curl -X POST https://api.natures-crates.com/api/compliance/connectors/keepa/disable \
  -H "x-api-key: your_admin_key"
```

---

## 7. Production Monitoring Setup

### Health Monitoring
```bash
# UptimeRobot (free):
# URL: https://your-railway-url.up.railway.app/api/health
# Check interval: 5 minutes
# Alert: Email + Slack

# Detailed health:
# URL: https://your-railway-url.up.railway.app/api/health/detailed
# Expected: {"status":"healthy"}
```

### Application Metrics
```
# Prometheus endpoint available at:
GET /api/metrics

# Key metrics:
- http_requests_total
- http_errors_total
- http_request_duration_ms
- process_uptime_seconds
```

### Error Tracking (Recommended)
```bash
# Add Sentry (free tier):
npm install @sentry/node
# Configure in src/index.ts
```

### Log Monitoring
- Railway provides built-in log streaming
- All logs are structured JSON via Winston
- Filter by: `service: "natures-crates-api"`

---

## 8. Admin Login Credentials Creation

### Using Clerk Dashboard
1. Go to https://dashboard.clerk.com
2. Create application → "Nature's Crates Intelligence"
3. Enable Email/Password sign-in
4. Create first user (admin):
   - Email: admin@natures-crates.com
   - Set public metadata: `{"role": "admin"}`
5. Create analyst user:
   - Email: analyst@natures-crates.com
   - Set public metadata: `{"role": "analyst"}`

### Using API Keys (Immediate Access)
```bash
# Set in Railway environment:
API_KEYS=nc_admin_key_CHANGE_ME:admin:admin,nc_analyst_key_CHANGE_ME:analyst:analyst,nc_viewer_key_CHANGE_ME:viewer:viewer

# Test:
curl -H "x-api-key: nc_admin_key_CHANGE_ME" https://your-api.railway.app/api/health/detailed
```

---

## 9. First User Onboarding Guide

### For Admin Users:
1. Navigate to `https://natures-crates.vercel.app`
2. Login with Clerk credentials (or use API key for direct API access)
3. Check Dashboard → Verify all panels load
4. Go to Product Finder → View Top 10/25/50 recommendations
5. Go to Compliance → Verify all connectors show status
6. Test Margin Calculator:
   - Go to any product → Calculate Margin
   - Verify P&L breakdown

### For Analyst Users:
1. Login (will have read + analyze access)
2. Can view all data, run analyses, generate reports
3. Cannot: modify system settings, enable/disable connectors

### For Viewer Users:
1. Login (read-only access)
2. Can view dashboards, products, reports
3. Cannot: trigger analyses, modify data

---

## 10. Post-Deployment Verification Commands

```bash
API_URL="https://your-railway-url.up.railway.app"
API_KEY="nc_admin_key_CHANGE_ME"

# 1. Health Check
curl -s $API_URL/api/health | python3 -m json.tool

# 2. Detailed Health (DB connected?)
curl -s $API_URL/api/health/detailed | python3 -m json.tool

# 3. Auth Test (should return 401)
curl -s $API_URL/api/products | python3 -m json.tool

# 4. Auth Test (should return 200)
curl -s -H "x-api-key: $API_KEY" $API_URL/api/products/dashboard/stats | python3 -m json.tool

# 5. Product Finder
curl -s -H "x-api-key: $API_KEY" $API_URL/api/product-finder/top-10 | python3 -m json.tool

# 6. Margin Calculator
curl -s -X POST -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"productId":"UUID_HERE","sellingPrice":499,"productCost":175,"category":"trail_mixes","channel":"amazon_india"}' \
  $API_URL/api/margins/calculate | python3 -m json.tool

# 7. Metrics
curl -s $API_URL/api/metrics
```

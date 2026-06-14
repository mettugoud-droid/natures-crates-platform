# Deployment Guide

## Production Deployment Options

### Option 1: Docker Compose (Self-Hosted / VPS)

```bash
# 1. Clone repository
git clone https://github.com/YOUR_ORG/natures-crates-platform.git
cd natures-crates-platform

# 2. Configure environment
cp .env.example .env
# Edit .env with production values

# 3. Build and start
docker-compose up -d --build

# 4. Run migrations (first time only)
docker-compose exec backend npm run db:migrate

# 5. Seed initial data (optional)
docker-compose exec backend npm run db:seed

# 6. Verify
curl http://localhost:3001/api/health
```

### Option 2: Railway (Recommended for Backend)

1. **Create Railway Project**
   - Connect GitHub repository
   - Add PostgreSQL service
   - Add Redis service

2. **Configure Backend Service**
   - Root directory: `packages/backend`
   - Build command: `npm run build`
   - Start command: `npm run start`
   - Add environment variables from `.env.example`

3. **Database Setup**
   ```
   railway run npm run db:migrate
   railway run npm run db:seed
   ```

4. **Enable Cron Jobs**
   - Set `CRON_ENABLED=true` in environment

### Option 3: Vercel (Frontend)

1. **Import Project**
   - Framework: Next.js
   - Root directory: `packages/frontend`

2. **Environment Variables**
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-backend.railway.app
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   ```

3. **Build Settings**
   - Build command: `cd ../.. && npm install && npm run build --workspace=@natures-crates/shared && cd packages/frontend && npm run build`
   - Output directory: `.next`

---

## Environment Variables Reference

### Required for Production

| Variable | Service | Description |
|----------|---------|-------------|
| `DB_HOST` | Backend | PostgreSQL host |
| `DB_PASSWORD` | Backend | PostgreSQL password |
| `REDIS_HOST` | Backend | Redis host |
| `ANTHROPIC_API_KEY` | Backend | Claude AI for recommendations |
| `CLERK_SECRET_KEY` | Backend | Authentication |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Frontend | Clerk auth key |

### Data Provider Keys (Add as needed)

| Variable | Provider | Purpose |
|----------|----------|---------|
| `KEEPA_API_KEY` | Keepa | Amazon price/sales history |
| `BRIGHT_DATA_API_KEY` | Bright Data | Marketplace data |
| `DATAFORSEO_LOGIN` | DataForSEO | Google Trends data |
| `AMAZON_PA_API_KEY` | Amazon | Product search |
| `INDIAMART_CRM_KEY` | IndiaMART | Supplier discovery |

---

## Scaling Considerations

### Database
- Use connection pooling (PgBouncer) for > 50 concurrent connections
- Add read replicas for analytics queries
- Partition `compliance_records` table by month

### Redis
- Use Redis Cluster for > 10K concurrent job queues
- Separate instances for caching vs job queues

### Backend
- Deploy multiple instances behind load balancer
- Use PM2 cluster mode for Node.js
- Scale cron jobs to separate worker service

### Data Pipeline
- Run Python workers on separate containers
- Use Celery + Redis for distributed task execution
- Scale Bright Data collectors independently

---

## Monitoring Setup

### Health Checks
- Backend: `GET /api/health`
- Database: Connection pool monitoring via `pg_stat_activity`
- Redis: `redis-cli ping`

### Recommended Tools
- **Uptime**: UptimeRobot or Better Uptime
- **APM**: Datadog or New Relic
- **Logging**: Datadog Logs or Papertrail
- **Error Tracking**: Sentry
- **Metrics**: Grafana + Prometheus

---

## Backup Strategy

### Database
```bash
# Daily automated backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > backup_$(date +%Y%m%d).sql.gz

# Upload to S3
aws s3 cp backup_*.sql.gz s3://natures-crates-backups/daily/
```

### Redis
- Enable RDB persistence
- Configure AOF for minimal data loss

---

## SSL/TLS
- Use Let's Encrypt via Caddy or nginx-proxy
- Railway and Vercel provide SSL automatically
- Force HTTPS in production via `helmet()` middleware

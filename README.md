# Nature's Crates - AI-Powered Product Intelligence Platform

> AI-Powered Product Discovery, White-Label Sourcing & Margin Intelligence Platform

## Overview

A production-ready SaaS platform that continuously discovers profitable products from Indian marketplaces, identifies white-label opportunities, finds manufacturers, calculates margins, and recommends products for the Nature's Crates brand.

## Architecture

```
natures-crates-platform/
├── packages/
│   ├── frontend/        # Next.js + React + TypeScript + Tailwind + ShadCN
│   ├── backend/         # Node.js + Express + TypeScript
│   ├── data-pipeline/   # Python + LangGraph + LangChain
│   └── shared/          # Shared types, constants, utilities
├── docker-compose.yml   # Full-stack Docker deployment
├── turbo.json           # Turborepo build orchestration
└── .env.example         # Environment configuration template
```

## Core Features

### 1. Product Intelligence Dashboard
- Real-time monitoring of Amazon India, Flipkart trending products
- Best Sellers, Movers & Shakers, New Releases tracking
- Google Trends integration for demand signals
- Category-wise opportunity scoring

### 2. Margin Analyzer
- Complete P&L calculation per product
- Accounts for: Product Cost, Manufacturing, Packaging, Branding, Shipping, GST, Marketing, Returns, Marketplace Fees
- Auto-identifies products with 40%+ gross / 20%+ net margins
- Recommended pricing engine

### 3. White-Label Opportunity Detector
- 7-factor scoring: Demand, Competition, Margin, Manufacturing Ease, Repeat Purchase, Branding Potential, Regulatory Complexity
- Opportunity Score 0-100 with classification (Excellent/Good/Moderate/Avoid)
- AI-enhanced analysis with Claude API

### 4. Manufacturer Discovery Engine
- IndiaMART, TradeIndia, ExportersIndia integration
- Supplier Trust Score (0-100) with verification workflow
- OEM, White-Label, Custom Packaging capability tracking

### 5. AI Recommendation Engine
- Top 10 lists for 8 categories:
  - Products to Launch
  - White-Label Opportunities
  - D2C Products
  - Corporate Gifting
  - Blinkit Products
  - Zepto Products
  - High Repeat Purchase
  - Low Investment
- Claude AI + rule-based hybrid ranking

### 6. Compliance Engine
- Tiered data acquisition (Official APIs > Approved Providers > Configurable Connectors)
- Full audit trail with timestamps
- Rate limiting, retry logic, proxy management
- Compliance reporting (daily/weekly/monthly)

### 7. Daily Automation Pipeline
- 9-step automated workflow running daily
- Product scanning, opportunity detection, margin calculation
- Executive summary generation
- LangGraph workflow orchestration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, ShadCN UI, Recharts |
| Backend | Node.js, Express, TypeScript, Zod validation |
| Database | PostgreSQL 16 with full-text search |
| Cache/Queue | Redis, BullMQ |
| AI | Claude API (Anthropic), OpenAI, LangGraph, LangChain |
| Data Pipeline | Python, LangGraph workflows |
| Authentication | Clerk |
| Deployment | Docker, Vercel, Railway |
| Build | Turborepo, npm workspaces |

## Data Connector Framework

### Tier 1: Official APIs
- Amazon Product Advertising API (PA-API v5)
- Google Trends (via DataForSEO)
- Meta Ads Library API

### Tier 2: Approved Providers
- Bright Data (web data platform)
- Keepa (Amazon price/sales history)
- Apify (structured web data)
- DataForSEO (search analytics)

### Tier 3: Configurable Connectors
- IndiaMART (supplier discovery)
- TradeIndia, ExportersIndia
- Custom adapters via base connector pattern

All connectors implement:
- Rate limiting (Bottleneck)
- Exponential backoff retry
- Health checks
- Enable/disable at runtime
- Compliance audit logging

## Database Schema

Key tables:
- `products` - Core product data with quality scores
- `margin_analyses` - Full P&L calculations
- `white_label_opportunities` - 7-factor opportunity scoring
- `suppliers` - Manufacturer/supplier directory
- `supplier_verifications` - Trust score workflow
- `competitors` - Competitive intelligence
- `market_risks` - Risk classification
- `product_bundles` - Bundle creation engine
- `ai_recommendations` - AI-generated ranked lists
- `compliance_records` - Full audit trail
- `data_sources` - Connector configuration
- `job_executions` - Pipeline execution log
- `daily_reports` - Executive summaries

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Python 3.11+ (for data pipeline)
- Docker & Docker Compose (optional)

### With Docker (Recommended)

```bash
# Clone and configure
cp .env.example .env
# Edit .env with your API keys

# Start all services
docker-compose up -d

# Access
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# API Health: http://localhost:3001/api/health
```

### Manual Setup

```bash
# Install dependencies
npm install

# Set up database
createdb natures_crates
psql natures_crates < packages/backend/src/db/migrations/001_initial_schema.sql

# Start development
npm run dev

# Or individually:
cd packages/backend && npm run dev
cd packages/frontend && npm run dev

# Python pipeline
cd packages/data-pipeline
pip install -r requirements.txt
python main.py daily
```

## API Endpoints

### Products
- `GET /api/products` - Search products with filters
- `GET /api/products/:id` - Product details with analysis
- `POST /api/products/discover` - Trigger discovery
- `GET /api/products/dashboard/stats` - Dashboard KPIs

### Margins
- `POST /api/margins/calculate` - Calculate product margin
- `GET /api/margins/:productId` - Get margin analysis
- `GET /api/margins/high-margin/list` - High-margin products

### Opportunities
- `GET /api/opportunities` - Top white-label opportunities
- `POST /api/opportunities/analyze` - Analyze product
- `POST /api/opportunities/batch-analyze` - Batch analysis

### Suppliers
- `POST /api/suppliers/search` - Search manufacturers
- `GET /api/suppliers/product/:id` - Suppliers for product
- `POST /api/suppliers/:id/verify` - Verify supplier
- `GET /api/suppliers/top` - Top verified suppliers

### Recommendations
- `GET /api/recommendations/:category` - Get AI recommendations
- `POST /api/recommendations/generate` - Generate fresh
- `POST /api/recommendations/generate-all` - Generate all lists

### Compliance
- `GET /api/compliance/report` - Compliance report
- `GET /api/compliance/sources` - Data source metrics
- `GET /api/compliance/connectors` - Connector status

## Environment Variables

See `.env.example` for complete list. Key variables:

| Variable | Description |
|----------|------------|
| `ANTHROPIC_API_KEY` | Claude AI for recommendations |
| `KEEPA_API_KEY` | Amazon price/sales data |
| `BRIGHT_DATA_API_KEY` | Marketplace data collection |
| `DATAFORSEO_LOGIN/PASSWORD` | Google Trends data |
| `INDIAMART_CRM_KEY` | Supplier discovery |

## Daily Automation Schedule (IST)

| Time | Job |
|------|-----|
| 2:00 AM | Product Discovery (all categories) |
| 4:00 AM | Margin Calculations |
| 5:00 AM | White-Label Analysis |
| 7:00 AM | Report Generation & AI Recommendations |

## Deployment

### Vercel (Frontend)
- Connect GitHub repo
- Set root directory: `packages/frontend`
- Add environment variables

### Railway (Backend + DB + Redis)
- Deploy from GitHub
- Auto-provisions PostgreSQL and Redis
- Set environment variables

### Docker (Self-hosted)
```bash
docker-compose up -d --build
```

## Future Integrations Ready

The adapter pattern architecture supports adding:
- Shopify, WooCommerce, Shopdeck
- Zoho Inventory, Tally
- Amazon Seller Central, Flipkart Seller Hub
- Blinkit/Zepto/Instamart Seller Portals
- Notion, Airtable, Google Sheets

## Success Metrics

The platform identifies products that:
- Can be white-labeled with reliable manufacturers
- Have 40%+ gross margins and 20%+ net margins
- Show strong demand with growth trends
- Require low initial investment
- Have high repeat purchase potential
- Fit the Nature's Crates brand strategy

---

Built for Nature's Crates Product Strategy Team

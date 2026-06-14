# System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            Next.js Frontend (Vercel)                        │  │
│  │  Dashboard │ Products │ Opportunities │ Suppliers │ Reports │  │
│  └────────────────────────────┬───────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │ REST API
┌───────────────────────────────┼──────────────────────────────────┐
│                        API LAYER                                  │
│  ┌────────────────────────────┴───────────────────────────────┐  │
│  │              Express.js Backend (Railway)                    │  │
│  │  Routes │ Middleware │ Validation │ Auth (Clerk)            │  │
│  └────────────────────────────┬───────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                      SERVICE LAYER                                │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Product  │ │  Margin      │ │ White    │ │ Manufacturer  │  │
│  │ Intel.   │ │  Analyzer    │ │ Label    │ │ Discovery     │  │
│  └──────────┘ └──────────────┘ │ Detector │ └───────────────┘  │
│  ┌──────────┐ ┌──────────────┐ └──────────┘ ┌───────────────┐  │
│  │ AI Rec.  │ │  Compliance  │ ┌──────────┐ │  Bundle       │  │
│  │ Engine   │ │  Engine      │ │Competitor│ │  Engine       │  │
│  └──────────┘ └──────────────┘ └──────────┘ └───────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                    DATA CONNECTOR LAYER                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │   TIER 1        │  │   TIER 2         │  │   TIER 3       │  │
│  │  Official APIs  │  │  Approved        │  │  Configurable  │  │
│  │  ─────────────  │  │  Providers       │  │  Connectors    │  │
│  │  Amazon PA-API  │  │  ─────────────── │  │  ───────────── │  │
│  │  Google Trends  │  │  Bright Data     │  │  IndiaMART     │  │
│  │  Meta Ads       │  │  Keepa           │  │  TradeIndia    │  │
│  │  YouTube        │  │  Apify           │  │  Alibaba       │  │
│  │                 │  │  DataForSEO      │  │  MSME Dir.     │  │
│  │                 │  │  Semrush         │  │  ExportersIndia│  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                    AI & PIPELINE LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Python Data Pipeline (LangGraph)               │   │
│  │  Product Analysis │ Opportunity Detection │ Daily Pipeline │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────┐  ┌────────────────────────────────────┐   │
│  │  Claude API      │  │  Job Scheduler (node-cron)         │   │
│  │  (Anthropic)     │  │  Daily Discovery │ Margin Calc     │   │
│  │                  │  │  WL Analysis │ Report Generation    │   │
│  └──────────────────┘  └────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                    DATA LAYER                                     │
│  ┌──────────────────┐       ┌────────────────────────────────┐  │
│  │  PostgreSQL 16   │       │  Redis 7                        │  │
│  │  ──────────────  │       │  ─────                          │  │
│  │  Products        │       │  Job Queues                     │  │
│  │  Suppliers       │       │  Rate Limit Counters            │  │
│  │  Margins         │       │  Cache Layer                    │  │
│  │  Opportunities   │       │  Session Store                  │  │
│  │  Competitors     │       │                                 │  │
│  │  Compliance Logs │       │                                 │  │
│  │  Reports         │       │                                 │  │
│  └──────────────────┘       └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Scoring Algorithms

### Opportunity Score (0-100)

```
Score = (Demand × 0.20) + (CompetitionGap × 0.15) + (Margin × 0.25) 
      + (ManufacturingEase × 0.10) + (RepeatPurchase × 0.15) 
      + (BrandingPotential × 0.10) + (RegulatorySimplicity × 0.05)
```

| Factor | Weight | Scoring Logic |
|--------|--------|---------------|
| Demand | 20% | Monthly sales volume + growth rate |
| Competition Gap | 15% | 100 - competition level (lower comp = better) |
| Margin | 25% | Gross margin potential vs 40% target |
| Manufacturing Ease | 10% | Category-based complexity score |
| Repeat Purchase | 15% | Category frequency + consistent sales signals |
| Branding Potential | 10% | Category + competition headroom |
| Regulatory Simplicity | 5% | 100 - regulatory complexity |

### Supplier Trust Score (0-100)

```
Score = GST(25) + BusinessAge(15) + Certifications(20) 
      + OEM(10) + ResponseRate(15) + Reviews(15)
```

| Factor | Max Points | Logic |
|--------|-----------|-------|
| GST Verified | 25 | Binary: verified or not |
| Business Age | 15 | 10+ yrs = 15, 5+ = 10, 2+ = 5 |
| Certifications | 20 | 5 pts per cert, max 20 |
| OEM Capable | 10 | Binary |
| Response Rate | 15 | Proportional to 0-100% |
| Review Score | 15 | Proportional to 0-5 stars |

### Margin Calculation

```
Revenue = Selling Price

COGS = Product Cost + Manufacturing + Packaging + Branding
Variable = Shipping + GST + Marketing + Returns + Marketplace Fees

Gross Profit = Revenue - COGS - Shipping - GST - Marketplace Fees
Gross Margin % = Gross Profit / Revenue × 100

Net Profit = Revenue - COGS - All Variable Costs
Net Margin % = Net Profit / Revenue × 100

ROI % = (Net Profit × Monthly Sales) / (COGS × Monthly Sales) × 100
Break-Even Units = Fixed Costs / Net Profit per Unit
```

## Data Flow

1. **Discovery** → Connectors fetch from marketplaces
2. **Ingestion** → Products normalized and stored
3. **Analysis** → Margin, competition, and opportunity scoring
4. **AI Enhancement** → Claude ranks and provides insights
5. **Reporting** → Executive summaries generated daily
6. **Action** → Launch recommendations with supplier matches

/**
 * Helium10 Connector (Phase 9)
 * Amazon product research and analytics provider
 * Adapter pattern: Can be replaced with Jungle Scout or SmartScout
 */

import axios from 'axios';
import { BaseDataConnector, DataConnectorConfig, ConnectorResult } from '../base';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface H10ProductData {
  asin: string;
  title: string;
  brand: string;
  price: number;
  monthlyRevenue: number;
  monthlySales: number;
  bsr: number;
  rating: number;
  reviewCount: number;
  reviewVelocity: number; // reviews per month
  category: string;
  sellerCount: number;
  listingAge: number; // days
  imageCount: number;
  variationCount: number;
  fulfillment: 'FBA' | 'FBM' | 'Amazon';
  opportunityScore: number;
}

export interface H10KeywordData {
  keyword: string;
  searchVolume: number;
  competingProducts: number;
  topClickedAsin: string;
  cpc: number; // cost per click
  trend: 'rising' | 'stable' | 'declining';
  organicPosition: number | null;
  titleDensity: number;
}

export interface H10MarketData {
  category: string;
  totalProducts: number;
  avgPrice: number;
  avgRevenue: number;
  avgBsr: number;
  topBrands: { brand: string; marketShare: number }[];
  entryBarrier: 'low' | 'medium' | 'high';
  seasonality: string;
}

const HELIUM10_CONFIG: DataConnectorConfig = {
  name: 'Helium10',
  tier: 'tier_2_approved_provider',
  provider: 'Helium10',
  enabled: !!process.env.HELIUM10_API_KEY,
  rateLimit: {
    maxConcurrent: 2,
    minTime: 3000,
    reservoir: 200,
    reservoirRefreshInterval: 3600000,
  },
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
};

export class Helium10Connector extends BaseDataConnector {
  private apiKey: string;
  private baseUrl = 'https://api.helium10.com/v1';

  constructor() {
    super(HELIUM10_CONFIG);
    this.apiKey = process.env.HELIUM10_API_KEY || '';
  }

  /**
   * Black Box - Product Research
   * Find products matching criteria
   */
  async productResearch(params: {
    category?: string;
    minRevenue?: number;
    maxRevenue?: number;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    maxReviews?: number;
    marketplace?: string;
  }): Promise<ConnectorResult<H10ProductData[]>> {
    return this.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/black-box/products`, {
        params: {
          marketplace: params.marketplace || 'IN',
          category: params.category,
          min_revenue: params.minRevenue,
          max_revenue: params.maxRevenue,
          min_price: params.minPrice,
          max_price: params.maxPrice,
          min_rating: params.minRating,
          max_reviews: params.maxReviews,
          limit: 50,
        },
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 30000,
      });

      return (response.data?.products || []).map((p: any) => this.mapProduct(p));
    }, `productResearch`);
  }

  /**
   * Cerebro - Keyword Research by ASIN
   */
  async keywordResearch(asin: string): Promise<ConnectorResult<H10KeywordData[]>> {
    return this.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/cerebro`, {
        params: { asin, marketplace: 'IN' },
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 30000,
      });

      return (response.data?.keywords || []).map((k: any) => ({
        keyword: k.keyword || '',
        searchVolume: k.search_volume || 0,
        competingProducts: k.competing_products || 0,
        topClickedAsin: k.top_clicked_asin || '',
        cpc: k.cpc || 0,
        trend: k.trend || 'stable',
        organicPosition: k.organic_position || null,
        titleDensity: k.title_density || 0,
      }));
    }, `keywordResearch:${asin}`);
  }

  /**
   * Market Tracker - Category analytics
   */
  async marketAnalysis(category: string): Promise<ConnectorResult<H10MarketData | null>> {
    return this.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/market-tracker`, {
        params: { category, marketplace: 'IN' },
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 30000,
      });

      const data = response.data;
      if (!data) return null;

      return {
        category,
        totalProducts: data.total_products || 0,
        avgPrice: data.avg_price || 0,
        avgRevenue: data.avg_revenue || 0,
        avgBsr: data.avg_bsr || 0,
        topBrands: (data.top_brands || []).map((b: any) => ({
          brand: b.brand,
          marketShare: b.market_share || 0,
        })),
        entryBarrier: data.entry_barrier || 'medium',
        seasonality: data.seasonality || 'stable',
      };
    }, `marketAnalysis:${category}`);
  }

  private mapProduct(raw: any): H10ProductData {
    return {
      asin: raw.asin || '',
      title: raw.title || '',
      brand: raw.brand || '',
      price: raw.price || 0,
      monthlyRevenue: raw.monthly_revenue || raw.revenue || 0,
      monthlySales: raw.monthly_sales || raw.sales || 0,
      bsr: raw.bsr || raw.sales_rank || 0,
      rating: raw.rating || 0,
      reviewCount: raw.review_count || raw.reviews || 0,
      reviewVelocity: raw.review_velocity || 0,
      category: raw.category || '',
      sellerCount: raw.seller_count || 1,
      listingAge: raw.listing_age || 0,
      imageCount: raw.image_count || 0,
      variationCount: raw.variation_count || 0,
      fulfillment: raw.fulfillment || 'FBA',
      opportunityScore: raw.opportunity_score || 0,
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await axios.get(`${this.baseUrl}/status`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  getName(): string { return 'Helium10'; }
  getTier(): string { return 'tier_2_approved_provider'; }
}

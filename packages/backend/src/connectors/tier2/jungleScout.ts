/**
 * Jungle Scout Connector (Phase 9)
 * Amazon product & keyword research provider
 * Interchangeable adapter with Helium10
 */

import axios from 'axios';
import { BaseDataConnector, DataConnectorConfig, ConnectorResult } from '../base';
import { logger } from '../../utils/logger';

export interface JSProductData {
  asin: string;
  title: string;
  brand: string;
  price: number;
  estimatedRevenue: number;
  estimatedSales: number;
  bsr: number;
  rating: number;
  reviews: number;
  category: string;
  sellerType: string;
  dateFirstAvailable: string;
  dimensions: string;
  weight: string;
  fees: number;
  netProfit: number;
  roi: number;
  opportunityScore: number; // Jungle Scout's proprietary score
}

export interface JSKeywordData {
  keyword: string;
  exactSearchVolume: number;
  broadSearchVolume: number;
  recommendedPPC: number;
  competitiveness: 'low' | 'medium' | 'high' | 'very_high';
  trend30d: number; // % change
  trend90d: number;
  seasonality: number[]; // 12 months
}

export interface JSNicheAnalysis {
  niche: string;
  avgMonthlySales: number;
  avgMonthlyRevenue: number;
  avgPrice: number;
  avgReviews: number;
  competitionLevel: number; // 1-10
  demandScore: number; // 1-10
  nicheScore: number; // Jungle Scout's proprietary
  topProducts: JSProductData[];
}

const JUNGLE_SCOUT_CONFIG: DataConnectorConfig = {
  name: 'Jungle Scout',
  tier: 'tier_2_approved_provider',
  provider: 'Jungle Scout',
  enabled: !!process.env.JUNGLE_SCOUT_API_KEY,
  rateLimit: {
    maxConcurrent: 2,
    minTime: 3000,
    reservoir: 150,
    reservoirRefreshInterval: 3600000,
  },
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
};

export class JungleScoutConnector extends BaseDataConnector {
  private apiKey: string;
  private baseUrl = 'https://developer.junglescout.com/api';

  constructor() {
    super(JUNGLE_SCOUT_CONFIG);
    this.apiKey = process.env.JUNGLE_SCOUT_API_KEY || '';
  }

  /**
   * Product Database - search Amazon products
   */
  async searchProducts(params: {
    categories?: string[];
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    minSales?: number;
    maxReviews?: number;
    marketplace?: string;
  }): Promise<ConnectorResult<JSProductData[]>> {
    return this.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/product_database_query`, {
        params: {
          marketplace: params.marketplace || 'in',
          'include_categories[]': params.categories,
          min_price: params.minPrice,
          max_price: params.maxPrice,
          min_rating: params.minRating,
          min_estimated_sales: params.minSales,
          max_reviews: params.maxReviews,
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-Type': 'junglescout',
          'Accept': 'application/vnd.junglescout.v1+json',
        },
        timeout: 30000,
      });

      return (response.data?.data || []).map((item: any) => this.mapProduct(item));
    }, 'searchProducts');
  }

  /**
   * Keyword Scout - keyword research
   */
  async keywordScout(params: {
    keywords: string[];
    marketplace?: string;
  }): Promise<ConnectorResult<JSKeywordData[]>> {
    return this.execute(async () => {
      const response = await axios.post(`${this.baseUrl}/keywords/keywords_by_keyword_query`, {
        data: {
          type: 'keywords_by_keyword_query',
          attributes: {
            search_terms: params.keywords.join(','),
            marketplace: params.marketplace || 'in',
            sort: '-monthly_search_volume_exact',
          },
        },
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/vnd.junglescout.v1+json',
        },
        timeout: 30000,
      });

      return (response.data?.data || []).map((k: any) => ({
        keyword: k.attributes?.name || '',
        exactSearchVolume: k.attributes?.monthly_search_volume_exact || 0,
        broadSearchVolume: k.attributes?.monthly_search_volume_broad || 0,
        recommendedPPC: k.attributes?.recommended_promotions_bid || 0,
        competitiveness: this.mapCompetitiveness(k.attributes?.ease_of_ranking_score),
        trend30d: k.attributes?.monthly_trend || 0,
        trend90d: k.attributes?.quarterly_trend || 0,
        seasonality: k.attributes?.monthly_search_volumes || Array(12).fill(0),
      }));
    }, `keywordScout:${params.keywords.join(',')}`);
  }

  /**
   * Niche Hunter - find profitable niches
   */
  async nicheAnalysis(category: string): Promise<ConnectorResult<JSNicheAnalysis | null>> {
    return this.execute(async () => {
      const products = await this.searchProducts({
        categories: [category],
        minSales: 100,
        marketplace: 'in',
      });

      if (!products.data || products.data.length === 0) return null;

      const prods = products.data;
      const avgSales = prods.reduce((s, p) => s + p.estimatedSales, 0) / prods.length;
      const avgRevenue = prods.reduce((s, p) => s + p.estimatedRevenue, 0) / prods.length;
      const avgPrice = prods.reduce((s, p) => s + p.price, 0) / prods.length;
      const avgReviews = prods.reduce((s, p) => s + p.reviews, 0) / prods.length;

      return {
        niche: category,
        avgMonthlySales: avgSales,
        avgMonthlyRevenue: avgRevenue,
        avgPrice,
        avgReviews,
        competitionLevel: avgReviews > 1000 ? 8 : avgReviews > 500 ? 6 : avgReviews > 100 ? 4 : 2,
        demandScore: avgSales > 1000 ? 9 : avgSales > 500 ? 7 : avgSales > 100 ? 5 : 3,
        nicheScore: Math.round((avgSales / Math.max(avgReviews, 1)) * 10),
        topProducts: prods.slice(0, 10),
      };
    }, `nicheAnalysis:${category}`);
  }

  private mapProduct(raw: any): JSProductData {
    const attrs = raw.attributes || raw;
    return {
      asin: attrs.asin || raw.id || '',
      title: attrs.title || '',
      brand: attrs.brand || '',
      price: attrs.price || 0,
      estimatedRevenue: attrs.approximate_30_day_revenue || 0,
      estimatedSales: attrs.approximate_30_day_units_sold || 0,
      bsr: attrs.best_sellers_rank || 0,
      rating: attrs.rating || 0,
      reviews: attrs.reviews || 0,
      category: attrs.category || '',
      sellerType: attrs.seller_type || '',
      dateFirstAvailable: attrs.date_first_available || '',
      dimensions: attrs.dimensions || '',
      weight: attrs.weight || '',
      fees: attrs.fba_fees || 0,
      netProfit: attrs.net || 0,
      roi: attrs.roi || 0,
      opportunityScore: attrs.niche_score || attrs.opportunity_score || 0,
    };
  }

  private mapCompetitiveness(score: number): 'low' | 'medium' | 'high' | 'very_high' {
    if (score >= 8) return 'low'; // Easy to rank
    if (score >= 5) return 'medium';
    if (score >= 3) return 'high';
    return 'very_high';
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

  getName(): string { return 'Jungle Scout'; }
  getTier(): string { return 'tier_2_approved_provider'; }
}

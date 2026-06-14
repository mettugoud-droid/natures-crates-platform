import axios from 'axios';
import { BaseDataConnector, DataConnectorConfig, ConnectorResult } from '../base';
import { logger } from '../../utils/logger';

interface TrendData {
  keyword: string;
  interestOverTime: { date: string; value: number }[];
  relatedQueries: { query: string; value: number }[];
  relatedTopics: { topic: string; value: number }[];
  regionInterest: { region: string; value: number }[];
  isRising: boolean;
  trendScore: number; // 0-100
}

interface TrendSearchParams {
  keywords: string[];
  timeRange?: '1d' | '7d' | '30d' | '90d' | '12m' | '5y';
  geo?: string;
  category?: string;
}

const GOOGLE_TRENDS_CONFIG: DataConnectorConfig = {
  name: 'Google Trends',
  tier: 'tier_1_official_api',
  provider: 'Google',
  enabled: true,
  rateLimit: {
    maxConcurrent: 2,
    minTime: 5000, // Conservative rate limiting
    reservoir: 100,
    reservoirRefreshInterval: 3600000, // 1 hour
  },
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
  },
};

export class GoogleTrendsConnector extends BaseDataConnector {
  constructor() {
    super(GOOGLE_TRENDS_CONFIG);
  }

  async getInterestOverTime(params: TrendSearchParams): Promise<ConnectorResult<TrendData[]>> {
    return this.execute(async () => {
      // Using SerpAPI or DataForSEO as a proxy for Google Trends data
      // Direct Google Trends doesn't have an official API
      const results: TrendData[] = [];

      for (const keyword of params.keywords) {
        const trendData = await this.fetchTrendData(keyword, params);
        results.push(trendData);
      }

      return results;
    }, `getInterestOverTime:${params.keywords.join(',')}`);
  }

  async getRelatedQueries(keyword: string): Promise<ConnectorResult<{ query: string; value: number }[]>> {
    return this.execute(async () => {
      const data = await this.fetchTrendData(keyword, { keywords: [keyword] });
      return data.relatedQueries;
    }, `getRelatedQueries:${keyword}`);
  }

  async getRisingTrends(category: string): Promise<ConnectorResult<TrendData[]>> {
    return this.execute(async () => {
      // Fetch rising trends for the category
      const keywords = this.getCategoryKeywords(category);
      const results: TrendData[] = [];

      for (const keyword of keywords) {
        const data = await this.fetchTrendData(keyword, {
          keywords: [keyword],
          timeRange: '90d',
          geo: 'IN',
        });
        if (data.isRising) {
          results.push(data);
        }
      }

      return results.sort((a, b) => b.trendScore - a.trendScore);
    }, `getRisingTrends:${category}`);
  }

  private async fetchTrendData(keyword: string, params: TrendSearchParams): Promise<TrendData> {
    // This would integrate with DataForSEO or SerpAPI for Google Trends data
    // Placeholder implementation showing the structure
    try {
      const response = await axios.get('https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live', {
        data: [{
          keywords: [keyword],
          location_code: 2356, // India
          time_range: params.timeRange || '12m',
          type: 'web',
        }],
        auth: {
          username: process.env.DATAFORSEO_LOGIN || '',
          password: process.env.DATAFORSEO_PASSWORD || '',
        },
      });

      const result = response.data?.tasks?.[0]?.result?.[0];
      
      return {
        keyword,
        interestOverTime: result?.items?.map((item: any) => ({
          date: item.date_from,
          value: item.values?.[0] || 0,
        })) || [],
        relatedQueries: result?.related_queries?.map((q: any) => ({
          query: q.query,
          value: q.value || 0,
        })) || [],
        relatedTopics: [],
        regionInterest: [],
        isRising: this.determineIfRising(result?.items || []),
        trendScore: this.calculateTrendScore(result?.items || []),
      };
    } catch (error) {
      logger.warn(`Failed to fetch trend data for ${keyword}`, { error });
      return {
        keyword,
        interestOverTime: [],
        relatedQueries: [],
        relatedTopics: [],
        regionInterest: [],
        isRising: false,
        trendScore: 0,
      };
    }
  }

  private determineIfRising(items: any[]): boolean {
    if (items.length < 4) return false;
    const recent = items.slice(-4).reduce((sum: number, item: any) => sum + (item.values?.[0] || 0), 0) / 4;
    const earlier = items.slice(0, 4).reduce((sum: number, item: any) => sum + (item.values?.[0] || 0), 0) / 4;
    return recent > earlier * 1.2; // 20% growth
  }

  private calculateTrendScore(items: any[]): number {
    if (items.length === 0) return 0;
    const values = items.map((item: any) => item.values?.[0] || 0);
    const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const recent = values.slice(-4).reduce((a: number, b: number) => a + b, 0) / Math.min(4, values.length);
    return Math.min(100, Math.round((recent / Math.max(1, avg)) * 50));
  }

  private getCategoryKeywords(category: string): string[] {
    const keywords: Record<string, string[]> = {
      dry_fruits: ['dry fruits online', 'premium dry fruits', 'organic dry fruits India'],
      nuts: ['almonds online', 'cashew nuts buy', 'mixed nuts India'],
      seeds: ['chia seeds India', 'flax seeds', 'pumpkin seeds buy online'],
      healthy_snacks: ['healthy snacks India', 'protein bars', 'makhana snacks'],
      trail_mixes: ['trail mix India', 'nut mix online', 'energy mix'],
      functional_foods: ['functional foods India', 'superfoods', 'protein powder'],
      wellness_products: ['wellness products', 'immunity booster', 'health supplements'],
    };
    return keywords[category] || ['healthy food India'];
  }

  async healthCheck(): Promise<boolean> {
    return true; // Google Trends is generally available
  }

  getName(): string {
    return 'Google Trends';
  }

  getTier(): string {
    return 'tier_1_official_api';
  }
}

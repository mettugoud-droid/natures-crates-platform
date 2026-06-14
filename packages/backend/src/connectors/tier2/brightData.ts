import axios from 'axios';
import { BaseDataConnector, DataConnectorConfig, ConnectorResult } from '../base';
import { config } from '../../config';
import { logger } from '../../utils/logger';

interface MarketplaceProduct {
  title: string;
  brand: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  productUrl: string;
  category: string;
  seller: string;
  salesRank?: number;
  asin?: string;
  features: string[];
}

interface BrightDataCollectionParams {
  marketplace: 'amazon_india' | 'flipkart';
  category?: string;
  keywords?: string;
  listType?: 'best_sellers' | 'movers_shakers' | 'most_wished' | 'new_releases';
  limit?: number;
}

const BRIGHT_DATA_CONFIG: DataConnectorConfig = {
  name: 'Bright Data',
  tier: 'tier_2_approved_provider',
  provider: 'Bright Data',
  enabled: !!config.providers.brightDataApiKey,
  rateLimit: {
    maxConcurrent: 5,
    minTime: 2000,
    reservoir: 1000,
    reservoirRefreshInterval: 3600000,
  },
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 3000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
};

export class BrightDataConnector extends BaseDataConnector {
  private apiKey: string;
  private baseUrl = 'https://api.brightdata.com';

  constructor() {
    super(BRIGHT_DATA_CONFIG);
    this.apiKey = config.providers.brightDataApiKey;
  }

  /**
   * Collect marketplace data using Bright Data's Web Scraper API
   */
  async collectProducts(params: BrightDataCollectionParams): Promise<ConnectorResult<MarketplaceProduct[]>> {
    return this.execute(async () => {
      const collectorId = this.getCollectorId(params.marketplace, params.listType);
      
      // Trigger collection
      const triggerResponse = await axios.post(
        `${this.baseUrl}/dca/trigger`,
        {
          collector: collectorId,
          queue_next: 1,
          input: this.buildInput(params),
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const responseId = triggerResponse.data.response_id;

      // Poll for results (with timeout)
      const results = await this.pollForResults(responseId);
      return this.mapResults(results, params.marketplace);
    }, `collectProducts:${params.marketplace}:${params.listType || params.keywords}`);
  }

  /**
   * Get Amazon Best Sellers for a category
   */
  async getAmazonBestSellers(category: string): Promise<ConnectorResult<MarketplaceProduct[]>> {
    return this.collectProducts({
      marketplace: 'amazon_india',
      category,
      listType: 'best_sellers',
      limit: 50,
    });
  }

  /**
   * Get Amazon Movers & Shakers
   */
  async getAmazonMoversShakers(category: string): Promise<ConnectorResult<MarketplaceProduct[]>> {
    return this.collectProducts({
      marketplace: 'amazon_india',
      category,
      listType: 'movers_shakers',
      limit: 50,
    });
  }

  /**
   * Get Flipkart Trending Products
   */
  async getFlipkartTrending(category: string): Promise<ConnectorResult<MarketplaceProduct[]>> {
    return this.collectProducts({
      marketplace: 'flipkart',
      category,
      listType: 'best_sellers',
      limit: 50,
    });
  }

  /**
   * Search products across marketplaces
   */
  async searchProducts(marketplace: 'amazon_india' | 'flipkart', keywords: string): Promise<ConnectorResult<MarketplaceProduct[]>> {
    return this.collectProducts({
      marketplace,
      keywords,
      limit: 20,
    });
  }

  private async pollForResults(responseId: string, maxWaitMs: number = 300000): Promise<any[]> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/dca/dataset?response_id=${responseId}`,
          {
            headers: { 'Authorization': `Bearer ${this.apiKey}` },
          }
        );

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          return response.data;
        }
      } catch (error) {
        // Collection still in progress
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Bright Data collection timed out after ${maxWaitMs}ms`);
  }

  private mapResults(results: any[], marketplace: string): MarketplaceProduct[] {
    return results.map((item: any) => ({
      title: item.title || item.name || '',
      brand: item.brand || 'Unknown',
      price: parseFloat(item.price || item.final_price || '0'),
      originalPrice: item.original_price ? parseFloat(item.original_price) : undefined,
      rating: parseFloat(item.rating || '0'),
      reviewsCount: parseInt(item.reviews_count || item.ratings_count || '0', 10),
      imageUrl: item.image || item.image_url || '',
      productUrl: item.url || item.product_url || '',
      category: item.category || '',
      seller: item.seller || item.seller_name || '',
      salesRank: item.sales_rank ? parseInt(item.sales_rank, 10) : undefined,
      asin: item.asin,
      features: item.features || [],
    }));
  }

  private getCollectorId(marketplace: string, listType?: string): string {
    // These would be pre-configured Bright Data collector IDs
    const collectors: Record<string, string> = {
      'amazon_india_best_sellers': process.env.BD_COLLECTOR_AMAZON_BS || 'c_amazon_in_bs',
      'amazon_india_movers_shakers': process.env.BD_COLLECTOR_AMAZON_MS || 'c_amazon_in_ms',
      'amazon_india_most_wished': process.env.BD_COLLECTOR_AMAZON_MW || 'c_amazon_in_mw',
      'amazon_india_new_releases': process.env.BD_COLLECTOR_AMAZON_NR || 'c_amazon_in_nr',
      'flipkart_best_sellers': process.env.BD_COLLECTOR_FLIPKART_BS || 'c_flipkart_bs',
      'flipkart_trending': process.env.BD_COLLECTOR_FLIPKART_TR || 'c_flipkart_tr',
    };

    const key = `${marketplace}_${listType || 'best_sellers'}`;
    return collectors[key] || collectors[`${marketplace}_best_sellers`] || '';
  }

  private buildInput(params: BrightDataCollectionParams): Record<string, any> {
    const input: Record<string, any> = {};
    if (params.category) input.category = params.category;
    if (params.keywords) input.keywords = params.keywords;
    if (params.limit) input.limit = params.limit;
    return input;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const response = await axios.get(`${this.baseUrl}/zone/status`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  getName(): string {
    return 'Bright Data';
  }

  getTier(): string {
    return 'tier_2_approved_provider';
  }
}

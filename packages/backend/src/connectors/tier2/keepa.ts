import axios from 'axios';
import { BaseDataConnector, DataConnectorConfig, ConnectorResult } from '../base';
import { config } from '../../config';

interface KeepaProduct {
  asin: string;
  title: string;
  brand: string;
  category: string;
  currentPrice: number;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  priceHistory: { date: string; price: number }[];
  salesRankHistory: { date: string; rank: number }[];
  salesRankCurrent: number;
  reviewCount: number;
  rating: number;
  monthlySalesEstimate: number;
  isAvailable: boolean;
  buyBoxSeller: string;
  numberOfSellers: number;
  lastPriceChange: number; // percentage
}

interface KeepaSearchParams {
  domain: number; // 44 for Amazon India
  category?: number;
  sortBy?: number;
  currentlyOnAmazon?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}

const KEEPA_CONFIG: DataConnectorConfig = {
  name: 'Keepa',
  tier: 'tier_2_approved_provider',
  provider: 'Keepa',
  enabled: !!config.providers.keepaApiKey,
  rateLimit: {
    maxConcurrent: 1,
    minTime: 2000,
    reservoir: 100,
    reservoirRefreshInterval: 60000,
  },
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
};

export class KeepaConnector extends BaseDataConnector {
  private apiKey: string;
  private baseUrl = 'https://api.keepa.com';
  private domain = 44; // Amazon India

  constructor() {
    super(KEEPA_CONFIG);
    this.apiKey = config.providers.keepaApiKey;
  }

  /**
   * Get product details with price history
   */
  async getProduct(asin: string): Promise<ConnectorResult<KeepaProduct | null>> {
    return this.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/product`, {
        params: {
          key: this.apiKey,
          domain: this.domain,
          asin,
          stats: 365, // 365 days of stats
          history: 1,
          offers: 20,
        },
      });

      const product = response.data?.products?.[0];
      if (!product) return null;

      return this.mapProduct(product);
    }, `getProduct:${asin}`);
  }

  /**
   * Get best sellers for a category
   */
  async getBestSellers(categoryId: number): Promise<ConnectorResult<KeepaProduct[]>> {
    return this.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/bestsellers`, {
        params: {
          key: this.apiKey,
          domain: this.domain,
          category: categoryId,
        },
      });

      const asins = response.data?.bestSellersList?.slice(0, 50) || [];
      
      // Batch fetch product details
      if (asins.length === 0) return [];
      
      const productsResponse = await axios.get(`${this.baseUrl}/product`, {
        params: {
          key: this.apiKey,
          domain: this.domain,
          asin: asins.join(','),
          stats: 90,
        },
      });

      return (productsResponse.data?.products || []).map((p: any) => this.mapProduct(p));
    }, `getBestSellers:${categoryId}`);
  }

  /**
   * Get movers & shakers (products with biggest rank improvements)
   */
  async getMoversShakers(categoryId: number): Promise<ConnectorResult<KeepaProduct[]>> {
    return this.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/bestsellers`, {
        params: {
          key: this.apiKey,
          domain: this.domain,
          category: categoryId,
          range: 1, // Most improved in last 24h
        },
      });

      const asins = response.data?.bestSellersList?.slice(0, 30) || [];
      if (asins.length === 0) return [];

      const productsResponse = await axios.get(`${this.baseUrl}/product`, {
        params: {
          key: this.apiKey,
          domain: this.domain,
          asin: asins.join(','),
          stats: 30,
        },
      });

      return (productsResponse.data?.products || []).map((p: any) => this.mapProduct(p));
    }, `getMoversShakers:${categoryId}`);
  }

  /**
   * Search products with filters
   */
  async searchProducts(params: KeepaSearchParams): Promise<ConnectorResult<KeepaProduct[]>> {
    return this.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          key: this.apiKey,
          domain: params.domain || this.domain,
          category: params.category,
          sort: params.sortBy,
          current: params.currentlyOnAmazon ? 1 : 0,
          priceFrom: params.minPrice ? params.minPrice * 100 : undefined,
          priceTo: params.maxPrice ? params.maxPrice * 100 : undefined,
          minRating: params.minRating ? params.minRating * 10 : undefined,
        },
      });

      const asins = response.data?.asinList?.slice(0, 50) || [];
      if (asins.length === 0) return [];

      const productsResponse = await axios.get(`${this.baseUrl}/product`, {
        params: {
          key: this.apiKey,
          domain: this.domain,
          asin: asins.join(','),
          stats: 90,
        },
      });

      return (productsResponse.data?.products || []).map((p: any) => this.mapProduct(p));
    }, `searchProducts`);
  }

  private mapProduct(raw: any): KeepaProduct {
    const stats = raw.stats || {};
    
    return {
      asin: raw.asin,
      title: raw.title || '',
      brand: raw.brand || 'Unknown',
      category: raw.categoryTree?.[0]?.name || '',
      currentPrice: this.keepaPriceToINR(stats.current?.[0]),
      averagePrice: this.keepaPriceToINR(stats.avg?.[0]),
      lowestPrice: this.keepaPriceToINR(stats.min?.[0]),
      highestPrice: this.keepaPriceToINR(stats.max?.[0]),
      priceHistory: this.extractPriceHistory(raw.csv?.[0] || []),
      salesRankHistory: this.extractSalesRankHistory(raw.csv?.[3] || []),
      salesRankCurrent: stats.salesRankCurrent || 0,
      reviewCount: raw.reviews || 0,
      rating: (raw.rating || 0) / 10,
      monthlySalesEstimate: this.estimateMonthlySales(stats.salesRankCurrent),
      isAvailable: raw.availabilityAmazon !== -1,
      buyBoxSeller: raw.buyBoxSellerId || '',
      numberOfSellers: raw.offerCountFBM || 0,
      lastPriceChange: stats.lastPriceChange || 0,
    };
  }

  private keepaPriceToINR(keepaPrice: number): number {
    if (!keepaPrice || keepaPrice < 0) return 0;
    return keepaPrice / 100; // Keepa stores prices in cents
  }

  private extractPriceHistory(csv: number[]): { date: string; price: number }[] {
    const history: { date: string; price: number }[] = [];
    for (let i = 0; i < csv.length; i += 2) {
      const ts = csv[i];
      const val = csv[i + 1];
      if (ts !== undefined && val !== undefined && val > 0) {
        const date = new Date((ts + 21564000) * 60000); // Keepa time format
        history.push({
          date: date.toISOString().split('T')[0]!,
          price: val / 100,
        });
      }
    }
    return history.slice(-90); // Last 90 data points
  }

  private extractSalesRankHistory(csv: number[]): { date: string; rank: number }[] {
    const history: { date: string; rank: number }[] = [];
    for (let i = 0; i < csv.length; i += 2) {
      const ts = csv[i];
      const val = csv[i + 1];
      if (ts !== undefined && val !== undefined && val > 0) {
        const date = new Date((ts + 21564000) * 60000);
        history.push({
          date: date.toISOString().split('T')[0]!,
          rank: val,
        });
      }
    }
    return history.slice(-90);
  }

  private estimateMonthlySales(salesRank: number): number {
    // Approximate monthly sales based on BSR for Amazon India Grocery
    if (!salesRank || salesRank <= 0) return 0;
    if (salesRank <= 100) return 3000;
    if (salesRank <= 500) return 1500;
    if (salesRank <= 1000) return 800;
    if (salesRank <= 5000) return 300;
    if (salesRank <= 10000) return 150;
    if (salesRank <= 50000) return 50;
    return 10;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const response = await axios.get(`${this.baseUrl}/token`, {
        params: { key: this.apiKey },
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  getName(): string {
    return 'Keepa';
  }

  getTier(): string {
    return 'tier_2_approved_provider';
  }
}

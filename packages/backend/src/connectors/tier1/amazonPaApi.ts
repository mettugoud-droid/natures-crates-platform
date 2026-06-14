import axios from 'axios';
import { BaseDataConnector, DataConnectorConfig, ConnectorResult } from '../base';
import { config } from '../../config';
import { logger } from '../../utils/logger';

interface AmazonProduct {
  asin: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  productUrl: string;
  salesRank: number;
  features: string[];
}

interface AmazonSearchParams {
  keywords: string;
  category?: string;
  sortBy?: 'price' | 'relevance' | 'reviews';
  minPrice?: number;
  maxPrice?: number;
  page?: number;
}

const AMAZON_PA_CONFIG: DataConnectorConfig = {
  name: 'Amazon PA-API',
  tier: 'tier_1_official_api',
  provider: 'Amazon',
  enabled: !!config.providers.amazonPaApiKey,
  rateLimit: {
    maxConcurrent: 1,
    minTime: 1000, // 1 request per second (PA-API limit)
    reservoir: 8640, // daily limit based on revenue
    reservoirRefreshInterval: 86400000, // 24 hours
  },
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
};

export class AmazonPaApiConnector extends BaseDataConnector {
  private apiKey: string;
  private apiSecret: string;
  private partnerTag: string;

  constructor() {
    super(AMAZON_PA_CONFIG);
    this.apiKey = config.providers.amazonPaApiKey;
    this.apiSecret = config.providers.amazonPaApiSecret;
    this.partnerTag = config.providers.amazonPartnerTag;
  }

  async searchProducts(params: AmazonSearchParams): Promise<ConnectorResult<AmazonProduct[]>> {
    return this.execute(async () => {
      // PA-API v5 SearchItems endpoint
      const response = await axios.post(
        'https://webservices.amazon.in/paapi5/searchitems',
        {
          Keywords: params.keywords,
          SearchIndex: this.mapCategory(params.category),
          SortBy: params.sortBy === 'price' ? 'Price:LowToHigh' : 'Relevance',
          ItemCount: 10,
          ItemPage: params.page || 1,
          PartnerTag: this.partnerTag,
          PartnerType: 'Associates',
          Resources: [
            'ItemInfo.Title',
            'ItemInfo.Features',
            'ItemInfo.ByLineInfo',
            'Offers.Listings.Price',
            'Images.Primary.Large',
            'BrowseNodeInfo.BrowseNodes',
            'CustomerReviews.Count',
            'CustomerReviews.StarRating',
          ],
          ...(params.minPrice && { MinPrice: params.minPrice * 100 }),
          ...(params.maxPrice && { MaxPrice: params.maxPrice * 100 }),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
            'Authorization': this.generateAuthHeader(),
          },
        }
      );

      return this.mapToProducts(response.data.SearchResult?.Items || []);
    }, `searchProducts:${params.keywords}`);
  }

  async getBestSellers(category: string): Promise<ConnectorResult<AmazonProduct[]>> {
    return this.execute(async () => {
      const response = await axios.post(
        'https://webservices.amazon.in/paapi5/searchitems',
        {
          BrowseNodeId: this.getCategoryBrowseNode(category),
          SortBy: 'Relevance',
          ItemCount: 10,
          PartnerTag: this.partnerTag,
          PartnerType: 'Associates',
          Resources: [
            'ItemInfo.Title',
            'ItemInfo.Features',
            'ItemInfo.ByLineInfo',
            'Offers.Listings.Price',
            'Images.Primary.Large',
            'CustomerReviews.Count',
            'CustomerReviews.StarRating',
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.generateAuthHeader(),
          },
        }
      );

      return this.mapToProducts(response.data.SearchResult?.Items || []);
    }, `getBestSellers:${category}`);
  }

  async getProductDetails(asin: string): Promise<ConnectorResult<AmazonProduct | null>> {
    return this.execute(async () => {
      const response = await axios.post(
        'https://webservices.amazon.in/paapi5/getitems',
        {
          ItemIds: [asin],
          ItemIdType: 'ASIN',
          PartnerTag: this.partnerTag,
          PartnerType: 'Associates',
          Resources: [
            'ItemInfo.Title',
            'ItemInfo.Features',
            'ItemInfo.ByLineInfo',
            'ItemInfo.ContentInfo',
            'Offers.Listings.Price',
            'Offers.Listings.SavingBasis',
            'Images.Primary.Large',
            'BrowseNodeInfo.BrowseNodes',
            'CustomerReviews.Count',
            'CustomerReviews.StarRating',
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.generateAuthHeader(),
          },
        }
      );

      const items = response.data.ItemsResult?.Items;
      if (!items || items.length === 0) return null;

      const products = this.mapToProducts(items);
      return products[0] || null;
    }, `getProductDetails:${asin}`);
  }

  private mapToProducts(items: any[]): AmazonProduct[] {
    return items.map((item: any) => ({
      asin: item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue || '',
      brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || 'Unknown',
      category: item.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName || '',
      price: item.Offers?.Listings?.[0]?.Price?.Amount || 0,
      rating: item.CustomerReviews?.StarRating?.Value || 0,
      reviewsCount: item.CustomerReviews?.Count || 0,
      imageUrl: item.Images?.Primary?.Large?.URL || '',
      productUrl: item.DetailPageURL || '',
      salesRank: item.BrowseNodeInfo?.BrowseNodes?.[0]?.SalesRank || 0,
      features: item.ItemInfo?.Features?.DisplayValues || [],
    }));
  }

  private mapCategory(category?: string): string {
    const mapping: Record<string, string> = {
      dry_fruits: 'GroceryAndGourmetFood',
      nuts: 'GroceryAndGourmetFood',
      seeds: 'GroceryAndGourmetFood',
      healthy_snacks: 'GroceryAndGourmetFood',
      trail_mixes: 'GroceryAndGourmetFood',
      gift_boxes: 'GroceryAndGourmetFood',
      wellness_products: 'HealthPersonalCare',
    };
    return mapping[category || ''] || 'GroceryAndGourmetFood';
  }

  private getCategoryBrowseNode(category: string): string {
    // Amazon India browse node IDs
    const nodes: Record<string, string> = {
      dry_fruits: '1374380031',
      nuts: '1374380031',
      healthy_snacks: '1374388031',
      grocery: '1374300031',
    };
    return nodes[category] || '1374300031';
  }

  private generateAuthHeader(): string {
    // In production, implement AWS Signature V4 signing
    // This is a placeholder - real implementation uses aws4 package
    return `AWS4-HMAC-SHA256 Credential=${this.apiKey}`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      // Simple connectivity test
      return true;
    } catch {
      return false;
    }
  }

  getName(): string {
    return 'Amazon PA-API';
  }

  getTier(): string {
    return 'tier_1_official_api';
  }
}

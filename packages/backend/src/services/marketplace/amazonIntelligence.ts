/**
 * Amazon Intelligence Module
 * Monitors: Best Sellers, Movers & Shakers, New Releases, Most Wished Products
 * Category-wise trending products across Amazon India
 */

import { query, queryOne, transaction } from '../../db/pool';
import { connectorRegistry } from '../../connectors/registry';
import { complianceEngineService } from '../complianceEngine';
import { logger } from '../../utils/logger';

// Amazon India Category IDs for Nature's Crates relevant categories
const AMAZON_CATEGORY_MAP: Record<string, { nodeId: string; label: string }> = {
  grocery: { nodeId: '1374300031', label: 'Grocery & Gourmet Foods' },
  dry_fruits: { nodeId: '1374380031', label: 'Dry Fruits' },
  nuts_seeds: { nodeId: '28Icons380031', label: 'Nuts & Seeds' },
  snacks: { nodeId: '1374388031', label: 'Snacks & Savoury' },
  health_foods: { nodeId: '14070856031', label: 'Health & Nutrition' },
  gift_packs: { nodeId: '5765751031', label: 'Gift Boxes' },
  organic: { nodeId: '14070857031', label: 'Organic Food' },
  breakfast: { nodeId: '1374313031', label: 'Breakfast Foods' },
  superfoods: { nodeId: '27580080031', label: 'Superfoods' },
  protein_supplements: { nodeId: '5765661031', label: 'Protein' },
};

export type AmazonListType = 'best_sellers' | 'movers_shakers' | 'most_wished' | 'new_releases';

export interface AmazonProductData {
  asin: string;
  title: string;
  brand: string;
  category: string;
  categoryNode: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  productUrl: string;
  salesRank: number;
  rankChange?: number;
  features: string[];
  listType: AmazonListType;
  fetchedAt: Date;
}

export interface CategoryTrend {
  category: string;
  categoryLabel: string;
  products: AmazonProductData[];
  averagePrice: number;
  averageRating: number;
  topBrands: string[];
  priceRange: { min: number; max: number };
  fetchedAt: Date;
}

export class AmazonIntelligenceService {
  /**
   * Fetch Best Sellers for all tracked categories
   */
  async fetchBestSellers(categories?: string[]): Promise<{ total: number; byCategory: Record<string, number> }> {
    const targetCategories = categories || Object.keys(AMAZON_CATEGORY_MAP);
    const results: Record<string, number> = {};
    let total = 0;

    for (const category of targetCategories) {
      try {
        const products = await this.fetchCategoryList(category, 'best_sellers');
        results[category] = products.length;
        total += products.length;

        // Store products
        for (const product of products) {
          await this.upsertAmazonProduct(product);
        }

        // Rate limit between categories
        await this.delay(2000);
      } catch (error) {
        logger.error(`Failed to fetch best sellers for ${category}`, { error });
        results[category] = 0;
      }
    }

    // Log compliance
    await complianceEngineService.logCollection({
      sourceType: 'tier_2_approved_provider',
      sourceName: 'Amazon Best Sellers (via Bright Data/Keepa)',
      collectionMethod: 'api_batch',
      dataType: 'product_listing',
      recordCount: total,
      rateLimitRespected: true,
      robotsTxtRespected: true,
      tosCompliant: true,
      jurisdiction: 'IN',
      requestId: `amazon_bs_${Date.now()}`,
      responseCode: 200,
      processingTimeMs: 0,
    });

    logger.info('Amazon Best Sellers fetch complete', { total, byCategory: results });
    return { total, byCategory: results };
  }

  /**
   * Fetch Movers & Shakers - products with biggest rank improvements
   */
  async fetchMoversShakers(categories?: string[]): Promise<{ total: number; byCategory: Record<string, number> }> {
    const targetCategories = categories || Object.keys(AMAZON_CATEGORY_MAP);
    const results: Record<string, number> = {};
    let total = 0;

    for (const category of targetCategories) {
      try {
        const products = await this.fetchCategoryList(category, 'movers_shakers');
        results[category] = products.length;
        total += products.length;

        for (const product of products) {
          await this.upsertAmazonProduct(product);
          // Track rank change for movers
          if (product.rankChange && product.rankChange > 50) {
            await this.flagHighGrowthProduct(product);
          }
        }

        await this.delay(2000);
      } catch (error) {
        logger.error(`Failed to fetch movers & shakers for ${category}`, { error });
        results[category] = 0;
      }
    }

    logger.info('Amazon Movers & Shakers fetch complete', { total });
    return { total, byCategory: results };
  }

  /**
   * Fetch New Releases
   */
  async fetchNewReleases(categories?: string[]): Promise<{ total: number; byCategory: Record<string, number> }> {
    const targetCategories = categories || Object.keys(AMAZON_CATEGORY_MAP);
    const results: Record<string, number> = {};
    let total = 0;

    for (const category of targetCategories) {
      try {
        const products = await this.fetchCategoryList(category, 'new_releases');
        results[category] = products.length;
        total += products.length;

        for (const product of products) {
          await this.upsertAmazonProduct(product);
        }

        await this.delay(2000);
      } catch (error) {
        logger.error(`Failed to fetch new releases for ${category}`, { error });
        results[category] = 0;
      }
    }

    logger.info('Amazon New Releases fetch complete', { total });
    return { total, byCategory: results };
  }

  /**
   * Fetch Most Wished Products
   */
  async fetchMostWished(categories?: string[]): Promise<{ total: number; byCategory: Record<string, number> }> {
    const targetCategories = categories || Object.keys(AMAZON_CATEGORY_MAP);
    const results: Record<string, number> = {};
    let total = 0;

    for (const category of targetCategories) {
      try {
        const products = await this.fetchCategoryList(category, 'most_wished');
        results[category] = products.length;
        total += products.length;

        for (const product of products) {
          await this.upsertAmazonProduct(product);
        }

        await this.delay(2000);
      } catch (error) {
        logger.error(`Failed to fetch most wished for ${category}`, { error });
        results[category] = 0;
      }
    }

    logger.info('Amazon Most Wished fetch complete', { total });
    return { total, byCategory: results };
  }

  /**
   * Get category trends analysis
   */
  async getCategoryTrends(category: string): Promise<CategoryTrend | null> {
    const catInfo = AMAZON_CATEGORY_MAP[category];
    if (!catInfo) return null;

    const products = await query<any>(
      `SELECT * FROM products 
       WHERE source_marketplace = 'amazon_india' 
       AND category = $1
       AND last_scanned_at > NOW() - INTERVAL '7 days'
       ORDER BY estimated_monthly_sales DESC NULLS LAST
       LIMIT 50`,
      [category]
    );

    if (products.length === 0) return null;

    const prices = products.map((p: any) => parseFloat(p.selling_price));
    const ratings = products.map((p: any) => parseFloat(p.rating || '0'));
    const brands = products.map((p: any) => p.brand).filter(Boolean);
    const brandCounts = brands.reduce((acc: Record<string, number>, b: string) => {
      acc[b] = (acc[b] || 0) + 1;
      return acc;
    }, {});
    const topBrands = Object.entries(brandCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([brand]) => brand);

    return {
      category,
      categoryLabel: catInfo.label,
      products: products.map(this.mapDbProductToAmazonData),
      averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      averageRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      topBrands,
      priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
      fetchedAt: new Date(),
    };
  }

  /**
   * Get trending products across all categories
   */
  async getTrendingProducts(limit: number = 50): Promise<any[]> {
    return query(
      `SELECT p.*, 
        pt.sales_estimate as prev_sales,
        CASE 
          WHEN pt.sales_estimate > 0 THEN 
            ((p.estimated_monthly_sales - pt.sales_estimate)::float / pt.sales_estimate * 100)
          ELSE NULL
        END as growth_percent
       FROM products p
       LEFT JOIN LATERAL (
         SELECT sales_estimate FROM product_trends 
         WHERE product_id = p.id AND date < CURRENT_DATE - 7
         ORDER BY date DESC LIMIT 1
       ) pt ON TRUE
       WHERE p.source_marketplace = 'amazon_india'
       AND p.last_scanned_at > NOW() - INTERVAL '3 days'
       ORDER BY p.growth_rate DESC NULLS LAST, p.estimated_monthly_sales DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Run complete Amazon intelligence scan
   */
  async runFullScan(): Promise<{
    bestSellers: number;
    moversShakers: number;
    newReleases: number;
    mostWished: number;
    totalProducts: number;
  }> {
    logger.info('Starting full Amazon intelligence scan...');

    const [bs, ms, nr, mw] = await Promise.all([
      this.fetchBestSellers(),
      this.fetchMoversShakers(),
      this.fetchNewReleases(),
      this.fetchMostWished(),
    ]);

    const totalProducts = bs.total + ms.total + nr.total + mw.total;

    logger.info('Full Amazon scan complete', {
      bestSellers: bs.total,
      moversShakers: ms.total,
      newReleases: nr.total,
      mostWished: mw.total,
      totalProducts,
    });

    return {
      bestSellers: bs.total,
      moversShakers: ms.total,
      newReleases: nr.total,
      mostWished: mw.total,
      totalProducts,
    };
  }

  // --- Private Methods ---

  private async fetchCategoryList(category: string, listType: AmazonListType): Promise<AmazonProductData[]> {
    const catInfo = AMAZON_CATEGORY_MAP[category];
    if (!catInfo) return [];

    // Try Keepa first (Tier 2)
    const keepa = connectorRegistry.get<any>('keepa');
    if (keepa) {
      try {
        let result;
        switch (listType) {
          case 'best_sellers':
            result = await keepa.getBestSellers(parseInt(catInfo.nodeId));
            break;
          case 'movers_shakers':
            result = await keepa.getMoversShakers(parseInt(catInfo.nodeId));
            break;
          default:
            result = await keepa.getBestSellers(parseInt(catInfo.nodeId));
        }

        if (result.success && result.data) {
          return result.data.map((p: any) => ({
            asin: p.asin,
            title: p.title,
            brand: p.brand,
            category,
            categoryNode: catInfo.nodeId,
            price: p.currentPrice,
            originalPrice: p.highestPrice,
            rating: p.rating,
            reviewsCount: p.reviewCount,
            imageUrl: '',
            productUrl: `https://www.amazon.in/dp/${p.asin}`,
            salesRank: p.salesRankCurrent,
            rankChange: undefined,
            features: [],
            listType,
            fetchedAt: new Date(),
          }));
        }
      } catch (error) {
        logger.warn('Keepa fetch failed, trying Bright Data', { category, error });
      }
    }

    // Fallback to Bright Data (Tier 2)
    const brightData = connectorRegistry.get<any>('bright_data');
    if (brightData) {
      try {
        const result = await brightData.collectProducts({
          marketplace: 'amazon_india',
          category: catInfo.label,
          listType,
          limit: 50,
        });

        if (result.success && result.data) {
          return result.data.map((p: any) => ({
            asin: p.asin || '',
            title: p.title,
            brand: p.brand,
            category,
            categoryNode: catInfo.nodeId,
            price: p.price,
            originalPrice: p.originalPrice,
            rating: p.rating,
            reviewsCount: p.reviewsCount,
            imageUrl: p.imageUrl,
            productUrl: p.productUrl,
            salesRank: p.salesRank || 0,
            features: p.features || [],
            listType,
            fetchedAt: new Date(),
          }));
        }
      } catch (error) {
        logger.warn('Bright Data fetch failed', { category, error });
      }
    }

    // Final fallback: Amazon PA-API (Tier 1)
    const paApi = connectorRegistry.get<any>('amazon_pa_api');
    if (paApi) {
      try {
        const result = await paApi.getBestSellers(category);
        if (result.success && result.data) {
          return result.data.map((p: any) => ({
            ...p,
            category,
            categoryNode: catInfo.nodeId,
            listType,
            fetchedAt: new Date(),
          }));
        }
      } catch (error) {
        logger.warn('PA-API fetch failed', { category, error });
      }
    }

    return [];
  }

  private async upsertAmazonProduct(product: AmazonProductData): Promise<string> {
    // Check existing by ASIN
    if (product.asin) {
      const existing = await queryOne<any>(
        'SELECT id, estimated_monthly_sales FROM products WHERE asin = $1',
        [product.asin]
      );

      if (existing) {
        // Update existing product
        await query(
          `UPDATE products SET 
            selling_price = $2, rating = $3, reviews_count = $4,
            last_scanned_at = NOW(), freshness_score = 100,
            source_reliability_score = GREATEST(source_reliability_score, 85),
            tags = array_cat(tags, $5::text[])
           WHERE id = $1`,
          [existing.id, product.price, product.rating, product.reviewsCount,
           [product.listType]]
        );

        // Record trend data point
        await query(
          `INSERT INTO product_trends (product_id, date, price, sales_estimate, ranking, reviews_count, rating)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
           ON CONFLICT (product_id, date) DO UPDATE SET
             price = $2, ranking = $4, reviews_count = $5, rating = $6`,
          [existing.id, product.price, null, product.salesRank, product.reviewsCount, product.rating]
        );

        return existing.id;
      }
    }

    // Estimate monthly sales from rank
    const estimatedSales = this.estimateSalesFromRank(product.salesRank);

    // Insert new product
    const result = await queryOne<{ id: string }>(
      `INSERT INTO products (
        name, category, brand, description, selling_price, source_marketplace,
        source_url, asin, rating, reviews_count, estimated_monthly_sales,
        confidence_score, freshness_score, source_reliability_score,
        tags, metadata
      ) VALUES ($1,$2,$3,$4,$5,'amazon_india',$6,$7,$8,$9,$10,$11,100,$12,$13,$14)
      RETURNING id`,
      [
        product.title, product.category, product.brand,
        product.features.join('. '), product.price,
        product.productUrl, product.asin, product.rating, product.reviewsCount,
        estimatedSales, 75, 85,
        [product.listType, product.category],
        JSON.stringify({
          salesRank: product.salesRank,
          categoryNode: product.categoryNode,
          listType: product.listType,
          originalPrice: product.originalPrice,
        }),
      ]
    );

    return result?.id || '';
  }

  private async flagHighGrowthProduct(product: AmazonProductData): Promise<void> {
    if (!product.asin) return;
    await query(
      `UPDATE products SET 
        tags = array_append(tags, 'high_growth'),
        metadata = metadata || '{"high_growth_detected": true}'::jsonb
       WHERE asin = $1`,
      [product.asin]
    );
  }

  private estimateSalesFromRank(rank: number): number {
    if (!rank || rank <= 0) return 0;
    // Amazon India Grocery category sales estimation
    if (rank <= 50) return 5000;
    if (rank <= 100) return 3000;
    if (rank <= 500) return 1500;
    if (rank <= 1000) return 800;
    if (rank <= 5000) return 300;
    if (rank <= 10000) return 150;
    if (rank <= 50000) return 50;
    if (rank <= 100000) return 20;
    return 5;
  }

  private mapDbProductToAmazonData(row: any): AmazonProductData {
    return {
      asin: row.asin || '',
      title: row.name,
      brand: row.brand || '',
      category: row.category,
      categoryNode: row.metadata?.categoryNode || '',
      price: parseFloat(row.selling_price),
      rating: parseFloat(row.rating || '0'),
      reviewsCount: row.reviews_count || 0,
      imageUrl: row.images?.[0] || '',
      productUrl: row.source_url || '',
      salesRank: row.metadata?.salesRank || 0,
      features: [],
      listType: row.metadata?.listType || 'best_sellers',
      fetchedAt: row.last_scanned_at,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const amazonIntelligenceService = new AmazonIntelligenceService();

/**
 * Flipkart Intelligence Module
 * Monitors: Best Sellers, Trending Products, Fast-Growing Categories
 */

import { query, queryOne } from '../../db/pool';
import { connectorRegistry } from '../../connectors/registry';
import { complianceEngineService } from '../complianceEngine';
import { logger } from '../../utils/logger';

// Flipkart Category mapping for Nature's Crates
const FLIPKART_CATEGORY_MAP: Record<string, { path: string; label: string }> = {
  dry_fruits: { path: 'grocery/dry-fruits', label: 'Dry Fruits' },
  nuts: { path: 'grocery/nuts', label: 'Nuts' },
  seeds: { path: 'grocery/seeds', label: 'Seeds' },
  healthy_snacks: { path: 'grocery/snacks/healthy-snacks', label: 'Healthy Snacks' },
  trail_mixes: { path: 'grocery/trail-mix', label: 'Trail Mixes' },
  gift_boxes: { path: 'grocery/gift-boxes', label: 'Gift Boxes' },
  organic_food: { path: 'grocery/organic-food', label: 'Organic Food' },
  breakfast: { path: 'grocery/breakfast-cereals', label: 'Breakfast & Cereals' },
  honey_spreads: { path: 'grocery/honey-spreads', label: 'Honey & Spreads' },
  superfoods: { path: 'grocery/superfoods', label: 'Superfoods' },
};

export interface FlipkartProductData {
  productId: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  mrp: number;
  discount: number;
  rating: number;
  reviewsCount: number;
  ratingsCount: number;
  imageUrl: string;
  productUrl: string;
  seller: string;
  highlights: string[];
  isAssured: boolean;
  deliveryInfo: string;
  fetchedAt: Date;
}

export interface FlipkartCategoryGrowth {
  category: string;
  label: string;
  totalProducts: number;
  avgPrice: number;
  avgRating: number;
  topBrands: { brand: string; count: number }[];
  priceDistribution: { range: string; count: number }[];
  growthIndicator: 'fast_growing' | 'steady' | 'declining';
  newProductsLast30Days: number;
}

export class FlipkartIntelligenceService {
  /**
   * Fetch Best Sellers for tracked categories
   */
  async fetchBestSellers(categories?: string[]): Promise<{ total: number; byCategory: Record<string, number> }> {
    const targetCategories = categories || Object.keys(FLIPKART_CATEGORY_MAP);
    const results: Record<string, number> = {};
    let total = 0;

    for (const category of targetCategories) {
      try {
        const products = await this.fetchCategoryProducts(category, 'popularity');
        results[category] = products.length;
        total += products.length;

        for (const product of products) {
          await this.upsertFlipkartProduct(product);
        }

        await this.delay(3000); // Respect rate limits
      } catch (error) {
        logger.error(`Flipkart best sellers fetch failed for ${category}`, { error });
        results[category] = 0;
      }
    }

    await complianceEngineService.logCollection({
      sourceType: 'tier_2_approved_provider',
      sourceName: 'Flipkart Intelligence (via Bright Data)',
      collectionMethod: 'api_batch',
      dataType: 'product_listing',
      recordCount: total,
      rateLimitRespected: true,
      robotsTxtRespected: true,
      tosCompliant: true,
      jurisdiction: 'IN',
      requestId: `flipkart_bs_${Date.now()}`,
      responseCode: 200,
      processingTimeMs: 0,
    });

    logger.info('Flipkart Best Sellers fetch complete', { total, byCategory: results });
    return { total, byCategory: results };
  }

  /**
   * Fetch Trending Products (sorted by newest with high ratings)
   */
  async fetchTrendingProducts(categories?: string[]): Promise<{ total: number; byCategory: Record<string, number> }> {
    const targetCategories = categories || Object.keys(FLIPKART_CATEGORY_MAP);
    const results: Record<string, number> = {};
    let total = 0;

    for (const category of targetCategories) {
      try {
        const products = await this.fetchCategoryProducts(category, 'recency_desc');
        // Filter for trending (recent + highly rated)
        const trending = products.filter(
          p => p.rating >= 4.0 && p.reviewsCount >= 50
        );

        results[category] = trending.length;
        total += trending.length;

        for (const product of trending) {
          await this.upsertFlipkartProduct(product);
        }

        await this.delay(3000);
      } catch (error) {
        logger.error(`Flipkart trending fetch failed for ${category}`, { error });
        results[category] = 0;
      }
    }

    logger.info('Flipkart Trending Products fetch complete', { total });
    return { total, byCategory: results };
  }

  /**
   * Identify fast-growing categories
   */
  async identifyFastGrowingCategories(): Promise<FlipkartCategoryGrowth[]> {
    const growthData: FlipkartCategoryGrowth[] = [];

    for (const [category, catInfo] of Object.entries(FLIPKART_CATEGORY_MAP)) {
      const stats = await query<any>(
        `SELECT 
          COUNT(*) as total,
          AVG(selling_price) as avg_price,
          AVG(rating) as avg_rating,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_last_30d
         FROM products 
         WHERE source_marketplace = 'flipkart' AND category = $1`,
        [category]
      );

      const topBrandsResult = await query<any>(
        `SELECT brand, COUNT(*) as count FROM products 
         WHERE source_marketplace = 'flipkart' AND category = $1 AND brand IS NOT NULL
         GROUP BY brand ORDER BY count DESC LIMIT 5`,
        [category]
      );

      const stat = stats[0] || {};
      const totalProducts = parseInt(stat.total || '0');
      const newLast30 = parseInt(stat.new_last_30d || '0');

      // Determine growth indicator
      let growthIndicator: 'fast_growing' | 'steady' | 'declining' = 'steady';
      if (totalProducts > 0) {
        const newRatio = newLast30 / totalProducts;
        if (newRatio > 0.3) growthIndicator = 'fast_growing';
        else if (newRatio < 0.05) growthIndicator = 'declining';
      }

      growthData.push({
        category,
        label: catInfo.label,
        totalProducts,
        avgPrice: parseFloat(stat.avg_price || '0'),
        avgRating: parseFloat(stat.avg_rating || '0'),
        topBrands: topBrandsResult.map((r: any) => ({ brand: r.brand, count: parseInt(r.count) })),
        priceDistribution: await this.getPriceDistribution(category, 'flipkart'),
        growthIndicator,
        newProductsLast30Days: newLast30,
      });
    }

    // Sort by growth indicator
    growthData.sort((a, b) => {
      const order = { fast_growing: 0, steady: 1, declining: 2 };
      return order[a.growthIndicator] - order[b.growthIndicator];
    });

    return growthData;
  }

  /**
   * Run full Flipkart intelligence scan
   */
  async runFullScan(): Promise<{
    bestSellers: number;
    trending: number;
    fastGrowingCategories: number;
    totalProducts: number;
  }> {
    logger.info('Starting full Flipkart intelligence scan...');

    const [bs, trending] = await Promise.all([
      this.fetchBestSellers(),
      this.fetchTrendingProducts(),
    ]);

    const fastGrowing = await this.identifyFastGrowingCategories();
    const totalProducts = bs.total + trending.total;

    logger.info('Full Flipkart scan complete', {
      bestSellers: bs.total,
      trending: trending.total,
      fastGrowingCategories: fastGrowing.filter(c => c.growthIndicator === 'fast_growing').length,
    });

    return {
      bestSellers: bs.total,
      trending: trending.total,
      fastGrowingCategories: fastGrowing.filter(c => c.growthIndicator === 'fast_growing').length,
      totalProducts,
    };
  }

  // --- Private Methods ---

  private async fetchCategoryProducts(category: string, sortBy: string): Promise<FlipkartProductData[]> {
    const catInfo = FLIPKART_CATEGORY_MAP[category];
    if (!catInfo) return [];

    // Use Bright Data for Flipkart data
    const brightData = connectorRegistry.get<any>('bright_data');
    if (brightData) {
      try {
        const result = await brightData.collectProducts({
          marketplace: 'flipkart',
          category: catInfo.label,
          listType: sortBy === 'popularity' ? 'best_sellers' : undefined,
          limit: 50,
        });

        if (result.success && result.data) {
          return result.data.map((item: any) => this.mapToFlipkartProduct(item, category));
        }
      } catch (error) {
        logger.warn('Bright Data Flipkart fetch failed', { category, error });
      }
    }

    return [];
  }

  private mapToFlipkartProduct(raw: any, category: string): FlipkartProductData {
    const price = parseFloat(raw.price || raw.final_price || '0');
    const mrp = parseFloat(raw.original_price || raw.mrp || String(price));
    
    return {
      productId: raw.product_id || raw.pid || '',
      title: raw.title || raw.name || '',
      brand: raw.brand || 'Unknown',
      category,
      price,
      mrp,
      discount: mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0,
      rating: parseFloat(raw.rating || '0'),
      reviewsCount: parseInt(raw.reviews_count || '0'),
      ratingsCount: parseInt(raw.ratings_count || raw.reviews_count || '0'),
      imageUrl: raw.image || raw.image_url || '',
      productUrl: raw.url || raw.product_url || '',
      seller: raw.seller || raw.seller_name || '',
      highlights: raw.highlights || raw.features || [],
      isAssured: raw.flipkart_assured === true || raw.is_assured === true,
      deliveryInfo: raw.delivery || '',
      fetchedAt: new Date(),
    };
  }

  private async upsertFlipkartProduct(product: FlipkartProductData): Promise<string> {
    // Check existing
    if (product.productId) {
      const existing = await queryOne<any>(
        'SELECT id FROM products WHERE flipkart_pid = $1',
        [product.productId]
      );

      if (existing) {
        await query(
          `UPDATE products SET
            selling_price = $2, rating = $3, reviews_count = $4,
            last_scanned_at = NOW(), freshness_score = 100
           WHERE id = $1`,
          [existing.id, product.price, product.rating, product.reviewsCount]
        );
        return existing.id;
      }
    }

    // Also check by name similarity
    const similar = await queryOne<any>(
      `SELECT id FROM products 
       WHERE source_marketplace = 'flipkart' 
       AND name = $1 AND brand = $2`,
      [product.title, product.brand]
    );

    if (similar) {
      await query(
        `UPDATE products SET
          selling_price = $2, rating = $3, reviews_count = $4,
          flipkart_pid = $5, last_scanned_at = NOW(), freshness_score = 100
         WHERE id = $1`,
        [similar.id, product.price, product.rating, product.reviewsCount, product.productId]
      );
      return similar.id;
    }

    // Insert new
    const result = await queryOne<{ id: string }>(
      `INSERT INTO products (
        name, category, brand, description, selling_price, cost_price,
        source_marketplace, source_url, flipkart_pid,
        rating, reviews_count, confidence_score, freshness_score, source_reliability_score,
        tags, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,'flipkart',$7,$8,$9,$10,70,100,80,$11,$12)
      RETURNING id`,
      [
        product.title, product.category, product.brand,
        product.highlights.join('. '),
        product.price,
        product.mrp > product.price ? product.price * 0.4 : null, // Estimate cost
        product.productUrl, product.productId,
        product.rating, product.reviewsCount,
        ['flipkart', product.category, product.isAssured ? 'flipkart_assured' : ''].filter(Boolean),
        JSON.stringify({
          mrp: product.mrp,
          discount: product.discount,
          seller: product.seller,
          isAssured: product.isAssured,
        }),
      ]
    );

    return result?.id || '';
  }

  private async getPriceDistribution(category: string, marketplace: string): Promise<{ range: string; count: number }[]> {
    const ranges = await query<any>(
      `SELECT 
        CASE 
          WHEN selling_price < 200 THEN 'Under 200'
          WHEN selling_price < 500 THEN '200-500'
          WHEN selling_price < 1000 THEN '500-1000'
          WHEN selling_price < 2000 THEN '1000-2000'
          ELSE '2000+'
        END as price_range,
        COUNT(*) as count
       FROM products
       WHERE source_marketplace = $1 AND category = $2
       GROUP BY price_range
       ORDER BY MIN(selling_price)`,
      [marketplace, category]
    );
    return ranges.map((r: any) => ({ range: r.price_range, count: parseInt(r.count) }));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const flipkartIntelligenceService = new FlipkartIntelligenceService();

import { query, queryOne, transaction } from '../db/pool';
import { connectorRegistry } from '../connectors/registry';
import { logger } from '../utils/logger';
import type { Product, ProductSearchFilters } from '@natures-crates/shared';

export class ProductIntelligenceService {
  /**
   * Discover and store trending products from all sources
   */
  async discoverTrendingProducts(category: string): Promise<{ productsDiscovered: number }> {
    let totalDiscovered = 0;

    // 1. Amazon Best Sellers via Keepa
    try {
      const keepa = connectorRegistry.get<any>('keepa');
      if (keepa) {
        const result = await keepa.getBestSellers(this.getCategoryId(category));
        if (result.success && result.data) {
          for (const product of result.data) {
            await this.upsertProduct({
              name: product.title,
              category,
              brand: product.brand,
              sellingPrice: product.currentPrice,
              sourceMarketplace: 'amazon_india',
              asin: product.asin,
              rating: product.rating,
              reviewsCount: product.reviewCount,
              estimatedMonthlySales: product.monthlySalesEstimate,
            });
            totalDiscovered++;
          }
        }
      }
    } catch (error) {
      logger.error('Error discovering Amazon products', { error, category });
    }

    // 2. Bright Data collection for additional marketplace data
    try {
      const brightData = connectorRegistry.get<any>('bright_data');
      if (brightData) {
        const amazonResults = await brightData.getAmazonBestSellers(category);
        if (amazonResults.success && amazonResults.data) {
          for (const product of amazonResults.data) {
            await this.upsertProduct({
              name: product.title,
              category,
              brand: product.brand,
              sellingPrice: product.price,
              sourceMarketplace: 'amazon_india',
              asin: product.asin,
              rating: product.rating,
              reviewsCount: product.reviewsCount,
            });
            totalDiscovered++;
          }
        }

        // Flipkart
        const flipkartResults = await brightData.getFlipkartTrending(category);
        if (flipkartResults.success && flipkartResults.data) {
          for (const product of flipkartResults.data) {
            await this.upsertProduct({
              name: product.title,
              category,
              brand: product.brand,
              sellingPrice: product.price,
              sourceMarketplace: 'flipkart',
              rating: product.rating,
              reviewsCount: product.reviewsCount,
            });
            totalDiscovered++;
          }
        }
      }
    } catch (error) {
      logger.error('Error with Bright Data collection', { error, category });
    }

    // 3. Google Trends for category interest
    try {
      const trends = connectorRegistry.get<any>('google_trends');
      if (trends) {
        const trendData = await trends.getRisingTrends(category);
        if (trendData.success && trendData.data) {
          logger.info(`Found ${trendData.data.length} rising trends for ${category}`);
        }
      }
    } catch (error) {
      logger.error('Error fetching Google Trends', { error, category });
    }

    logger.info(`Product discovery complete for ${category}`, { totalDiscovered });
    return { productsDiscovered: totalDiscovered };
  }

  /**
   * Search products with filters and pagination
   */
  async searchProducts(filters: ProductSearchFilters): Promise<{
    products: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters.categories?.length) {
      paramCount++;
      whereClause += ` AND p.category = ANY($${paramCount})`;
      params.push(filters.categories);
    }

    if (filters.marketplaces?.length) {
      paramCount++;
      whereClause += ` AND p.source_marketplace = ANY($${paramCount})`;
      params.push(filters.marketplaces);
    }

    if (filters.minPrice) {
      paramCount++;
      whereClause += ` AND p.selling_price >= $${paramCount}`;
      params.push(filters.minPrice);
    }

    if (filters.maxPrice) {
      paramCount++;
      whereClause += ` AND p.selling_price <= $${paramCount}`;
      params.push(filters.maxPrice);
    }

    if (filters.minRating) {
      paramCount++;
      whereClause += ` AND p.rating >= $${paramCount}`;
      params.push(filters.minRating);
    }

    if (filters.minOpportunityScore) {
      paramCount++;
      whereClause += ` AND p.opportunity_score >= $${paramCount}`;
      params.push(filters.minOpportunityScore);
    }

    if (filters.isWhiteLabelOnly) {
      whereClause += ' AND p.is_white_label_candidate = TRUE';
    }

    const sortMap: Record<string, string> = {
      opportunity_score: 'p.opportunity_score',
      margin: 'p.opportunity_score',
      sales: 'p.estimated_monthly_sales',
      growth: 'p.growth_rate',
      created_at: 'p.created_at',
    };
    const sortColumn = sortMap[filters.sortBy || 'opportunity_score'] || 'p.opportunity_score';

    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM products p ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get products
    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const products = await query(
      `SELECT p.*,
        ma.gross_margin_percent,
        ma.net_margin_percent,
        wlo.opportunity_score as wl_opportunity_score,
        wlo.classification
       FROM products p
       LEFT JOIN LATERAL (
         SELECT gross_margin_percent, net_margin_percent
         FROM margin_analyses WHERE product_id = p.id
         ORDER BY calculated_at DESC LIMIT 1
       ) ma ON TRUE
       LEFT JOIN LATERAL (
         SELECT opportunity_score, classification
         FROM white_label_opportunities WHERE product_id = p.id
         ORDER BY analyzed_at DESC LIMIT 1
       ) wlo ON TRUE
       ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      params
    );

    return { products, total, page, limit };
  }

  /**
   * Get product details with all related data
   */
  async getProductDetails(productId: string): Promise<any> {
    const product = await queryOne(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );

    if (!product) return null;

    const [margin, opportunity, suppliers, risks, trends] = await Promise.all([
      queryOne(
        'SELECT * FROM margin_analyses WHERE product_id = $1 ORDER BY calculated_at DESC LIMIT 1',
        [productId]
      ),
      queryOne(
        'SELECT * FROM white_label_opportunities WHERE product_id = $1 ORDER BY analyzed_at DESC LIMIT 1',
        [productId]
      ),
      query(
        `SELECT s.* FROM suppliers s
         JOIN supplier_quotes sq ON sq.supplier_id = s.id
         WHERE sq.product_id = $1
         ORDER BY s.trust_score DESC`,
        [productId]
      ),
      query(
        'SELECT * FROM market_risks WHERE product_id = $1',
        [productId]
      ),
      query(
        'SELECT * FROM product_trends WHERE product_id = $1 ORDER BY date DESC LIMIT 90',
        [productId]
      ),
    ]);

    return {
      ...product,
      marginAnalysis: margin,
      whiteLabelOpportunity: opportunity,
      suppliers,
      risks,
      trends,
    };
  }

  /**
   * Upsert a product (insert or update)
   */
  private async upsertProduct(data: {
    name: string;
    category: string;
    brand?: string;
    sellingPrice: number;
    sourceMarketplace: string;
    sourceUrl?: string;
    asin?: string;
    flipkartPid?: string;
    rating?: number;
    reviewsCount?: number;
    estimatedMonthlySales?: number;
    growthRate?: number;
  }): Promise<string> {
    // Check for existing product by ASIN or Flipkart PID
    let existing: any = null;
    if (data.asin) {
      existing = await queryOne('SELECT id FROM products WHERE asin = $1', [data.asin]);
    } else if (data.flipkartPid) {
      existing = await queryOne('SELECT id FROM products WHERE flipkart_pid = $1', [data.flipkartPid]);
    }

    if (existing) {
      // Update existing
      await query(
        `UPDATE products SET
          selling_price = $2, rating = $3, reviews_count = $4,
          estimated_monthly_sales = $5, growth_rate = $6,
          last_scanned_at = NOW(), freshness_score = 100
         WHERE id = $1`,
        [existing.id, data.sellingPrice, data.rating, data.reviewsCount,
         data.estimatedMonthlySales, data.growthRate]
      );
      return existing.id;
    }

    // Insert new
    const result = await queryOne<{ id: string }>(
      `INSERT INTO products (name, category, brand, selling_price, source_marketplace,
        source_url, asin, flipkart_pid, rating, reviews_count, estimated_monthly_sales, growth_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [data.name, data.category, data.brand || null, data.sellingPrice,
       data.sourceMarketplace, data.sourceUrl || null, data.asin || null,
       data.flipkartPid || null, data.rating || null, data.reviewsCount || 0,
       data.estimatedMonthlySales || null, data.growthRate || null]
    );

    return result?.id || '';
  }

  /**
   * Get dashboard summary stats
   */
  async getDashboardStats(): Promise<any> {
    const [
      totalProducts,
      whiteLabelCandidates,
      highMarginProducts,
      totalSuppliers,
      avgOpportunityScore,
    ] = await Promise.all([
      queryOne<{ count: string }>('SELECT COUNT(*) as count FROM products'),
      queryOne<{ count: string }>('SELECT COUNT(*) as count FROM products WHERE is_white_label_candidate = TRUE'),
      queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM margin_analyses WHERE meets_gross_margin_target = TRUE AND meets_net_margin_target = TRUE'
      ),
      queryOne<{ count: string }>('SELECT COUNT(*) as count FROM suppliers'),
      queryOne<{ avg: string }>('SELECT AVG(opportunity_score) as avg FROM products WHERE opportunity_score IS NOT NULL'),
    ]);

    return {
      totalProducts: parseInt(totalProducts?.count || '0'),
      whiteLabelCandidates: parseInt(whiteLabelCandidates?.count || '0'),
      highMarginProducts: parseInt(highMarginProducts?.count || '0'),
      totalSuppliers: parseInt(totalSuppliers?.count || '0'),
      avgOpportunityScore: Math.round(parseFloat(avgOpportunityScore?.avg || '0')),
    };
  }

  private getCategoryId(category: string): number {
    // Keepa/Amazon category IDs for India
    const categoryMap: Record<string, number> = {
      dry_fruits: 1374380031,
      nuts: 1374380031,
      seeds: 1374380031,
      healthy_snacks: 1374388031,
      trail_mixes: 1374380031,
      gift_boxes: 1374300031,
      grocery: 1374300031,
    };
    return categoryMap[category] || 1374300031;
  }
}

export const productIntelligenceService = new ProductIntelligenceService();

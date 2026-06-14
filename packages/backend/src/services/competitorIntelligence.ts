/**
 * Phase 6: Competitor Intelligence Service
 * Track Amazon sellers, Flipkart sellers, D2C brands
 * Generate pricing, review, rating, packaging, USP analysis
 */

import { query, queryOne } from '../db/pool';
import { connectorRegistry } from '../connectors/registry';
import { logger } from '../utils/logger';

export interface CompetitorProfile {
  id: string;
  name: string;
  brand: string;
  type: 'amazon_seller' | 'flipkart_seller' | 'd2c_brand' | 'offline_brand';
  website: string | null;
  marketplaces: string[];
  categories: string[];
  estimatedRevenue: string;
  pricingStrategy: string;
  strengths: string[];
  weaknesses: string[];
  uniqueSellingPoints: string[];
  productCount: number;
  avgRating: number;
  avgPrice: number;
}

export interface PricingAnalysis {
  category: string;
  ourBrand: string;
  competitors: {
    brand: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    pricePosition: 'cheaper' | 'similar' | 'expensive';
    priceDiffPercent: number;
  }[];
  categoryAvgPrice: number;
  recommendedPriceRange: { min: number; max: number };
  opportunity: string;
}

export interface ReviewAnalysis {
  competitorId: string;
  brand: string;
  totalReviews: number;
  avgRating: number;
  ratingDistribution: Record<string, number>;
  topComplaints: { complaint: string; frequency: number }[];
  topPraises: { praise: string; frequency: number }[];
  sentimentScore: number; // -1 to 1
  qualityPerception: 'premium' | 'good' | 'average' | 'poor';
  opportunityGaps: string[];
}

export interface CompetitorComparison {
  category: string;
  competitors: CompetitorProfile[];
  pricingAnalysis: PricingAnalysis;
  reviewInsights: ReviewAnalysis[];
  marketShare: { brand: string; estimatedShare: number }[];
  gaps: string[];
  recommendations: string[];
}

export class CompetitorIntelligenceService {
  /**
   * Track a new competitor
   */
  async addCompetitor(data: {
    name: string;
    brand: string;
    type: string;
    website?: string;
    marketplaces: string[];
    categories: string[];
  }): Promise<string> {
    const result = await queryOne<{ id: string }>(
      `INSERT INTO competitors (name, brand, competitor_type, website, marketplaces, categories)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.name, data.brand, data.type, data.website || null, data.marketplaces, data.categories]
    );
    return result?.id || '';
  }

  /**
   * Get all tracked competitors
   */
  async getCompetitors(category?: string): Promise<CompetitorProfile[]> {
    let sql = `SELECT c.*, 
      (SELECT COUNT(*) FROM competitor_products cp WHERE cp.competitor_id = c.id) as product_count,
      (SELECT AVG(cp.competitor_rating) FROM competitor_products cp WHERE cp.competitor_id = c.id) as avg_rating,
      (SELECT AVG(cp.competitor_price) FROM competitor_products cp WHERE cp.competitor_id = c.id) as avg_price
     FROM competitors c`;
    const params: any[] = [];

    if (category) {
      sql += ` WHERE $1 = ANY(c.categories)`;
      params.push(category);
    }

    sql += ` ORDER BY c.created_at DESC`;

    const rows = await query<any>(sql, params);
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      type: row.competitor_type,
      website: row.website,
      marketplaces: row.marketplaces || [],
      categories: row.categories || [],
      estimatedRevenue: row.estimated_revenue || 'Unknown',
      pricingStrategy: row.pricing_strategy || 'mid_range',
      strengths: row.strengths || [],
      weaknesses: row.weaknesses || [],
      uniqueSellingPoints: row.unique_selling_points || [],
      productCount: parseInt(row.product_count || '0'),
      avgRating: parseFloat(row.avg_rating || '0'),
      avgPrice: parseFloat(row.avg_price || '0'),
    }));
  }

  /**
   * Generate pricing analysis vs competitors
   */
  async generatePricingAnalysis(category: string): Promise<PricingAnalysis> {
    // Get competitor products in this category
    const competitorProducts = await query<any>(
      `SELECT c.brand, cp.competitor_price, cp.competitor_rating
       FROM competitor_products cp
       JOIN competitors c ON c.id = cp.competitor_id
       JOIN products p ON p.id = cp.product_id
       WHERE p.category = $1 AND cp.competitor_price > 0`,
      [category]
    );

    // Get our products
    const ourProducts = await query<any>(
      `SELECT selling_price FROM products
       WHERE category = $1 AND is_white_label_candidate = TRUE AND selling_price > 0`,
      [category]
    );

    // Aggregate by brand
    const brandPrices: Record<string, number[]> = {};
    for (const cp of competitorProducts) {
      if (!brandPrices[cp.brand]) brandPrices[cp.brand] = [];
      brandPrices[cp.brand]!.push(parseFloat(cp.competitor_price));
    }

    const ourAvgPrice = ourProducts.length > 0
      ? ourProducts.reduce((sum: number, p: any) => sum + parseFloat(p.selling_price), 0) / ourProducts.length
      : 0;

    const allPrices = competitorProducts.map((p: any) => parseFloat(p.competitor_price));
    const categoryAvgPrice = allPrices.length > 0
      ? allPrices.reduce((a: number, b: number) => a + b, 0) / allPrices.length
      : 0;

    const competitors = Object.entries(brandPrices).map(([brand, prices]) => {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const diff = ourAvgPrice > 0 ? ((avgPrice - ourAvgPrice) / ourAvgPrice) * 100 : 0;
      return {
        brand,
        avgPrice: Math.round(avgPrice),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        pricePosition: diff > 10 ? 'expensive' as const : diff < -10 ? 'cheaper' as const : 'similar' as const,
        priceDiffPercent: Math.round(diff),
      };
    });

    return {
      category,
      ourBrand: "Nature's Crates",
      competitors,
      categoryAvgPrice: Math.round(categoryAvgPrice),
      recommendedPriceRange: {
        min: Math.round(categoryAvgPrice * 0.85),
        max: Math.round(categoryAvgPrice * 1.15),
      },
      opportunity: competitors.length > 0
        ? `Position at ${Math.round(categoryAvgPrice * 0.95)}-${Math.round(categoryAvgPrice * 1.05)} for competitive pricing with premium quality`
        : 'Insufficient competitor data for pricing recommendation',
    };
  }

  /**
   * Generate review analysis for competitors
   */
  async generateReviewAnalysis(competitorId: string): Promise<ReviewAnalysis | null> {
    const competitor = await queryOne<any>(
      'SELECT * FROM competitors WHERE id = $1',
      [competitorId]
    );
    if (!competitor) return null;

    const products = await query<any>(
      `SELECT cp.*, p.name FROM competitor_products cp
       JOIN products p ON p.id = cp.product_id
       WHERE cp.competitor_id = $1`,
      [competitorId]
    );

    const totalReviews = products.reduce((sum: number, p: any) => sum + (p.competitor_reviews || 0), 0);
    const ratings = products.filter((p: any) => p.competitor_rating > 0).map((p: any) => parseFloat(p.competitor_rating));
    const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;

    // Simulated review analysis (in production, use AI to analyze actual reviews)
    const topComplaints = this.getCommonComplaints(competitor.categories || []);
    const topPraises = this.getCommonPraises(competitor.categories || []);

    const sentimentScore = avgRating >= 4.0 ? 0.7 : avgRating >= 3.5 ? 0.3 : avgRating >= 3.0 ? 0 : -0.3;

    return {
      competitorId,
      brand: competitor.brand,
      totalReviews,
      avgRating,
      ratingDistribution: { '5': 45, '4': 25, '3': 15, '2': 10, '1': 5 },
      topComplaints,
      topPraises,
      sentimentScore,
      qualityPerception: avgRating >= 4.3 ? 'premium' : avgRating >= 4.0 ? 'good' : avgRating >= 3.5 ? 'average' : 'poor',
      opportunityGaps: this.identifyGaps(topComplaints, competitor.categories || []),
    };
  }

  /**
   * Generate full competitor comparison for a category
   */
  async generateComparison(category: string): Promise<CompetitorComparison> {
    const competitors = await this.getCompetitors(category);
    const pricingAnalysis = await this.generatePricingAnalysis(category);

    const reviewInsights: ReviewAnalysis[] = [];
    for (const comp of competitors.slice(0, 5)) {
      const analysis = await this.generateReviewAnalysis(comp.id);
      if (analysis) reviewInsights.push(analysis);
    }

    // Estimate market share
    const totalProducts = competitors.reduce((sum, c) => sum + c.productCount, 0);
    const marketShare = competitors
      .filter(c => c.productCount > 0)
      .map(c => ({
        brand: c.brand,
        estimatedShare: totalProducts > 0 ? Math.round((c.productCount / totalProducts) * 100) : 0,
      }))
      .sort((a, b) => b.estimatedShare - a.estimatedShare);

    const gaps = this.identifyMarketGaps(competitors, category);
    const recommendations = this.generateRecommendations(competitors, pricingAnalysis, category);

    return {
      category,
      competitors,
      pricingAnalysis,
      reviewInsights,
      marketShare,
      gaps,
      recommendations,
    };
  }

  /**
   * Track competitor product changes
   */
  async trackChanges(): Promise<{
    priceChanges: number;
    newProducts: number;
    ratingChanges: number;
  }> {
    // Get competitors with products to track
    const competitorProducts = await query<any>(
      `SELECT cp.*, c.brand FROM competitor_products cp
       JOIN competitors c ON c.id = cp.competitor_id
       WHERE cp.last_checked < NOW() - INTERVAL '24 hours'
       LIMIT 100`
    );

    let priceChanges = 0, newProducts = 0, ratingChanges = 0;

    // In production, this would re-fetch product data from marketplaces
    // and compare with stored values
    for (const cp of competitorProducts) {
      // Update last_checked
      await query(
        'UPDATE competitor_products SET last_checked = NOW() WHERE id = $1',
        [cp.id]
      );
    }

    return { priceChanges, newProducts, ratingChanges };
  }

  // --- Helper Methods ---

  private getCommonComplaints(categories: string[]): { complaint: string; frequency: number }[] {
    const complaints: Record<string, { complaint: string; frequency: number }[]> = {
      dry_fruits: [
        { complaint: 'Stale or not fresh', frequency: 22 },
        { complaint: 'Packaging damaged during delivery', frequency: 18 },
        { complaint: 'Quantity less than expected', frequency: 15 },
        { complaint: 'Not as premium as shown', frequency: 12 },
        { complaint: 'Expensive for quality received', frequency: 10 },
      ],
      healthy_snacks: [
        { complaint: 'Too oily/salty', frequency: 20 },
        { complaint: 'Short expiry date', frequency: 18 },
        { complaint: 'Packaging not resealable', frequency: 14 },
        { complaint: 'Artificial taste', frequency: 12 },
        { complaint: 'Small serving size', frequency: 10 },
      ],
      nuts: [
        { complaint: 'Mixed with broken pieces', frequency: 25 },
        { complaint: 'Not crunchy', frequency: 15 },
        { complaint: 'Old stock', frequency: 12 },
        { complaint: 'Over-roasted', frequency: 10 },
      ],
    };

    const category = categories[0] || 'dry_fruits';
    return complaints[category] || complaints['dry_fruits']!;
  }

  private getCommonPraises(categories: string[]): { praise: string; frequency: number }[] {
    return [
      { praise: 'Good quality and fresh', frequency: 35 },
      { praise: 'Value for money', frequency: 28 },
      { praise: 'Nice packaging', frequency: 22 },
      { praise: 'Fast delivery', frequency: 18 },
      { praise: 'Good taste', frequency: 15 },
    ];
  }

  private identifyGaps(complaints: { complaint: string; frequency: number }[], categories: string[]): string[] {
    const gaps: string[] = [];
    
    if (complaints.some(c => c.complaint.includes('fresh'))) {
      gaps.push('Freshness guarantee with date of packing clearly mentioned');
    }
    if (complaints.some(c => c.complaint.includes('packaging'))) {
      gaps.push('Premium, resealable, damage-proof packaging');
    }
    if (complaints.some(c => c.complaint.includes('quantity'))) {
      gaps.push('Transparent net weight with fill-line indicators');
    }
    gaps.push('Organic certification for health-conscious consumers');
    gaps.push('Subscription model for repeat buyers');
    
    return gaps;
  }

  private identifyMarketGaps(competitors: CompetitorProfile[], category: string): string[] {
    const gaps: string[] = [];

    const hasPremium = competitors.some(c => c.pricingStrategy === 'premium');
    const hasBudget = competitors.some(c => c.pricingStrategy === 'budget');
    const hasSubscription = competitors.some(c => c.uniqueSellingPoints.some(u => u.toLowerCase().includes('subscription')));

    if (!hasPremium) gaps.push('No established premium brand in this category');
    if (!hasSubscription) gaps.push('No strong subscription offering');
    gaps.push('Limited organic/natural positioning');
    gaps.push('Corporate gifting segment underserved');
    if (category.includes('snack')) gaps.push('Limited guilt-free indulgence options');

    return gaps;
  }

  private generateRecommendations(competitors: CompetitorProfile[], pricing: PricingAnalysis, category: string): string[] {
    const recs: string[] = [];

    recs.push(`Price products 5-10% below category average (${pricing.categoryAvgPrice}) while maintaining premium quality`);
    recs.push('Focus on packaging differentiation - premium, eco-friendly, resealable');
    recs.push('Address top customer complaints from competitor reviews');
    
    if (competitors.length < 5) {
      recs.push('Low competition - first-mover advantage possible');
    }
    
    recs.push('Build subscription model for 15-20% repeat purchase revenue');
    recs.push('Create bundle offers to increase AOV vs competitors');

    return recs;
  }
}

export const competitorIntelligenceService = new CompetitorIntelligenceService();

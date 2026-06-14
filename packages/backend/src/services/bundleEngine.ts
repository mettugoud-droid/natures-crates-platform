/**
 * Phase 7: Bundle Recommendation Engine
 * Automatically generates: Combo Packs, Gift Packs, Corporate Hampers, Subscription Packs
 * Calculates: Bundle Margin, AOV Increase, Upsell Potential
 */

import { query, queryOne } from '../db/pool';
import { logger } from '../utils/logger';

export interface BundleRecommendation {
  id: string;
  name: string;
  description: string;
  type: BundleType;
  products: BundleItem[];
  financials: BundleFinancials;
  targeting: BundleTargeting;
  launchRecommendation: string;
}

export type BundleType =
  | 'combo_pack'
  | 'gift_pack'
  | 'corporate_hamper'
  | 'subscription_pack'
  | 'protein_power_pack'
  | 'family_nutrition_pack'
  | 'festival_special'
  | 'trial_pack';

export interface BundleItem {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  weight: string;
}

export interface BundleFinancials {
  totalCost: number;
  packagingCost: number;
  shippingCost: number;
  totalInvestment: number;
  recommendedPrice: number;
  bundleDiscount: number; // percentage off individual prices
  grossMargin: number;
  netMargin: number;
  roi: number;
  aovIncrease: number; // vs individual product average
  breakEvenUnits: number;
}

export interface BundleTargeting {
  targetChannels: string[];
  targetAudience: string;
  seasonality: string[];
  occasions: string[];
  priceSegment: 'budget' | 'mid_range' | 'premium' | 'luxury';
}

// Bundle templates for automated generation
const BUNDLE_TEMPLATES: {
  type: BundleType;
  name: string;
  description: string;
  categories: string[];
  minProducts: number;
  maxProducts: number;
  priceRange: { min: number; max: number };
  targetChannels: string[];
  targetAudience: string;
  seasonality: string[];
  occasions: string[];
}[] = [
  {
    type: 'combo_pack',
    name: 'Healthy Snack Combo',
    description: 'Assorted healthy snacks for everyday munching',
    categories: ['healthy_snacks', 'trail_mixes', 'seeds'],
    minProducts: 3, maxProducts: 5,
    priceRange: { min: 399, max: 799 },
    targetChannels: ['amazon_india', 'flipkart', 'd2c_website'],
    targetAudience: 'Health-conscious millennials',
    seasonality: ['all_year'],
    occasions: ['everyday'],
  },
  {
    type: 'gift_pack',
    name: 'Premium Dry Fruit Gift Box',
    description: 'Luxurious dry fruit assortment in premium packaging',
    categories: ['dry_fruits', 'nuts'],
    minProducts: 4, maxProducts: 8,
    priceRange: { min: 999, max: 2499 },
    targetChannels: ['amazon_india', 'flipkart', 'd2c_website', 'corporate_orders'],
    targetAudience: 'Gift buyers, festival shoppers',
    seasonality: ['October', 'November', 'December', 'March'],
    occasions: ['Diwali', 'Christmas', 'New Year', 'Raksha Bandhan', 'Holi'],
  },
  {
    type: 'corporate_hamper',
    name: 'Corporate Wellness Hamper',
    description: 'Premium wellness gift for corporate clients',
    categories: ['dry_fruits', 'nuts', 'seeds', 'wellness_products', 'functional_foods'],
    minProducts: 5, maxProducts: 10,
    priceRange: { min: 1499, max: 4999 },
    targetChannels: ['d2c_website', 'corporate_orders'],
    targetAudience: 'HR managers, corporate procurement',
    seasonality: ['October', 'November', 'December', 'January'],
    occasions: ['Diwali Corporate', 'Christmas', 'New Year', 'Employee Appreciation'],
  },
  {
    type: 'subscription_pack',
    name: 'Monthly Nutrition Box',
    description: 'Curated monthly box of nuts, seeds and superfoods',
    categories: ['nuts', 'seeds', 'functional_foods', 'healthy_snacks'],
    minProducts: 4, maxProducts: 6,
    priceRange: { min: 599, max: 1299 },
    targetChannels: ['d2c_website'],
    targetAudience: 'Health enthusiasts, fitness community',
    seasonality: ['all_year'],
    occasions: ['monthly_subscription'],
  },
  {
    type: 'protein_power_pack',
    name: 'Protein Power Pack',
    description: 'High-protein nuts and seeds for fitness enthusiasts',
    categories: ['nuts', 'seeds', 'trail_mixes', 'functional_foods'],
    minProducts: 3, maxProducts: 5,
    priceRange: { min: 499, max: 999 },
    targetChannels: ['amazon_india', 'd2c_website', 'blinkit', 'zepto'],
    targetAudience: 'Gym-goers, fitness enthusiasts',
    seasonality: ['January', 'February', 'March'],
    occasions: ['New Year fitness'],
  },
  {
    type: 'trial_pack',
    name: 'Discovery Trial Pack',
    description: 'Small portions of best-sellers for new customers',
    categories: ['dry_fruits', 'nuts', 'seeds', 'healthy_snacks'],
    minProducts: 5, maxProducts: 8,
    priceRange: { min: 199, max: 399 },
    targetChannels: ['blinkit', 'zepto', 'instamart', 'd2c_website'],
    targetAudience: 'First-time buyers, trial seekers',
    seasonality: ['all_year'],
    occasions: ['customer_acquisition'],
  },
];

export class BundleEngineService {
  /**
   * Auto-generate bundle recommendations based on product catalog
   */
  async generateBundleRecommendations(): Promise<BundleRecommendation[]> {
    const recommendations: BundleRecommendation[] = [];

    for (const template of BUNDLE_TEMPLATES) {
      try {
        const bundle = await this.createBundleFromTemplate(template);
        if (bundle) recommendations.push(bundle);
      } catch (error) {
        logger.error(`Failed to generate bundle: ${template.name}`, { error });
      }
    }

    logger.info(`Generated ${recommendations.length} bundle recommendations`);
    return recommendations;
  }

  /**
   * Get stored bundles
   */
  async getBundles(type?: BundleType): Promise<any[]> {
    let sql = `SELECT pb.*, 
      (SELECT json_agg(json_build_object('product_id', bp.product_id, 'quantity', bp.quantity, 'unit_cost', bp.unit_cost))
       FROM bundle_products bp WHERE bp.bundle_id = pb.id) as products
     FROM product_bundles pb`;
    const params: any[] = [];

    if (type) {
      sql += ` WHERE pb.bundle_type = $1`;
      params.push(type);
    }

    sql += ` ORDER BY pb.bundle_margin DESC`;
    return query(sql, params);
  }

  /**
   * Calculate bundle financials
   */
  async calculateBundleFinancials(productIds: string[], bundleType: BundleType): Promise<BundleFinancials> {
    const products = await query<any>(
      `SELECT p.*, ma.product_cost, ma.manufacturing_cost, ma.packaging_cost
       FROM products p
       LEFT JOIN LATERAL (
         SELECT product_cost, manufacturing_cost, packaging_cost
         FROM margin_analyses WHERE product_id = p.id
         ORDER BY calculated_at DESC LIMIT 1
       ) ma ON TRUE
       WHERE p.id = ANY($1)`,
      [productIds]
    );

    const totalProductCost = products.reduce((sum: number, p: any) => {
      return sum + parseFloat(p.cost_price || p.product_cost || String(parseFloat(p.selling_price) * 0.4));
    }, 0);

    const individualTotal = products.reduce((sum: number, p: any) => sum + parseFloat(p.selling_price), 0);
    const avgIndividualPrice = individualTotal / products.length;

    // Bundle pricing: 10-20% discount on combined individual prices
    const bundleDiscount = bundleType === 'corporate_hamper' ? 10 : bundleType === 'trial_pack' ? 25 : 15;
    const recommendedPrice = Math.round(individualTotal * (1 - bundleDiscount / 100));

    // Costs
    const packagingCost = bundleType === 'corporate_hamper' ? 150 :
                          bundleType === 'gift_pack' ? 100 :
                          bundleType === 'trial_pack' ? 30 : 50;
    const shippingCost = recommendedPrice > 500 ? 0 : 40; // Free shipping above 500
    const totalInvestment = totalProductCost + packagingCost + shippingCost;

    // Margins
    const grossMargin = ((recommendedPrice - totalInvestment) / recommendedPrice) * 100;
    const marketingCost = recommendedPrice * 0.08; // 8% marketing
    const returnCost = recommendedPrice * 0.03; // 3% returns
    const netProfit = recommendedPrice - totalInvestment - marketingCost - returnCost;
    const netMargin = (netProfit / recommendedPrice) * 100;

    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
    const aovIncrease = ((recommendedPrice - avgIndividualPrice) / avgIndividualPrice) * 100;
    const breakEvenUnits = netProfit > 0 ? Math.ceil(packagingCost / netProfit) : 999;

    return {
      totalCost: totalProductCost,
      packagingCost,
      shippingCost,
      totalInvestment,
      recommendedPrice,
      bundleDiscount,
      grossMargin: Math.round(grossMargin * 10) / 10,
      netMargin: Math.round(netMargin * 10) / 10,
      roi: Math.round(roi * 10) / 10,
      aovIncrease: Math.round(aovIncrease * 10) / 10,
      breakEvenUnits,
    };
  }

  /**
   * Save a bundle to database
   */
  async saveBundle(bundle: BundleRecommendation): Promise<string> {
    const result = await queryOne<{ id: string }>(
      `INSERT INTO product_bundles (name, description, bundle_type, total_cost, recommended_price,
        bundle_margin, bundle_roi, aov_increase, target_channels, seasonality, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        bundle.name, bundle.description, bundle.type,
        bundle.financials.totalInvestment, bundle.financials.recommendedPrice,
        bundle.financials.grossMargin, bundle.financials.roi,
        bundle.financials.aovIncrease,
        bundle.targeting.targetChannels, bundle.targeting.seasonality,
        JSON.stringify({ targeting: bundle.targeting }),
      ]
    );

    const bundleId = result?.id;
    if (bundleId) {
      for (const product of bundle.products) {
        await query(
          `INSERT INTO bundle_products (bundle_id, product_id, quantity, unit_cost)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (bundle_id, product_id) DO NOTHING`,
          [bundleId, product.productId, product.quantity, product.unitCost]
        );
      }
    }

    return bundleId || '';
  }

  // --- Private Methods ---

  private async createBundleFromTemplate(template: typeof BUNDLE_TEMPLATES[0]): Promise<BundleRecommendation | null> {
    // Find products matching the template categories
    const products = await query<any>(
      `SELECT p.id, p.name, p.category, p.selling_price, p.cost_price, p.rating
       FROM products p
       WHERE p.category = ANY($1)
       AND p.selling_price > 0
       AND p.rating >= 3.5
       AND p.is_white_label_candidate = TRUE
       ORDER BY p.opportunity_score DESC NULLS LAST, p.rating DESC NULLS LAST
       LIMIT $2`,
      [template.categories, template.maxProducts]
    );

    if (products.length < template.minProducts) return null;

    const selectedProducts = products.slice(0, template.maxProducts);
    const productIds = selectedProducts.map((p: any) => p.id);

    const financials = await this.calculateBundleFinancials(productIds, template.type);

    // Only recommend if margins are healthy
    if (financials.grossMargin < 30) return null;

    const bundleItems: BundleItem[] = selectedProducts.map((p: any) => ({
      productId: p.id,
      productName: p.name,
      category: p.category,
      quantity: 1,
      unitCost: parseFloat(p.cost_price || String(parseFloat(p.selling_price) * 0.4)),
      unitPrice: parseFloat(p.selling_price),
      weight: '200g',
    }));

    const recommendation: BundleRecommendation = {
      id: '',
      name: template.name,
      description: template.description,
      type: template.type,
      products: bundleItems,
      financials,
      targeting: {
        targetChannels: template.targetChannels,
        targetAudience: template.targetAudience,
        seasonality: template.seasonality,
        occasions: template.occasions,
        priceSegment: financials.recommendedPrice > 2000 ? 'luxury' :
                     financials.recommendedPrice > 1000 ? 'premium' :
                     financials.recommendedPrice > 500 ? 'mid_range' : 'budget',
      },
      launchRecommendation: financials.netMargin >= 20
        ? `LAUNCH - ${financials.netMargin.toFixed(0)}% net margin, ${financials.aovIncrease.toFixed(0)}% AOV increase`
        : `REVIEW - Margins at ${financials.netMargin.toFixed(0)}%, consider cost optimization`,
    };

    return recommendation;
  }
}

export const bundleEngineService = new BundleEngineService();

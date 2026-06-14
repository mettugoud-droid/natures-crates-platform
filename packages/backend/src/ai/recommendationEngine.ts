import Anthropic from '@anthropic-ai/sdk';
import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { logger } from '../utils/logger';

interface ProductForRecommendation {
  id: string;
  name: string;
  category: string;
  sellingPrice: number;
  estimatedMonthlySales: number;
  rating: number;
  reviewsCount: number;
  growthRate: number;
  grossMarginPercent: number;
  netMarginPercent: number;
  opportunityScore: number;
  competition: number;
  supplierCount: number;
  repeatPurchaseScore: number;
}

type RecommendationCategory =
  | 'top_products_to_launch'
  | 'top_white_label_opportunities'
  | 'top_d2c_products'
  | 'top_corporate_gifting'
  | 'top_blinkit_products'
  | 'top_zepto_products'
  | 'top_repeat_purchase'
  | 'top_low_investment';

interface AIRecommendation {
  rank: number;
  productId: string;
  productName: string;
  score: number;
  reasoning: string;
  keyMetrics: {
    demand: number;
    margin: number;
    competition: number;
    supplierAvailability: number;
    repeatPurchase: number;
  };
}

export class RecommendationEngineService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: config.ai.anthropicApiKey });
  }

  /**
   * Generate AI-powered product recommendations
   */
  async generateRecommendations(category: RecommendationCategory): Promise<AIRecommendation[]> {
    // Fetch candidate products based on category
    const candidates = await this.getCandidateProducts(category);
    
    if (candidates.length === 0) {
      logger.warn(`No candidates found for recommendation category: ${category}`);
      return [];
    }

    // Use AI to rank and provide reasoning
    const recommendations = await this.rankWithAI(candidates, category);

    // Store recommendations
    await queryOne(
      `INSERT INTO ai_recommendations (category, products, ai_model, valid_until)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
       RETURNING id`,
      [category, JSON.stringify(recommendations), config.ai.defaultModel]
    );

    logger.info(`Generated ${recommendations.length} recommendations for ${category}`);
    return recommendations;
  }

  /**
   * Generate all recommendation lists
   */
  async generateAllRecommendations(): Promise<Record<string, number>> {
    const categories: RecommendationCategory[] = [
      'top_products_to_launch',
      'top_white_label_opportunities',
      'top_d2c_products',
      'top_corporate_gifting',
      'top_blinkit_products',
      'top_zepto_products',
      'top_repeat_purchase',
      'top_low_investment',
    ];

    const results: Record<string, number> = {};

    for (const category of categories) {
      try {
        const recs = await this.generateRecommendations(category);
        results[category] = recs.length;
      } catch (error) {
        logger.error(`Failed to generate recommendations for ${category}`, { error });
        results[category] = 0;
      }
    }

    return results;
  }

  /**
   * Get latest recommendations by category
   */
  async getRecommendations(category: RecommendationCategory): Promise<AIRecommendation[]> {
    const result = await queryOne<any>(
      `SELECT products FROM ai_recommendations
       WHERE category = $1 AND valid_until > NOW()
       ORDER BY generated_at DESC LIMIT 1`,
      [category]
    );

    if (!result) {
      // Generate fresh if expired
      return this.generateRecommendations(category);
    }

    return result.products;
  }

  private async getCandidateProducts(category: RecommendationCategory): Promise<ProductForRecommendation[]> {
    let whereClause = '';
    let orderBy = 'p.opportunity_score DESC NULLS LAST';

    switch (category) {
      case 'top_products_to_launch':
        whereClause = `AND p.is_white_label_candidate = TRUE
          AND ma.meets_gross_margin_target = TRUE`;
        break;
      case 'top_white_label_opportunities':
        whereClause = `AND wlo.classification IN ('excellent', 'good')`;
        orderBy = 'wlo.opportunity_score DESC';
        break;
      case 'top_d2c_products':
        whereClause = `AND p.category IN ('healthy_snacks', 'trail_mixes', 'functional_foods', 'wellness_products')
          AND ma.net_margin_percent >= 25`;
        break;
      case 'top_corporate_gifting':
        whereClause = `AND p.category IN ('gift_boxes', 'dry_fruits', 'nuts', 'corporate_gifting', 'gourmet_foods')`;
        break;
      case 'top_blinkit_products':
      case 'top_zepto_products':
        whereClause = `AND p.selling_price <= 500
          AND p.category IN ('healthy_snacks', 'nuts', 'seeds', 'trail_mixes', 'premium_daily_essentials')`;
        break;
      case 'top_repeat_purchase':
        whereClause = `AND wlo.repeat_purchase_score >= 70`;
        orderBy = 'wlo.repeat_purchase_score DESC';
        break;
      case 'top_low_investment':
        whereClause = `AND p.selling_price <= 300
          AND ma.net_margin_percent >= 20`;
        orderBy = 'ma.roi DESC';
        break;
    }

    const products = await query<any>(
      `SELECT
        p.id, p.name, p.category, p.selling_price,
        p.estimated_monthly_sales, p.rating, p.reviews_count,
        p.growth_rate, p.competition_score, p.opportunity_score,
        ma.gross_margin_percent, ma.net_margin_percent,
        wlo.opportunity_score as wl_score,
        wlo.repeat_purchase_score,
        (SELECT COUNT(*) FROM supplier_quotes sq WHERE sq.product_id = p.id) as supplier_count
       FROM products p
       LEFT JOIN LATERAL (
         SELECT gross_margin_percent, net_margin_percent, roi
         FROM margin_analyses WHERE product_id = p.id
         ORDER BY calculated_at DESC LIMIT 1
       ) ma ON TRUE
       LEFT JOIN LATERAL (
         SELECT opportunity_score, classification, repeat_purchase_score
         FROM white_label_opportunities WHERE product_id = p.id
         ORDER BY analyzed_at DESC LIMIT 1
       ) wlo ON TRUE
       WHERE p.selling_price > 0
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT 50`
    );

    return products.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      sellingPrice: parseFloat(p.selling_price),
      estimatedMonthlySales: p.estimated_monthly_sales || 0,
      rating: parseFloat(p.rating || '0'),
      reviewsCount: p.reviews_count || 0,
      growthRate: parseFloat(p.growth_rate || '0'),
      grossMarginPercent: parseFloat(p.gross_margin_percent || '0'),
      netMarginPercent: parseFloat(p.net_margin_percent || '0'),
      opportunityScore: p.wl_score || p.opportunity_score || 0,
      competition: p.competition_score || 50,
      supplierCount: parseInt(p.supplier_count || '0'),
      repeatPurchaseScore: p.repeat_purchase_score || 50,
    }));
  }

  private async rankWithAI(
    candidates: ProductForRecommendation[],
    category: RecommendationCategory
  ): Promise<AIRecommendation[]> {
    if (!config.ai.anthropicApiKey) {
      // Fallback to rule-based ranking if no API key
      return this.ruleBasedRanking(candidates, category);
    }

    try {
      const prompt = this.buildPrompt(candidates, category);
      
      const message = await this.anthropic.messages.create({
        model: config.ai.defaultModel,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0];
      if (!content || content.type !== 'text') {
        return this.ruleBasedRanking(candidates, category);
      }

      // Parse AI response
      const parsed = this.parseAIResponse(content.text, candidates);
      return parsed;
    } catch (error) {
      logger.error('AI recommendation failed, using rule-based fallback', { error });
      return this.ruleBasedRanking(candidates, category);
    }
  }

  private buildPrompt(candidates: ProductForRecommendation[], category: RecommendationCategory): string {
    const categoryLabel = category.replace(/_/g, ' ').replace('top ', 'Top 10 ');
    
    return `You are a product strategy expert for Nature's Crates, a premium Indian brand selling dry fruits, nuts, seeds, and healthy foods.

Analyze these product candidates and select the Top 10 for: "${categoryLabel}"

CANDIDATES:
${candidates.slice(0, 30).map((p, i) => `
${i + 1}. ${p.name}
   Category: ${p.category} | Price: ₹${p.sellingPrice}
   Monthly Sales: ${p.estimatedMonthlySales} | Rating: ${p.rating}
   Gross Margin: ${p.grossMarginPercent}% | Net Margin: ${p.netMarginPercent}%
   Competition: ${p.competition}/100 | Opportunity: ${p.opportunityScore}/100
   Suppliers: ${p.supplierCount} | Repeat Purchase: ${p.repeatPurchaseScore}/100
`).join('\n')}

RANKING CRITERIA:
- Demand strength (monthly sales, growth rate)
- Margin attractiveness (40%+ gross, 20%+ net preferred)
- Competition level (lower is better for entry)
- Supplier availability (more options = less risk)
- Repeat purchase potential (higher = better LTV)
- Brand fit with Nature's Crates (premium, natural, healthy)

Return EXACTLY this JSON format (no markdown, no code blocks):
[{"rank":1,"productId":"...","score":95,"reasoning":"...","keyMetrics":{"demand":90,"margin":85,"competition":30,"supplierAvailability":70,"repeatPurchase":80}}]

Select exactly 10 products. Score 0-100. Provide brief reasoning for each.`;
  }

  private parseAIResponse(text: string, candidates: ProductForRecommendation[]): AIRecommendation[] {
    try {
      // Clean response
      let jsonStr = text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
      }
      
      const parsed = JSON.parse(jsonStr);
      
      return parsed.slice(0, 10).map((item: any, index: number) => {
        const candidate = candidates.find(c => c.id === item.productId);
        return {
          rank: index + 1,
          productId: item.productId,
          productName: candidate?.name || 'Unknown',
          score: item.score || 0,
          reasoning: item.reasoning || '',
          keyMetrics: item.keyMetrics || { demand: 50, margin: 50, competition: 50, supplierAvailability: 50, repeatPurchase: 50 },
        };
      });
    } catch (error) {
      logger.error('Failed to parse AI response', { error, text: text.substring(0, 200) });
      return this.ruleBasedRanking(candidates, 'top_products_to_launch');
    }
  }

  private ruleBasedRanking(
    candidates: ProductForRecommendation[],
    category: RecommendationCategory
  ): AIRecommendation[] {
    // Score and sort by weighted criteria
    const scored = candidates.map((p) => {
      const weights = this.getWeightsForCategory(category);
      
      const score =
        (p.estimatedMonthlySales > 0 ? Math.min(100, p.estimatedMonthlySales / 30) : 0) * weights.demand +
        Math.min(100, p.grossMarginPercent * 2) * weights.margin +
        (100 - p.competition) * weights.competition +
        Math.min(100, p.supplierCount * 20) * weights.supplier +
        p.repeatPurchaseScore * weights.repeatPurchase;

      return { product: p, score: Math.round(score) };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 10).map((item, index) => ({
      rank: index + 1,
      productId: item.product.id,
      productName: item.product.name,
      score: item.score,
      reasoning: `Rule-based: High ${item.product.grossMarginPercent}% margin, ${item.product.estimatedMonthlySales} monthly sales, ${item.product.supplierCount} suppliers.`,
      keyMetrics: {
        demand: Math.min(100, (item.product.estimatedMonthlySales / 30)),
        margin: Math.min(100, item.product.grossMarginPercent * 2),
        competition: 100 - item.product.competition,
        supplierAvailability: Math.min(100, item.product.supplierCount * 20),
        repeatPurchase: item.product.repeatPurchaseScore,
      },
    }));
  }

  private getWeightsForCategory(category: RecommendationCategory) {
    const weights: Record<RecommendationCategory, any> = {
      top_products_to_launch: { demand: 0.25, margin: 0.30, competition: 0.20, supplier: 0.15, repeatPurchase: 0.10 },
      top_white_label_opportunities: { demand: 0.20, margin: 0.25, competition: 0.25, supplier: 0.20, repeatPurchase: 0.10 },
      top_d2c_products: { demand: 0.20, margin: 0.30, competition: 0.15, supplier: 0.10, repeatPurchase: 0.25 },
      top_corporate_gifting: { demand: 0.15, margin: 0.35, competition: 0.15, supplier: 0.20, repeatPurchase: 0.15 },
      top_blinkit_products: { demand: 0.30, margin: 0.20, competition: 0.20, supplier: 0.10, repeatPurchase: 0.20 },
      top_zepto_products: { demand: 0.30, margin: 0.20, competition: 0.20, supplier: 0.10, repeatPurchase: 0.20 },
      top_repeat_purchase: { demand: 0.15, margin: 0.20, competition: 0.10, supplier: 0.10, repeatPurchase: 0.45 },
      top_low_investment: { demand: 0.20, margin: 0.35, competition: 0.15, supplier: 0.20, repeatPurchase: 0.10 },
    };
    return weights[category] || weights.top_products_to_launch;
  }
}

export const recommendationEngineService = new RecommendationEngineService();

import { query, queryOne } from '../db/pool';
import { calculateOpportunityScore, classifyOpportunity } from '../../../shared/src/index';
import { logger } from '../utils/logger';

interface WhiteLabelAnalysisInput {
  productId: string;
  productName: string;
  category: string;
  sellingPrice: number;
  estimatedMonthlySales: number;
  rating: number;
  reviewsCount: number;
  competitionLevel: number; // 0-100
  growthRate: number;
}

interface WhiteLabelResult {
  id: string;
  opportunityScore: number;
  classification: string;
  opportunityTypes: string[];
  reasoning: string;
  risks: string[];
  improvements: string[];
  brandingOpportunities: string[];
  expectedMonthlyRevenue: number;
  factors: {
    demand: number;
    competition: number;
    margin: number;
    manufacturingEase: number;
    repeatPurchase: number;
    brandingPotential: number;
    regulatoryComplexity: number;
  };
}

export class WhiteLabelDetectorService {
  /**
   * Analyze a product for white-label potential
   */
  async analyzeProduct(input: WhiteLabelAnalysisInput): Promise<WhiteLabelResult> {
    // Calculate individual factor scores
    const factors = {
      demand: this.scoreDemand(input.estimatedMonthlySales, input.growthRate),
      competition: this.scoreCompetition(input.competitionLevel, input.reviewsCount),
      margin: await this.scoreMarginPotential(input.productId, input.sellingPrice, input.category),
      manufacturingEase: this.scoreManufacturingEase(input.category),
      repeatPurchase: this.scoreRepeatPurchase(input.category, input.estimatedMonthlySales),
      brandingPotential: this.scoreBrandingPotential(input.category, input.competitionLevel),
      regulatoryComplexity: this.scoreRegulatoryComplexity(input.category),
    };

    // Calculate overall opportunity score
    const opportunityScore = calculateOpportunityScore(factors);
    const classification = classifyOpportunity(opportunityScore);

    // Determine opportunity types
    const opportunityTypes = this.determineOpportunityTypes(factors, input);

    // Generate reasoning and recommendations
    const reasoning = this.generateReasoning(input, factors, opportunityScore);
    const risks = this.identifyRisks(input, factors);
    const improvements = this.suggestImprovements(input, factors);
    const brandingOpportunities = this.identifyBrandingOpps(input);
    const expectedMonthlyRevenue = this.estimateRevenue(input);

    // Store in database
    const result = await queryOne<{ id: string }>(
      `INSERT INTO white_label_opportunities (
        product_id, demand_score, competition_score, margin_score,
        manufacturing_ease_score, repeat_purchase_score, branding_potential_score,
        regulatory_complexity_score, opportunity_score, classification,
        opportunity_types, reasoning, risks, improvements, branding_opportunities,
        expected_monthly_revenue, ai_model, confidence
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING id`,
      [
        input.productId, factors.demand, factors.competition, factors.margin,
        factors.manufacturingEase, factors.repeatPurchase, factors.brandingPotential,
        factors.regulatoryComplexity, opportunityScore, classification,
        opportunityTypes, reasoning, risks, improvements, brandingOpportunities,
        expectedMonthlyRevenue, 'rule_engine_v1', 'medium',
      ]
    );

    // Update product white-label flag
    if (opportunityScore >= 60) {
      await query(
        `UPDATE products SET is_white_label_candidate = TRUE, opportunity_score = $2 WHERE id = $1`,
        [input.productId, opportunityScore]
      );
    }

    logger.info('White-label analysis complete', {
      productId: input.productId,
      score: opportunityScore,
      classification,
    });

    return {
      id: result?.id || '',
      opportunityScore,
      classification,
      opportunityTypes,
      reasoning,
      risks,
      improvements,
      brandingOpportunities,
      expectedMonthlyRevenue,
      factors,
    };
  }

  /**
   * Batch analyze products for white-label potential
   */
  async batchAnalyze(limit: number = 100): Promise<{ analyzed: number; excellent: number; good: number }> {
    // Get products that haven't been analyzed recently
    const products = await query<any>(
      `SELECT p.* FROM products p
       LEFT JOIN white_label_opportunities wlo ON wlo.product_id = p.id
         AND wlo.analyzed_at > NOW() - INTERVAL '7 days'
       WHERE wlo.id IS NULL
       AND p.selling_price > 0
       ORDER BY p.estimated_monthly_sales DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );

    let excellent = 0;
    let good = 0;

    for (const product of products) {
      try {
        const result = await this.analyzeProduct({
          productId: product.id,
          productName: product.name,
          category: product.category,
          sellingPrice: parseFloat(product.selling_price),
          estimatedMonthlySales: product.estimated_monthly_sales || 0,
          rating: parseFloat(product.rating || '0'),
          reviewsCount: product.reviews_count || 0,
          competitionLevel: product.competition_score || 50,
          growthRate: parseFloat(product.growth_rate || '0'),
        });

        if (result.classification === 'excellent') excellent++;
        else if (result.classification === 'good') good++;
      } catch (error) {
        logger.error('Error analyzing product', { productId: product.id, error });
      }
    }

    return { analyzed: products.length, excellent, good };
  }

  /**
   * Get top white-label opportunities
   */
  async getTopOpportunities(limit: number = 20): Promise<any[]> {
    return query(
      `SELECT wlo.*, p.name as product_name, p.category, p.selling_price,
        p.estimated_monthly_sales, p.brand, p.source_marketplace
       FROM white_label_opportunities wlo
       JOIN products p ON p.id = wlo.product_id
       WHERE wlo.classification IN ('excellent', 'good')
       ORDER BY wlo.opportunity_score DESC
       LIMIT $1`,
      [limit]
    );
  }

  // --- Scoring Functions ---

  private scoreDemand(monthlySales: number, growthRate: number): number {
    let score = 0;
    if (monthlySales >= 3000) score += 50;
    else if (monthlySales >= 1000) score += 40;
    else if (monthlySales >= 500) score += 30;
    else if (monthlySales >= 100) score += 20;
    else score += 10;

    if (growthRate >= 50) score += 50;
    else if (growthRate >= 20) score += 40;
    else if (growthRate >= 10) score += 30;
    else if (growthRate >= 0) score += 20;
    else score += 10;

    return Math.min(100, score);
  }

  private scoreCompetition(competitionLevel: number, reviewsCount: number): number {
    // Lower competition = higher score for us (but we invert in the overall calc)
    let score = competitionLevel; // Competition level already 0-100

    // High reviews mean established market (harder to enter)
    if (reviewsCount > 10000) score = Math.max(score, 80);
    else if (reviewsCount > 5000) score = Math.max(score, 60);

    return Math.min(100, score);
  }

  private async scoreMarginPotential(productId: string, sellingPrice: number, category: string): Promise<number> {
    // Check if margin analysis exists
    const margin = await queryOne<any>(
      'SELECT gross_margin_percent FROM margin_analyses WHERE product_id = $1 ORDER BY calculated_at DESC LIMIT 1',
      [productId]
    );

    if (margin) {
      const grossMargin = parseFloat(margin.gross_margin_percent);
      if (grossMargin >= 60) return 100;
      if (grossMargin >= 50) return 85;
      if (grossMargin >= 40) return 70;
      if (grossMargin >= 30) return 50;
      return 30;
    }

    // Estimate based on category averages
    const categoryMargins: Record<string, number> = {
      dry_fruits: 70, nuts: 65, seeds: 75, healthy_snacks: 60,
      trail_mixes: 65, gift_boxes: 55, functional_foods: 70,
      wellness_products: 75, premium_daily_essentials: 50,
    };
    return categoryMargins[category] || 50;
  }

  private scoreManufacturingEase(category: string): number {
    const easeScores: Record<string, number> = {
      dry_fruits: 85, nuts: 80, seeds: 90, healthy_snacks: 70,
      trail_mixes: 85, gift_boxes: 75, functional_foods: 55,
      gourmet_foods: 60, imported_foods: 40, healthy_foods: 65,
      wellness_products: 50, fmcg_products: 45, kitchen_essentials: 55,
      corporate_gifting: 80, premium_daily_essentials: 60,
    };
    return easeScores[category] || 50;
  }

  private scoreRepeatPurchase(category: string, monthlySales: number): number {
    const repeatScores: Record<string, number> = {
      dry_fruits: 85, nuts: 80, seeds: 75, healthy_snacks: 90,
      trail_mixes: 80, gift_boxes: 30, functional_foods: 70,
      wellness_products: 75, premium_daily_essentials: 90, fmcg_products: 85,
    };
    let base = repeatScores[category] || 50;
    
    // High consistent sales indicate repeat purchases
    if (monthlySales > 1000) base = Math.min(100, base + 10);
    
    return base;
  }

  private scoreBrandingPotential(category: string, competition: number): number {
    const brandingScores: Record<string, number> = {
      dry_fruits: 80, nuts: 75, seeds: 70, healthy_snacks: 85,
      trail_mixes: 80, gift_boxes: 90, functional_foods: 85,
      gourmet_foods: 90, wellness_products: 85, corporate_gifting: 95,
      premium_daily_essentials: 70,
    };
    let base = brandingScores[category] || 60;
    
    // Low competition means more branding headroom
    if (competition < 30) base = Math.min(100, base + 15);
    else if (competition < 50) base = Math.min(100, base + 10);
    
    return base;
  }

  private scoreRegulatoryComplexity(category: string): number {
    // Higher score = MORE complex (which is worse)
    const complexity: Record<string, number> = {
      dry_fruits: 20, nuts: 20, seeds: 25, healthy_snacks: 35,
      trail_mixes: 25, gift_boxes: 15, functional_foods: 60,
      imported_foods: 70, wellness_products: 65, fmcg_products: 45,
      kitchen_essentials: 30, corporate_gifting: 15, premium_daily_essentials: 35,
    };
    return complexity[category] || 40;
  }

  private determineOpportunityTypes(factors: any, input: WhiteLabelAnalysisInput): string[] {
    const types: string[] = [];
    
    if (factors.manufacturingEase >= 70) types.push('white_label');
    if (factors.brandingPotential >= 70) types.push('private_label');
    if (factors.margin >= 60 && factors.demand >= 60) types.push('oem_manufacturing');
    if (factors.repeatPurchase >= 70) types.push('contract_manufacturing');
    
    if (types.length === 0) types.push('white_label'); // Default
    return types;
  }

  private generateReasoning(input: WhiteLabelAnalysisInput, factors: any, score: number): string {
    const parts: string[] = [];
    
    if (score >= 80) parts.push(`Excellent opportunity in ${input.category}.`);
    else if (score >= 60) parts.push(`Good opportunity in ${input.category}.`);
    else parts.push(`Moderate opportunity in ${input.category}.`);

    if (factors.demand >= 70) parts.push(`Strong market demand with ~${input.estimatedMonthlySales} monthly sales.`);
    if (factors.margin >= 70) parts.push('High margin potential.');
    if (factors.repeatPurchase >= 70) parts.push('Strong repeat purchase potential.');
    if (factors.brandingPotential >= 70) parts.push('Excellent branding headroom.');
    if (factors.competition < 40) parts.push('Relatively low competition.');
    
    return parts.join(' ');
  }

  private identifyRisks(input: WhiteLabelAnalysisInput, factors: any): string[] {
    const risks: string[] = [];
    
    if (factors.competition >= 70) risks.push('High competition from established brands');
    if (factors.regulatoryComplexity >= 60) risks.push('Complex regulatory requirements');
    if (input.growthRate < 0) risks.push('Declining market trend');
    if (input.estimatedMonthlySales < 50) risks.push('Low market volume');
    if (factors.manufacturingEase < 40) risks.push('Manufacturing complexity');
    
    return risks;
  }

  private suggestImprovements(input: WhiteLabelAnalysisInput, factors: any): string[] {
    const improvements: string[] = [];
    
    if (factors.brandingPotential >= 70) improvements.push('Premium packaging can differentiate');
    improvements.push('Focus on organic/natural positioning');
    if (input.category.includes('snack') || input.category.includes('mix')) {
      improvements.push('Add unique flavor variants');
    }
    improvements.push('Subscription model for repeat purchases');
    
    return improvements;
  }

  private identifyBrandingOpps(input: WhiteLabelAnalysisInput): string[] {
    return [
      `Position as premium ${input.category.replace(/_/g, ' ')} under Nature\'s Crates`,
      'Emphasize quality sourcing and natural ingredients',
      'Create gift-worthy packaging for corporate segment',
      'Build D2C subscription offering',
    ];
  }

  private estimateRevenue(input: WhiteLabelAnalysisInput): number {
    return input.estimatedMonthlySales * input.sellingPrice * 0.8; // 80% of market potential
  }
}

export const whiteLabelDetectorService = new WhiteLabelDetectorService();

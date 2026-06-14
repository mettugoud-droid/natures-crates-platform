/**
 * Phase 8: Nature's Crates Product Finder
 * Dedicated endpoint for finding best products matching Nature's Crates criteria:
 * - Min 40% gross margin
 * - Min 20% net margin  
 * - MOQ below 50K investment
 * - White Label / Private Label available
 * - Repeat purchase potential
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';

const router = Router();

interface ProductFinderFilters {
  minGrossMargin?: number;
  minNetMargin?: number;
  maxInvestment?: number; // in INR
  whiteLabelOnly?: boolean;
  privateLabelOnly?: boolean;
  minRepeatPurchaseScore?: number;
  minOpportunityScore?: number;
  categories?: string[];
  channels?: string[];
  maxCompetition?: number;
  limit?: number;
}

/**
 * GET /api/product-finder/top-10
 * Get top 10 opportunities for Nature's Crates
 */
router.get('/top-10', async (_req: Request, res: Response) => {
  const products = await findBestProducts({ limit: 10 });
  res.json({ success: true, data: products, total: products.length });
});

/**
 * GET /api/product-finder/top-25
 * Get top 25 opportunities
 */
router.get('/top-25', async (_req: Request, res: Response) => {
  const products = await findBestProducts({ limit: 25 });
  res.json({ success: true, data: products, total: products.length });
});

/**
 * GET /api/product-finder/top-50
 * Get top 50 opportunities
 */
router.get('/top-50', async (_req: Request, res: Response) => {
  const products = await findBestProducts({ limit: 50 });
  res.json({ success: true, data: products, total: products.length });
});

/**
 * POST /api/product-finder/search
 * Advanced product finder with custom filters
 */
router.post('/search', async (req: Request, res: Response) => {
  const filters = z.object({
    minGrossMargin: z.number().min(0).max(100).optional().default(40),
    minNetMargin: z.number().min(0).max(100).optional().default(20),
    maxInvestment: z.number().positive().optional().default(50000),
    whiteLabelOnly: z.boolean().optional().default(true),
    privateLabelOnly: z.boolean().optional().default(false),
    minRepeatPurchaseScore: z.number().min(0).max(100).optional(),
    minOpportunityScore: z.number().min(0).max(100).optional().default(60),
    categories: z.array(z.string()).optional(),
    channels: z.array(z.string()).optional(),
    maxCompetition: z.number().min(0).max(100).optional().default(70),
    limit: z.number().min(1).max(200).optional().default(50),
  }).parse(req.body);

  const products = await findBestProducts(filters);
  res.json({ success: true, data: products, total: products.length });
});

/**
 * GET /api/product-finder/summary
 * Get summary statistics for the product finder
 */
router.get('/summary', async (_req: Request, res: Response) => {
  const stats = await query<any>(`
    SELECT
      (SELECT COUNT(*) FROM products WHERE is_white_label_candidate = TRUE) as white_label_candidates,
      (SELECT COUNT(*) FROM products p
       JOIN margin_analyses ma ON ma.product_id = p.id
       WHERE ma.meets_gross_margin_target = TRUE AND ma.meets_net_margin_target = TRUE
      ) as high_margin_products,
      (SELECT COUNT(*) FROM white_label_opportunities WHERE classification IN ('excellent', 'good')) as top_opportunities,
      (SELECT COUNT(*) FROM suppliers WHERE oem_available = TRUE AND trust_score >= 50) as verified_suppliers,
      (SELECT AVG(wlo.opportunity_score) FROM white_label_opportunities wlo WHERE wlo.classification IN ('excellent', 'good')) as avg_opportunity_score,
      (SELECT AVG(ma.gross_margin_percent) FROM margin_analyses ma WHERE ma.meets_gross_margin_target = TRUE) as avg_gross_margin,
      (SELECT AVG(ma.net_margin_percent) FROM margin_analyses ma WHERE ma.meets_net_margin_target = TRUE) as avg_net_margin
  `);

  res.json({ success: true, data: stats[0] || {} });
});

/**
 * GET /api/product-finder/categories
 * Get category-wise breakdown of opportunities
 */
router.get('/categories', async (_req: Request, res: Response) => {
  const categories = await query(`
    SELECT 
      p.category,
      COUNT(*) as total_products,
      COUNT(*) FILTER (WHERE p.is_white_label_candidate = TRUE) as white_label_count,
      AVG(wlo.opportunity_score) as avg_opportunity_score,
      AVG(ma.gross_margin_percent) as avg_gross_margin,
      AVG(ma.net_margin_percent) as avg_net_margin,
      COUNT(*) FILTER (WHERE wlo.classification = 'excellent') as excellent_count,
      COUNT(*) FILTER (WHERE wlo.classification = 'good') as good_count
    FROM products p
    LEFT JOIN LATERAL (
      SELECT opportunity_score, classification
      FROM white_label_opportunities WHERE product_id = p.id
      ORDER BY analyzed_at DESC LIMIT 1
    ) wlo ON TRUE
    LEFT JOIN LATERAL (
      SELECT gross_margin_percent, net_margin_percent
      FROM margin_analyses WHERE product_id = p.id
      ORDER BY calculated_at DESC LIMIT 1
    ) ma ON TRUE
    GROUP BY p.category
    HAVING COUNT(*) > 0
    ORDER BY AVG(wlo.opportunity_score) DESC NULLS LAST
  `);

  res.json({ success: true, data: categories });
});

// --- Core Query Function ---

async function findBestProducts(filters: ProductFinderFilters = {}): Promise<any[]> {
  const {
    minGrossMargin = 40,
    minNetMargin = 20,
    maxInvestment = 50000,
    whiteLabelOnly = true,
    minOpportunityScore = 60,
    maxCompetition = 70,
    categories,
    limit = 50,
  } = filters;

  let whereConditions = `
    WHERE p.selling_price > 0
  `;
  const params: any[] = [];
  let paramIdx = 0;

  if (whiteLabelOnly) {
    whereConditions += ` AND p.is_white_label_candidate = TRUE`;
  }

  if (minOpportunityScore > 0) {
    paramIdx++;
    whereConditions += ` AND COALESCE(wlo.opportunity_score, 0) >= $${paramIdx}`;
    params.push(minOpportunityScore);
  }

  if (maxCompetition < 100) {
    paramIdx++;
    whereConditions += ` AND COALESCE(p.competition_score, 50) <= $${paramIdx}`;
    params.push(maxCompetition);
  }

  if (minGrossMargin > 0) {
    paramIdx++;
    whereConditions += ` AND COALESCE(ma.gross_margin_percent, 0) >= $${paramIdx}`;
    params.push(minGrossMargin);
  }

  if (minNetMargin > 0) {
    paramIdx++;
    whereConditions += ` AND COALESCE(ma.net_margin_percent, 0) >= $${paramIdx}`;
    params.push(minNetMargin);
  }

  if (maxInvestment > 0) {
    paramIdx++;
    // Estimate investment as cost_price * estimated MOQ (assume 100 units min)
    whereConditions += ` AND COALESCE(p.cost_price, p.selling_price * 0.4) * 100 <= $${paramIdx}`;
    params.push(maxInvestment);
  }

  if (categories && categories.length > 0) {
    paramIdx++;
    whereConditions += ` AND p.category = ANY($${paramIdx})`;
    params.push(categories);
  }

  paramIdx++;
  params.push(limit);

  const sql = `
    SELECT 
      p.*,
      ma.gross_margin_percent,
      ma.net_margin_percent,
      ma.roi,
      ma.recommended_selling_price,
      ma.break_even_units,
      wlo.opportunity_score as wl_opportunity_score,
      wlo.classification,
      wlo.demand_score,
      wlo.competition_score as wl_competition_score,
      wlo.margin_score,
      wlo.repeat_purchase_score,
      wlo.branding_potential_score,
      wlo.manufacturing_ease_score,
      wlo.reasoning,
      wlo.risks,
      wlo.improvements,
      (SELECT COUNT(*) FROM supplier_quotes sq WHERE sq.product_id = p.id) as supplier_count,
      COALESCE(p.cost_price, p.selling_price * 0.4) * 100 as estimated_investment
    FROM products p
    LEFT JOIN LATERAL (
      SELECT gross_margin_percent, net_margin_percent, roi, recommended_selling_price, break_even_units
      FROM margin_analyses WHERE product_id = p.id
      ORDER BY calculated_at DESC LIMIT 1
    ) ma ON TRUE
    LEFT JOIN LATERAL (
      SELECT opportunity_score, classification, demand_score, competition_score,
        margin_score, repeat_purchase_score, branding_potential_score,
        manufacturing_ease_score, reasoning, risks, improvements
      FROM white_label_opportunities WHERE product_id = p.id
      ORDER BY analyzed_at DESC LIMIT 1
    ) wlo ON TRUE
    ${whereConditions}
    ORDER BY 
      COALESCE(wlo.opportunity_score, 0) DESC,
      COALESCE(ma.net_margin_percent, 0) DESC,
      p.estimated_monthly_sales DESC NULLS LAST
    LIMIT $${paramIdx}
  `;

  return query(sql, params);
}

export default router;

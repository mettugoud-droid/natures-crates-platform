/**
 * Phase 10: Analytics API Routes
 * Provides data for visualization dashboards:
 * - Product trends over time
 * - Opportunity score distribution
 * - Supplier distribution by state
 * - Margin distribution
 * - Category growth
 * - Revenue potential
 */

import { Router, Request, Response } from 'express';
import { query } from '../db/pool';

const router = Router();

/**
 * GET /api/analytics/trends
 * Product trend data over time (prices, sales, rankings)
 */
router.get('/trends', async (req: Request, res: Response) => {
  const days = Number(req.query.days || 30);
  const category = req.query.category as string | undefined;

  let sql = `
    SELECT 
      pt.date,
      COUNT(DISTINCT pt.product_id) as products_tracked,
      AVG(pt.price) as avg_price,
      AVG(pt.sales_estimate) FILTER (WHERE pt.sales_estimate > 0) as avg_sales,
      AVG(pt.rating) FILTER (WHERE pt.rating > 0) as avg_rating
    FROM product_trends pt
    JOIN products p ON p.id = pt.product_id
    WHERE pt.date >= CURRENT_DATE - $1
  `;
  const params: any[] = [days];

  if (category) {
    sql += ` AND p.category = $2`;
    params.push(category);
  }

  sql += ` GROUP BY pt.date ORDER BY pt.date`;

  const data = await query(sql, params);
  res.json({ success: true, data });
});

/**
 * GET /api/analytics/opportunity-distribution
 * Distribution of opportunity scores
 */
router.get('/opportunity-distribution', async (_req: Request, res: Response) => {
  const data = await query(`
    SELECT 
      CASE 
        WHEN wlo.opportunity_score >= 80 THEN 'Excellent (80-100)'
        WHEN wlo.opportunity_score >= 60 THEN 'Good (60-79)'
        WHEN wlo.opportunity_score >= 40 THEN 'Moderate (40-59)'
        ELSE 'Avoid (0-39)'
      END as classification,
      COUNT(*) as count,
      AVG(wlo.opportunity_score) as avg_score
    FROM white_label_opportunities wlo
    GROUP BY 
      CASE 
        WHEN wlo.opportunity_score >= 80 THEN 'Excellent (80-100)'
        WHEN wlo.opportunity_score >= 60 THEN 'Good (60-79)'
        WHEN wlo.opportunity_score >= 40 THEN 'Moderate (40-59)'
        ELSE 'Avoid (0-39)'
      END
    ORDER BY avg_score DESC
  `);
  res.json({ success: true, data });
});

/**
 * GET /api/analytics/supplier-distribution
 * Suppliers by state and capability
 */
router.get('/supplier-distribution', async (_req: Request, res: Response) => {
  const byState = await query(`
    SELECT state, COUNT(*) as count, AVG(trust_score) as avg_trust_score
    FROM suppliers WHERE state IS NOT NULL
    GROUP BY state ORDER BY count DESC LIMIT 15
  `);

  const byCapability = await query(`
    SELECT 
      COUNT(*) FILTER (WHERE oem_available = TRUE) as oem_capable,
      COUNT(*) FILTER (WHERE white_label_available = TRUE) as white_label,
      COUNT(*) FILTER (WHERE private_label_available = TRUE) as private_label,
      COUNT(*) FILTER (WHERE custom_packaging_available = TRUE) as custom_packaging,
      COUNT(*) FILTER (WHERE contract_manufacturing = TRUE) as contract_mfg,
      COUNT(*) as total
    FROM suppliers
  `);

  const byVerification = await query(`
    SELECT verification_status, COUNT(*) as count
    FROM suppliers GROUP BY verification_status
  `);

  res.json({ success: true, data: { byState, byCapability: byCapability[0], byVerification } });
});

/**
 * GET /api/analytics/margin-distribution
 * Distribution of margins across products
 */
router.get('/margin-distribution', async (_req: Request, res: Response) => {
  const grossMargins = await query(`
    SELECT 
      CASE 
        WHEN gross_margin_percent >= 60 THEN '60%+'
        WHEN gross_margin_percent >= 50 THEN '50-60%'
        WHEN gross_margin_percent >= 40 THEN '40-50%'
        WHEN gross_margin_percent >= 30 THEN '30-40%'
        WHEN gross_margin_percent >= 20 THEN '20-30%'
        ELSE '<20%'
      END as range,
      COUNT(*) as count
    FROM margin_analyses
    GROUP BY range
    ORDER BY MIN(gross_margin_percent) DESC
  `);

  const netMargins = await query(`
    SELECT 
      CASE 
        WHEN net_margin_percent >= 30 THEN '30%+'
        WHEN net_margin_percent >= 20 THEN '20-30%'
        WHEN net_margin_percent >= 10 THEN '10-20%'
        WHEN net_margin_percent >= 0 THEN '0-10%'
        ELSE 'Negative'
      END as range,
      COUNT(*) as count
    FROM margin_analyses
    GROUP BY range
    ORDER BY MIN(net_margin_percent) DESC
  `);

  const byChannel = await query(`
    SELECT 
      assumptions->>'channel' as channel,
      AVG(gross_margin_percent) as avg_gross,
      AVG(net_margin_percent) as avg_net,
      COUNT(*) as products
    FROM margin_analyses
    WHERE assumptions->>'channel' IS NOT NULL
    GROUP BY assumptions->>'channel'
    ORDER BY avg_net DESC
  `);

  res.json({ success: true, data: { grossMargins, netMargins, byChannel } });
});

/**
 * GET /api/analytics/category-growth
 * Growth trends by category
 */
router.get('/category-growth', async (_req: Request, res: Response) => {
  const data = await query(`
    SELECT 
      p.category,
      COUNT(*) as total_products,
      COUNT(*) FILTER (WHERE p.created_at > NOW() - INTERVAL '7 days') as new_this_week,
      COUNT(*) FILTER (WHERE p.created_at > NOW() - INTERVAL '30 days') as new_this_month,
      AVG(p.selling_price) as avg_price,
      AVG(p.estimated_monthly_sales) FILTER (WHERE p.estimated_monthly_sales > 0) as avg_monthly_sales,
      AVG(p.growth_rate) FILTER (WHERE p.growth_rate IS NOT NULL) as avg_growth_rate,
      AVG(p.opportunity_score) FILTER (WHERE p.opportunity_score IS NOT NULL) as avg_opportunity
    FROM products p
    GROUP BY p.category
    HAVING COUNT(*) > 0
    ORDER BY AVG(p.growth_rate) DESC NULLS LAST
  `);

  res.json({ success: true, data });
});

/**
 * GET /api/analytics/revenue-potential
 * Revenue potential analysis
 */
router.get('/revenue-potential', async (_req: Request, res: Response) => {
  const data = await query(`
    SELECT 
      p.category,
      COUNT(*) FILTER (WHERE p.is_white_label_candidate = TRUE) as launch_candidates,
      SUM(p.estimated_monthly_sales * p.selling_price) FILTER (WHERE p.is_white_label_candidate = TRUE) as total_market_value,
      AVG(ma.net_margin_percent) as avg_net_margin,
      SUM(p.estimated_monthly_sales * p.selling_price * COALESCE(ma.net_margin_percent, 15) / 100) 
        FILTER (WHERE p.is_white_label_candidate = TRUE) as potential_monthly_profit
    FROM products p
    LEFT JOIN LATERAL (
      SELECT net_margin_percent FROM margin_analyses WHERE product_id = p.id
      ORDER BY calculated_at DESC LIMIT 1
    ) ma ON TRUE
    GROUP BY p.category
    HAVING COUNT(*) FILTER (WHERE p.is_white_label_candidate = TRUE) > 0
    ORDER BY potential_monthly_profit DESC NULLS LAST
  `);

  res.json({ success: true, data });
});

/**
 * GET /api/analytics/daily-summary
 * Daily metrics for sparklines and mini-charts
 */
router.get('/daily-summary', async (req: Request, res: Response) => {
  const days = Number(req.query.days || 14);

  const data = await query(`
    SELECT 
      je.started_at::date as date,
      SUM(je.records_processed) as products_processed,
      SUM(je.records_created) as products_created,
      COUNT(*) FILTER (WHERE je.status = 'completed') as jobs_completed,
      COUNT(*) FILTER (WHERE je.status = 'failed') as jobs_failed
    FROM job_executions je
    WHERE je.started_at >= CURRENT_DATE - $1
    GROUP BY je.started_at::date
    ORDER BY date
  `, [days]);

  res.json({ success: true, data });
});

export default router;

import { query, queryOne } from '../db/pool';
import { recommendationEngineService } from '../ai/recommendationEngine';
import { productIntelligenceService } from '../services/productIntelligence';
import { logger } from '../utils/logger';

/**
 * Daily Report Generation Job
 * Generates executive summary and product opportunity reports
 */
export async function reportGenerationJob(): Promise<{
  processed: number;
  created: number;
}> {
  const today = new Date().toISOString().split('T')[0];

  // Gather metrics
  const stats = await productIntelligenceService.getDashboardStats();

  // Get today's new products
  const newProducts = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM products WHERE created_at > NOW() - INTERVAL '24 hours'`
  );

  // Get new opportunities
  const newOpportunities = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM white_label_opportunities
     WHERE analyzed_at > NOW() - INTERVAL '24 hours' AND classification IN ('excellent', 'good')`
  );

  // Get new suppliers
  const newSuppliers = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM suppliers WHERE created_at > NOW() - INTERVAL '24 hours'`
  );

  // Get high-margin count
  const highMargin = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM margin_analyses
     WHERE calculated_at > NOW() - INTERVAL '24 hours'
     AND meets_gross_margin_target = TRUE AND meets_net_margin_target = TRUE`
  );

  // Get top opportunities
  const topOpportunities = await query(
    `SELECT wlo.*, p.name, p.category, p.selling_price
     FROM white_label_opportunities wlo
     JOIN products p ON p.id = wlo.product_id
     WHERE wlo.analyzed_at > NOW() - INTERVAL '24 hours'
     ORDER BY wlo.opportunity_score DESC
     LIMIT 10`
  );

  // Generate recommendations
  try {
    await recommendationEngineService.generateAllRecommendations();
  } catch (error) {
    logger.warn('Failed to generate recommendations in report', { error });
  }

  // Generate executive summary
  const executiveSummary = generateSummary({
    newProducts: parseInt(newProducts?.count || '0'),
    newOpportunities: parseInt(newOpportunities?.count || '0'),
    newSuppliers: parseInt(newSuppliers?.count || '0'),
    highMargin: parseInt(highMargin?.count || '0'),
    totalProducts: stats.totalProducts,
    totalOpportunities: stats.whiteLabelCandidates,
  });

  // Store report
  await query(
    `INSERT INTO daily_reports (
      report_date, new_products_discovered, new_opportunities_found,
      new_suppliers_added, high_margin_products,
      executive_summary, top_opportunities, key_metrics
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (report_date) DO UPDATE SET
      new_products_discovered = $2, new_opportunities_found = $3,
      new_suppliers_added = $4, high_margin_products = $5,
      executive_summary = $6, top_opportunities = $7, key_metrics = $8,
      generated_at = NOW()`,
    [
      today,
      parseInt(newProducts?.count || '0'),
      parseInt(newOpportunities?.count || '0'),
      parseInt(newSuppliers?.count || '0'),
      parseInt(highMargin?.count || '0'),
      executiveSummary,
      JSON.stringify(topOpportunities),
      JSON.stringify(stats),
    ]
  );

  logger.info('Daily report generated', { date: today });

  return { processed: 1, created: 1 };
}

function generateSummary(metrics: {
  newProducts: number;
  newOpportunities: number;
  newSuppliers: number;
  highMargin: number;
  totalProducts: number;
  totalOpportunities: number;
}): string {
  return `Daily Intelligence Report - Nature's Crates

Summary:
- ${metrics.newProducts} new products discovered today
- ${metrics.newOpportunities} new high-potential opportunities identified
- ${metrics.newSuppliers} new suppliers added to database
- ${metrics.highMargin} products meeting margin targets (40% gross, 20% net)

Portfolio Overview:
- Total products tracked: ${metrics.totalProducts}
- Total white-label candidates: ${metrics.totalOpportunities}

Action Items:
${metrics.newOpportunities > 0 ? `- Review ${metrics.newOpportunities} new opportunities for launch consideration` : '- No urgent new opportunities today'}
${metrics.highMargin > 5 ? '- Several high-margin products identified - consider prioritized launch' : ''}
${metrics.newSuppliers > 0 ? `- ${metrics.newSuppliers} new suppliers require verification` : ''}

Recommendation: Focus on top-scored opportunities with verified suppliers for fastest time-to-market.`;
}

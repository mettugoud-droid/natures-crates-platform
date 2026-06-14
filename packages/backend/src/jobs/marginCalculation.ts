import { query } from '../db/pool';
import { marginAnalyzerService } from '../services/marginAnalyzer';
import { logger } from '../utils/logger';

/**
 * Daily Margin Calculation Job
 * Calculates margins for products that don't have recent margin analysis
 */
export async function marginCalculationJob(): Promise<{
  processed: number;
  created: number;
  highMargin: number;
}> {
  // Find products without recent margin analysis
  const products = await query<any>(
    `SELECT p.* FROM products p
     LEFT JOIN LATERAL (
       SELECT id FROM margin_analyses
       WHERE product_id = p.id AND calculated_at > NOW() - INTERVAL '7 days'
       LIMIT 1
     ) ma ON TRUE
     WHERE ma.id IS NULL
     AND p.selling_price > 0
     AND p.cost_price IS NOT NULL
     ORDER BY p.opportunity_score DESC NULLS LAST
     LIMIT 200`
  );

  let processed = 0;
  let highMargin = 0;

  for (const product of products) {
    try {
      const result = await marginAnalyzerService.calculateMargin({
        productId: product.id,
        sellingPrice: parseFloat(product.selling_price),
        productCost: parseFloat(product.cost_price || '0'),
        category: product.category,
        channel: product.source_marketplace === 'amazon_india' ? 'amazon_india' :
                 product.source_marketplace === 'flipkart' ? 'flipkart' : 'd2c_website',
        estimatedMonthlySales: product.estimated_monthly_sales || 100,
      });

      if (result.meetsGrossMarginTarget && result.meetsNetMarginTarget) {
        highMargin++;
      }
      processed++;
    } catch (error) {
      logger.error('Error calculating margin', { productId: product.id, error });
    }
  }

  return { processed, created: processed, highMargin };
}

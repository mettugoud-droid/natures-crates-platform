import { productIntelligenceService } from '../services/productIntelligence';
import { ALL_CATEGORIES } from '@natures-crates/shared';
import { logger } from '../utils/logger';

/**
 * Daily Product Discovery Job
 * Scans all categories across marketplaces for trending products
 */
export async function dailyDiscoveryJob(): Promise<{
  processed: number;
  created: number;
  categories: Record<string, number>;
}> {
  let totalProcessed = 0;
  let totalCreated = 0;
  const categoryResults: Record<string, number> = {};

  for (const category of ALL_CATEGORIES) {
    try {
      logger.info(`Discovering products for category: ${category}`);
      const result = await productIntelligenceService.discoverTrendingProducts(category);
      
      categoryResults[category] = result.productsDiscovered;
      totalCreated += result.productsDiscovered;
      totalProcessed++;

      // Small delay between categories to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      logger.error(`Error discovering products for ${category}`, { error });
      categoryResults[category] = 0;
    }
  }

  logger.info('Daily discovery completed', {
    totalProcessed,
    totalCreated,
    categories: categoryResults,
  });

  return {
    processed: totalProcessed,
    created: totalCreated,
    categories: categoryResults,
  };
}

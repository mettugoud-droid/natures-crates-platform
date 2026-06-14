/**
 * Daily Marketplace Intelligence Refresh Job
 * Runs all marketplace intelligence modules:
 * 1. Amazon Best Sellers, Movers & Shakers, New Releases, Most Wished
 * 2. Flipkart Best Sellers, Trending, Fast-Growing Categories
 * 3. Google Trends - keyword clusters, seasonal demand, forecasting
 */

import { amazonIntelligenceService } from '../services/marketplace/amazonIntelligence';
import { flipkartIntelligenceService } from '../services/marketplace/flipkartIntelligence';
import { googleTrendsIntelligenceService } from '../services/marketplace/googleTrendsIntelligence';
import { logger } from '../utils/logger';

export interface MarketplaceRefreshResult {
  processed: number;
  created: number;
  amazon: {
    bestSellers: number;
    moversShakers: number;
    newReleases: number;
    mostWished: number;
    total: number;
  };
  flipkart: {
    bestSellers: number;
    trending: number;
    fastGrowingCategories: number;
    total: number;
  };
  googleTrends: {
    keywordsAnalyzed: number;
    risingTrends: number;
    seasonalInsights: number;
    forecasts: number;
  };
  errors: string[];
  duration: number;
}

export async function marketplaceRefreshJob(): Promise<MarketplaceRefreshResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let amazonResults = { bestSellers: 0, moversShakers: 0, newReleases: 0, mostWished: 0, total: 0 };
  let flipkartResults = { bestSellers: 0, trending: 0, fastGrowingCategories: 0, total: 0 };
  let trendsResults = { keywordsAnalyzed: 0, risingTrends: 0, seasonalInsights: 0, forecasts: 0 };

  // === AMAZON INTELLIGENCE ===
  logger.info('[Marketplace Refresh] Starting Amazon Intelligence scan...');
  try {
    const amazon = await amazonIntelligenceService.runFullScan();
    amazonResults = {
      bestSellers: amazon.bestSellers,
      moversShakers: amazon.moversShakers,
      newReleases: amazon.newReleases,
      mostWished: amazon.mostWished,
      total: amazon.totalProducts,
    };
    logger.info('[Marketplace Refresh] Amazon scan complete', amazonResults);
  } catch (error) {
    const msg = `Amazon scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(msg);
    logger.error(msg, { error });
  }

  // === FLIPKART INTELLIGENCE ===
  logger.info('[Marketplace Refresh] Starting Flipkart Intelligence scan...');
  try {
    const flipkart = await flipkartIntelligenceService.runFullScan();
    flipkartResults = {
      bestSellers: flipkart.bestSellers,
      trending: flipkart.trending,
      fastGrowingCategories: flipkart.fastGrowingCategories,
      total: flipkart.totalProducts,
    };
    logger.info('[Marketplace Refresh] Flipkart scan complete', flipkartResults);
  } catch (error) {
    const msg = `Flipkart scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(msg);
    logger.error(msg, { error });
  }

  // === GOOGLE TRENDS INTELLIGENCE ===
  logger.info('[Marketplace Refresh] Starting Google Trends Intelligence scan...');
  try {
    trendsResults = await googleTrendsIntelligenceService.runFullScan();
    logger.info('[Marketplace Refresh] Google Trends scan complete', trendsResults);
  } catch (error) {
    const msg = `Google Trends scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(msg);
    logger.error(msg, { error });
  }

  const duration = Date.now() - startTime;
  const totalProcessed = amazonResults.total + flipkartResults.total + trendsResults.keywordsAnalyzed;

  logger.info('[Marketplace Refresh] Complete', {
    duration: `${Math.round(duration / 1000)}s`,
    totalProcessed,
    errors: errors.length,
  });

  return {
    processed: totalProcessed,
    created: totalProcessed,
    amazon: amazonResults,
    flipkart: flipkartResults,
    googleTrends: trendsResults,
    errors,
    duration,
  };
}

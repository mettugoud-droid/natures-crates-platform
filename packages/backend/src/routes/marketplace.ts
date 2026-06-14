/**
 * Marketplace Intelligence API Routes
 * Provides endpoints for Amazon, Flipkart, and Google Trends intelligence
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { amazonIntelligenceService } from '../services/marketplace/amazonIntelligence';
import { flipkartIntelligenceService } from '../services/marketplace/flipkartIntelligence';
import { googleTrendsIntelligenceService } from '../services/marketplace/googleTrendsIntelligence';
import { marketplaceRefreshJob } from '../jobs/marketplaceRefresh';
import { logger } from '../utils/logger';

const router = Router();

// ==============================================
// AMAZON INTELLIGENCE
// ==============================================

/**
 * GET /api/marketplace/amazon/best-sellers
 * Get Amazon Best Sellers by category
 */
router.get('/amazon/best-sellers', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const categories = category ? [category] : undefined;
  const result = await amazonIntelligenceService.fetchBestSellers(categories);
  res.json({ success: true, data: result });
});

/**
 * GET /api/marketplace/amazon/movers-shakers
 * Get Amazon Movers & Shakers
 */
router.get('/amazon/movers-shakers', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const result = await amazonIntelligenceService.fetchMoversShakers(category ? [category] : undefined);
  res.json({ success: true, data: result });
});

/**
 * GET /api/marketplace/amazon/new-releases
 * Get Amazon New Releases
 */
router.get('/amazon/new-releases', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const result = await amazonIntelligenceService.fetchNewReleases(category ? [category] : undefined);
  res.json({ success: true, data: result });
});

/**
 * GET /api/marketplace/amazon/most-wished
 * Get Amazon Most Wished Products
 */
router.get('/amazon/most-wished', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const result = await amazonIntelligenceService.fetchMostWished(category ? [category] : undefined);
  res.json({ success: true, data: result });
});

/**
 * GET /api/marketplace/amazon/category/:category
 * Get category trends analysis
 */
router.get('/amazon/category/:category', async (req: Request, res: Response) => {
  const result = await amazonIntelligenceService.getCategoryTrends(req.params.category!);
  if (!result) {
    res.status(404).json({ success: false, error: 'Category not found' });
    return;
  }
  res.json({ success: true, data: result });
});

/**
 * GET /api/marketplace/amazon/trending
 * Get trending products
 */
router.get('/amazon/trending', async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const result = await amazonIntelligenceService.getTrendingProducts(limit);
  res.json({ success: true, data: result });
});

// ==============================================
// FLIPKART INTELLIGENCE
// ==============================================

/**
 * GET /api/marketplace/flipkart/best-sellers
 * Get Flipkart Best Sellers
 */
router.get('/flipkart/best-sellers', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const result = await flipkartIntelligenceService.fetchBestSellers(category ? [category] : undefined);
  res.json({ success: true, data: result });
});

/**
 * GET /api/marketplace/flipkart/trending
 * Get Flipkart Trending Products
 */
router.get('/flipkart/trending', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const result = await flipkartIntelligenceService.fetchTrendingProducts(category ? [category] : undefined);
  res.json({ success: true, data: result });
});

/**
 * GET /api/marketplace/flipkart/fast-growing
 * Get fast-growing categories on Flipkart
 */
router.get('/flipkart/fast-growing', async (_req: Request, res: Response) => {
  const result = await flipkartIntelligenceService.identifyFastGrowingCategories();
  res.json({ success: true, data: result });
});

// ==============================================
// GOOGLE TRENDS INTELLIGENCE
// ==============================================

/**
 * GET /api/marketplace/trends/rising
 * Get rising Google Trends for Nature's Crates categories
 */
router.get('/trends/rising', async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const result = await googleTrendsIntelligenceService.getRisingTrends(limit);
  res.json({ success: true, data: result });
});

/**
 * GET /api/marketplace/trends/seasonal
 * Get seasonal demand profiles
 */
router.get('/trends/seasonal', async (req: Request, res: Response) => {
  const keywords = req.query.keywords
    ? (req.query.keywords as string).split(',')
    : undefined;
  const result = await googleTrendsIntelligenceService.analyzeSeasonalDemand(keywords);
  res.json({ success: true, data: result });
});

/**
 * GET /api/marketplace/trends/forecast
 * Get trend forecasts
 */
router.get('/trends/forecast', async (req: Request, res: Response) => {
  const keywords = req.query.keywords
    ? (req.query.keywords as string).split(',')
    : undefined;
  const result = await googleTrendsIntelligenceService.generateForecasts(keywords);
  res.json({ success: true, data: result });
});

// ==============================================
// COMBINED / ADMIN
// ==============================================

/**
 * POST /api/marketplace/refresh
 * Trigger a full marketplace refresh (Amazon + Flipkart + Google Trends)
 */
router.post('/refresh', async (_req: Request, res: Response) => {
  // Run async - return immediately with job ID
  const jobId = `mkt_refresh_${Date.now()}`;
  
  // Start the refresh in background (non-blocking)
  marketplaceRefreshJob()
    .then((result) => {
      logger.info(`Marketplace refresh job ${jobId} completed`, result);
    })
    .catch((error) => {
      logger.error(`Marketplace refresh job ${jobId} failed`, { error });
    });

  res.json({
    success: true,
    data: {
      jobId,
      message: 'Marketplace refresh started. This may take several minutes.',
      status: 'running',
    },
  });
});

/**
 * POST /api/marketplace/amazon/scan
 * Run full Amazon scan
 */
router.post('/amazon/scan', async (_req: Request, res: Response) => {
  const result = await amazonIntelligenceService.runFullScan();
  res.json({ success: true, data: result });
});

/**
 * POST /api/marketplace/flipkart/scan
 * Run full Flipkart scan
 */
router.post('/flipkart/scan', async (_req: Request, res: Response) => {
  const result = await flipkartIntelligenceService.runFullScan();
  res.json({ success: true, data: result });
});

/**
 * POST /api/marketplace/trends/scan
 * Run full Google Trends scan
 */
router.post('/trends/scan', async (_req: Request, res: Response) => {
  const result = await googleTrendsIntelligenceService.runFullScan();
  res.json({ success: true, data: result });
});

export default router;

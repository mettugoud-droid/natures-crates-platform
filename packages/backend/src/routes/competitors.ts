/**
 * Competitor Intelligence API Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { competitorIntelligenceService } from '../services/competitorIntelligence';

const router = Router();

/**
 * GET /api/competitors
 * List all tracked competitors
 */
router.get('/', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const competitors = await competitorIntelligenceService.getCompetitors(category);
  res.json({ success: true, data: competitors });
});

/**
 * POST /api/competitors
 * Add a new competitor to track
 */
router.post('/', async (req: Request, res: Response) => {
  const data = z.object({
    name: z.string().min(1),
    brand: z.string().min(1),
    type: z.enum(['amazon_seller', 'flipkart_seller', 'd2c_brand', 'offline_brand']),
    website: z.string().optional(),
    marketplaces: z.array(z.string()),
    categories: z.array(z.string()),
  }).parse(req.body);

  const id = await competitorIntelligenceService.addCompetitor(data);
  res.json({ success: true, data: { id } });
});

/**
 * GET /api/competitors/pricing/:category
 * Get pricing analysis for a category
 */
router.get('/pricing/:category', async (req: Request, res: Response) => {
  const analysis = await competitorIntelligenceService.generatePricingAnalysis(req.params.category!);
  res.json({ success: true, data: analysis });
});

/**
 * GET /api/competitors/:id/reviews
 * Get review analysis for a competitor
 */
router.get('/:id/reviews', async (req: Request, res: Response) => {
  const analysis = await competitorIntelligenceService.generateReviewAnalysis(req.params.id!);
  if (!analysis) {
    res.status(404).json({ success: false, error: 'Competitor not found' });
    return;
  }
  res.json({ success: true, data: analysis });
});

/**
 * GET /api/competitors/comparison/:category
 * Get full competitor comparison for a category
 */
router.get('/comparison/:category', async (req: Request, res: Response) => {
  const comparison = await competitorIntelligenceService.generateComparison(req.params.category!);
  res.json({ success: true, data: comparison });
});

/**
 * POST /api/competitors/track-changes
 * Trigger competitor change tracking
 */
router.post('/track-changes', async (_req: Request, res: Response) => {
  const result = await competitorIntelligenceService.trackChanges();
  res.json({ success: true, data: result });
});

export default router;

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { whiteLabelDetectorService } from '../services/whiteLabelDetector';

const router = Router();

/**
 * GET /api/opportunities
 * Get top white-label opportunities
 */
router.get('/', async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const results = await whiteLabelDetectorService.getTopOpportunities(limit);
  res.json({ success: true, data: results });
});

/**
 * POST /api/opportunities/analyze
 * Analyze a specific product for white-label potential
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const input = z.object({
    productId: z.string().uuid(),
    productName: z.string(),
    category: z.string(),
    sellingPrice: z.number().positive(),
    estimatedMonthlySales: z.number().min(0),
    rating: z.number().min(0).max(5),
    reviewsCount: z.number().min(0),
    competitionLevel: z.number().min(0).max(100),
    growthRate: z.number(),
  }).parse(req.body);

  const result = await whiteLabelDetectorService.analyzeProduct(input);
  res.json({ success: true, data: result });
});

/**
 * POST /api/opportunities/batch-analyze
 * Run batch analysis on unanalyzed products
 */
router.post('/batch-analyze', async (req: Request, res: Response) => {
  const { limit } = z.object({ limit: z.number().min(1).max(500).optional() }).parse(req.body || {});
  const result = await whiteLabelDetectorService.batchAnalyze(limit);
  res.json({ success: true, data: result });
});

export default router;

/**
 * Bundle Recommendation Engine API Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { bundleEngineService } from '../services/bundleEngine';

const router = Router();

/**
 * GET /api/bundles
 * Get all bundles, optionally filtered by type
 */
router.get('/', async (req: Request, res: Response) => {
  const type = req.query.type as string | undefined;
  const bundles = await bundleEngineService.getBundles(type as any);
  res.json({ success: true, data: bundles });
});

/**
 * POST /api/bundles/generate
 * Auto-generate bundle recommendations
 */
router.post('/generate', async (_req: Request, res: Response) => {
  const recommendations = await bundleEngineService.generateBundleRecommendations();
  
  // Save generated bundles
  for (const bundle of recommendations) {
    await bundleEngineService.saveBundle(bundle);
  }

  res.json({
    success: true,
    data: {
      generated: recommendations.length,
      bundles: recommendations,
    },
  });
});

/**
 * POST /api/bundles/calculate
 * Calculate financials for a custom bundle
 */
router.post('/calculate', async (req: Request, res: Response) => {
  const { productIds, bundleType } = z.object({
    productIds: z.array(z.string().uuid()),
    bundleType: z.string(),
  }).parse(req.body);

  const financials = await bundleEngineService.calculateBundleFinancials(
    productIds,
    bundleType as any
  );

  res.json({ success: true, data: financials });
});

export default router;

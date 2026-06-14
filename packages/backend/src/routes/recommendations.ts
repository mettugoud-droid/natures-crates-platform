import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { recommendationEngineService } from '../ai/recommendationEngine';

const router = Router();

const categoryEnum = z.enum([
  'top_products_to_launch',
  'top_white_label_opportunities',
  'top_d2c_products',
  'top_corporate_gifting',
  'top_blinkit_products',
  'top_zepto_products',
  'top_repeat_purchase',
  'top_low_investment',
]);

/**
 * GET /api/recommendations/:category
 * Get AI recommendations by category
 */
router.get('/:category', async (req: Request, res: Response) => {
  const category = categoryEnum.parse(req.params.category);
  const results = await recommendationEngineService.getRecommendations(category);
  res.json({ success: true, data: results });
});

/**
 * POST /api/recommendations/generate
 * Generate fresh recommendations for a category
 */
router.post('/generate', async (req: Request, res: Response) => {
  const { category } = z.object({
    category: categoryEnum,
  }).parse(req.body);

  const results = await recommendationEngineService.generateRecommendations(category);
  res.json({ success: true, data: results });
});

/**
 * POST /api/recommendations/generate-all
 * Generate all recommendation lists
 */
router.post('/generate-all', async (_req: Request, res: Response) => {
  const results = await recommendationEngineService.generateAllRecommendations();
  res.json({ success: true, data: results });
});

export default router;

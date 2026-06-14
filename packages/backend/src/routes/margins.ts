import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { marginAnalyzerService } from '../services/marginAnalyzer';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const marginInputSchema = z.object({
  productId: z.string().uuid(),
  sellingPrice: z.number().positive(),
  productCost: z.number().min(0),
  manufacturingCost: z.number().min(0).optional(),
  packagingCost: z.number().min(0).optional(),
  brandingCost: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  marketingCostPercent: z.number().min(0).max(100).optional(),
  returnRate: z.number().min(0).max(100).optional(),
  category: z.string(),
  channel: z.string(),
  estimatedMonthlySales: z.number().min(0).optional(),
});

/**
 * POST /api/margins/calculate
 * Calculate margin for a product
 */
router.post('/calculate', async (req: Request, res: Response) => {
  const input = marginInputSchema.parse(req.body);
  const result = await marginAnalyzerService.calculateMargin(input);
  res.json({ success: true, data: result });
});

/**
 * GET /api/margins/:productId
 * Get existing margin analysis for a product
 */
router.get('/:productId', async (req: Request, res: Response) => {
  const result = await marginAnalyzerService.getMarginByProductId(req.params.productId!);
  
  if (!result) {
    throw new AppError('Margin analysis not found for this product', 404);
  }
  
  res.json({ success: true, data: result });
});

/**
 * GET /api/margins/high-margin/list
 * Get all products meeting margin targets
 */
router.get('/high-margin/list', async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const results = await marginAnalyzerService.getHighMarginProducts(limit);
  res.json({ success: true, data: results });
});

export default router;

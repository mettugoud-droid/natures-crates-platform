import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { manufacturerDiscoveryService } from '../services/manufacturerDiscovery';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/suppliers/search
 * Search for manufacturers
 */
router.post('/search', async (req: Request, res: Response) => {
  const params = z.object({
    product: z.string().min(1),
    category: z.string(),
    requirements: z.object({
      oemRequired: z.boolean().optional(),
      whiteLabelRequired: z.boolean().optional(),
      minTrustScore: z.number().min(0).max(100).optional(),
      state: z.string().optional(),
      certifications: z.array(z.string()).optional(),
    }).optional(),
  }).parse(req.body);

  const results = await manufacturerDiscoveryService.searchManufacturers(params);
  res.json({ success: true, data: results });
});

/**
 * GET /api/suppliers/product/:productId
 * Get suppliers for a specific product
 */
router.get('/product/:productId', async (req: Request, res: Response) => {
  const results = await manufacturerDiscoveryService.getSuppliersForProduct(req.params.productId!);
  res.json({ success: true, data: results });
});

/**
 * POST /api/suppliers/:id/verify
 * Trigger supplier verification
 */
router.post('/:id/verify', async (req: Request, res: Response) => {
  const result = await manufacturerDiscoveryService.verifySupplier(req.params.id!);
  res.json({ success: true, data: result });
});

/**
 * GET /api/suppliers/top
 * Get top verified suppliers
 */
router.get('/top', async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const results = await manufacturerDiscoveryService.getTopSuppliers(limit);
  res.json({ success: true, data: results });
});

export default router;

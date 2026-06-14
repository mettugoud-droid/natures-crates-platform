import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { productIntelligenceService } from '../services/productIntelligence';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Product search filters schema
const searchSchema = z.object({
  categories: z.array(z.string()).optional(),
  marketplaces: z.array(z.string()).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minRating: z.number().min(0).max(5).optional(),
  minOpportunityScore: z.number().min(0).max(100).optional(),
  isWhiteLabelOnly: z.boolean().optional(),
  sortBy: z.enum(['opportunity_score', 'margin', 'sales', 'growth', 'created_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
});

/**
 * GET /api/products
 * Search and filter products
 */
router.get('/', async (req: Request, res: Response) => {
  const filters = searchSchema.parse({
    categories: req.query.categories ? (req.query.categories as string).split(',') : undefined,
    marketplaces: req.query.marketplaces ? (req.query.marketplaces as string).split(',') : undefined,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
    minOpportunityScore: req.query.minOpportunityScore ? Number(req.query.minOpportunityScore) : undefined,
    isWhiteLabelOnly: req.query.isWhiteLabelOnly === 'true',
    sortBy: req.query.sortBy as any,
    sortOrder: req.query.sortOrder as any,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  const result = await productIntelligenceService.searchProducts(filters as any);
  
  res.json({
    success: true,
    data: result.products,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    },
  });
});

/**
 * GET /api/products/:id
 * Get product details with all analysis
 */
router.get('/:id', async (req: Request, res: Response) => {
  const product = await productIntelligenceService.getProductDetails(req.params.id!);
  
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  
  res.json({ success: true, data: product });
});

/**
 * POST /api/products/discover
 * Trigger product discovery for a category
 */
router.post('/discover', async (req: Request, res: Response) => {
  const { category } = z.object({
    category: z.string(),
  }).parse(req.body);

  const result = await productIntelligenceService.discoverTrendingProducts(category);
  
  res.json({ success: true, data: result });
});

/**
 * GET /api/products/dashboard/stats
 * Get dashboard summary statistics
 */
router.get('/dashboard/stats', async (_req: Request, res: Response) => {
  const stats = await productIntelligenceService.getDashboardStats();
  res.json({ success: true, data: stats });
});

export default router;

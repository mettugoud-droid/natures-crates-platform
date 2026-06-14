import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { complianceEngineService } from '../services/complianceEngine';
import { connectorRegistry } from '../connectors/registry';

const router = Router();

/**
 * GET /api/compliance/report
 * Get compliance report
 */
router.get('/report', async (req: Request, res: Response) => {
  const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';
  const report = await complianceEngineService.generateReport(period);
  res.json({ success: true, data: report });
});

/**
 * GET /api/compliance/sources
 * Get data source metrics and status
 */
router.get('/sources', async (_req: Request, res: Response) => {
  const metrics = await complianceEngineService.getSourceMetrics();
  res.json({ success: true, data: metrics });
});

/**
 * GET /api/compliance/connectors
 * Get connector status
 */
router.get('/connectors', async (_req: Request, res: Response) => {
  const status = connectorRegistry.getStatus();
  const health = await connectorRegistry.healthCheckAll();
  res.json({
    success: true,
    data: {
      connectors: status,
      health,
    },
  });
});

/**
 * POST /api/compliance/connectors/:name/enable
 */
router.post('/connectors/:name/enable', async (req: Request, res: Response) => {
  connectorRegistry.enable(req.params.name!);
  res.json({ success: true, message: `Connector ${req.params.name} enabled` });
});

/**
 * POST /api/compliance/connectors/:name/disable
 */
router.post('/connectors/:name/disable', async (req: Request, res: Response) => {
  connectorRegistry.disable(req.params.name!);
  res.json({ success: true, message: `Connector ${req.params.name} disabled` });
});

export default router;

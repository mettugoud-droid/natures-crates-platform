import { whiteLabelDetectorService } from '../services/whiteLabelDetector';
import { logger } from '../utils/logger';

/**
 * Daily White-Label Analysis Job
 * Analyzes products for white-label and private-label potential
 */
export async function whiteLabelAnalysisJob(): Promise<{
  processed: number;
  created: number;
  excellent: number;
  good: number;
}> {
  try {
    const result = await whiteLabelDetectorService.batchAnalyze(200);
    
    logger.info('White-label analysis completed', result);
    
    return {
      processed: result.analyzed,
      created: result.analyzed,
      excellent: result.excellent,
      good: result.good,
    };
  } catch (error) {
    logger.error('White-label analysis job failed', { error });
    throw error;
  }
}

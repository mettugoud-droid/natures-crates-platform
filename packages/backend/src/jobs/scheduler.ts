import cron from 'node-cron';
import { logger } from '../utils/logger';
import { dailyDiscoveryJob } from './dailyDiscovery';
import { marginCalculationJob } from './marginCalculation';
import { whiteLabelAnalysisJob } from './whiteLabelAnalysis';
import { reportGenerationJob } from './reportGeneration';
import { marketplaceRefreshJob } from './marketplaceRefresh';
import { query } from '../db/pool';

/**
 * Initialize all scheduled jobs
 * Daily Automation Workflow:
 * 1. Scan trending products
 * 2. Monitor marketplace growth
 * 3. Identify white-label opportunities
 * 4. Find suppliers
 * 5. Calculate margins
 * 6. Generate launch reports
 * 7. Identify new categories
 * 8. Track competitor changes
 * 9. Generate executive summary
 */
export function initializeJobs(): void {
  // Run marketplace intelligence refresh at 1:00 AM IST
  cron.schedule('30 19 * * *', async () => { // 19:30 UTC = 1:00 AM IST
    logger.info('Starting marketplace intelligence refresh');
    await runJob('marketplace_intelligence_refresh', marketplaceRefreshJob);
  });

  // Run product discovery every day at 2:00 AM IST
  cron.schedule('30 20 * * *', async () => { // 20:30 UTC = 2:00 AM IST
    logger.info('Starting daily product discovery job');
    await runJob('daily_product_discovery', dailyDiscoveryJob);
  });

  // Run margin calculations at 4:00 AM IST
  cron.schedule('30 22 * * *', async () => { // 22:30 UTC = 4:00 AM IST
    logger.info('Starting margin calculation job');
    await runJob('daily_margin_calculation', marginCalculationJob);
  });

  // Run white-label analysis at 5:00 AM IST
  cron.schedule('30 23 * * *', async () => { // 23:30 UTC = 5:00 AM IST
    logger.info('Starting white-label analysis job');
    await runJob('daily_white_label_analysis', whiteLabelAnalysisJob);
  });

  // Generate daily report at 7:00 AM IST
  cron.schedule('30 1 * * *', async () => { // 1:30 UTC = 7:00 AM IST
    logger.info('Starting report generation job');
    await runJob('daily_report_generation', reportGenerationJob);
  });

  logger.info('All scheduled jobs initialized');
}

/**
 * Run a job with execution logging
 */
async function runJob(jobName: string, jobFn: () => Promise<any>): Promise<void> {
  const startTime = Date.now();
  
  // Log job start
  const jobRecord = await query<{ id: string }>(
    `INSERT INTO job_executions (job_name, status, started_at)
     VALUES ($1, 'running', NOW()) RETURNING id`,
    [jobName]
  );
  const jobId = jobRecord[0]?.id;

  try {
    const result = await jobFn();
    const durationMs = Date.now() - startTime;

    // Log job completion
    await query(
      `UPDATE job_executions SET
        status = 'completed', completed_at = NOW(),
        duration_ms = $2, result = $3,
        records_processed = $4, records_created = $5
       WHERE id = $1`,
      [jobId, durationMs, JSON.stringify(result), 
       result?.processed || 0, result?.created || 0]
    );

    logger.info(`Job ${jobName} completed`, { durationMs, result });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await query(
      `UPDATE job_executions SET
        status = 'failed', completed_at = NOW(),
        duration_ms = $2, error_message = $3
       WHERE id = $1`,
      [jobId, durationMs, errorMessage]
    );

    logger.error(`Job ${jobName} failed`, { error: errorMessage, durationMs });
  }
}

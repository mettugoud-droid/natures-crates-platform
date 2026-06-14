import { query, queryOne } from '../db/pool';
import { logger } from '../utils/logger';

interface ComplianceLogEntry {
  dataSourceId?: string;
  sourceType: string;
  sourceName: string;
  collectionMethod: string;
  dataType: string;
  recordCount: number;
  rateLimitRespected: boolean;
  robotsTxtRespected: boolean;
  tosCompliant: boolean;
  jurisdiction: string;
  requestId: string;
  responseCode: number;
  processingTimeMs: number;
}

interface ComplianceReport {
  period: string;
  totalRequests: number;
  compliantRequests: number;
  complianceRate: number;
  violations: any[];
  sourceBreakdown: any[];
}

export class ComplianceEngineService {
  /**
   * Log a data collection event for audit purposes
   */
  async logCollection(entry: ComplianceLogEntry): Promise<void> {
    try {
      await query(
        `INSERT INTO compliance_records (
          data_source_id, source_type, source_name, collection_method,
          collection_timestamp, data_type, record_count,
          rate_limit_respected, robots_txt_respected, tos_compliant,
          jurisdiction, request_id, response_code, processing_time_ms
        ) VALUES ($1,$2,$3,$4,NOW(),$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          entry.dataSourceId || null,
          entry.sourceType,
          entry.sourceName,
          entry.collectionMethod,
          entry.dataType,
          entry.recordCount,
          entry.rateLimitRespected,
          entry.robotsTxtRespected,
          entry.tosCompliant,
          entry.jurisdiction,
          entry.requestId,
          entry.responseCode,
          entry.processingTimeMs,
        ]
      );
    } catch (error) {
      logger.error('Failed to log compliance record', { error, entry });
    }
  }

  /**
   * Generate compliance report for a given period
   */
  async generateReport(period: 'daily' | 'weekly' | 'monthly'): Promise<ComplianceReport> {
    const intervalMap = {
      daily: '1 day',
      weekly: '7 days',
      monthly: '30 days',
    };
    const interval = intervalMap[period];

    const [totalResult, compliantResult, violations, sourceBreakdown] = await Promise.all([
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM compliance_records
         WHERE collection_timestamp > NOW() - INTERVAL '${interval}'`
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM compliance_records
         WHERE collection_timestamp > NOW() - INTERVAL '${interval}'
         AND tos_compliant = TRUE AND rate_limit_respected = TRUE`
      ),
      query(
        `SELECT * FROM compliance_records
         WHERE collection_timestamp > NOW() - INTERVAL '${interval}'
         AND (tos_compliant = FALSE OR rate_limit_respected = FALSE OR robots_txt_respected = FALSE)
         ORDER BY collection_timestamp DESC
         LIMIT 100`
      ),
      query(
        `SELECT source_name, source_type,
          COUNT(*) as requests,
          COUNT(*) FILTER (WHERE tos_compliant = TRUE AND rate_limit_respected = TRUE) as compliant,
          COUNT(*) FILTER (WHERE tos_compliant = FALSE OR rate_limit_respected = FALSE) as violations
         FROM compliance_records
         WHERE collection_timestamp > NOW() - INTERVAL '${interval}'
         GROUP BY source_name, source_type
         ORDER BY requests DESC`
      ),
    ]);

    const totalRequests = parseInt(totalResult?.count || '0');
    const compliantRequests = parseInt(compliantResult?.count || '0');

    return {
      period,
      totalRequests,
      compliantRequests,
      complianceRate: totalRequests > 0 ? (compliantRequests / totalRequests) * 100 : 100,
      violations,
      sourceBreakdown,
    };
  }

  /**
   * Check if a request would violate rate limits
   */
  async checkRateLimit(sourceName: string): Promise<{
    allowed: boolean;
    remainingRequests: number;
    resetAt: Date;
  }> {
    const recentRequests = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM compliance_records
       WHERE source_name = $1
       AND collection_timestamp > NOW() - INTERVAL '1 minute'`,
      [sourceName]
    );

    const count = parseInt(recentRequests?.count || '0');
    const limit = 60; // Default rate limit per minute

    return {
      allowed: count < limit,
      remainingRequests: Math.max(0, limit - count),
      resetAt: new Date(Date.now() + 60000),
    };
  }

  /**
   * Get data source health and reliability metrics
   */
  async getSourceMetrics(): Promise<any[]> {
    return query(
      `SELECT
        ds.*,
        COUNT(cr.id) FILTER (WHERE cr.collection_timestamp > NOW() - INTERVAL '24 hours') as requests_24h,
        COUNT(cr.id) FILTER (WHERE cr.collection_timestamp > NOW() - INTERVAL '24 hours' AND cr.tos_compliant = FALSE) as violations_24h,
        AVG(cr.processing_time_ms) FILTER (WHERE cr.collection_timestamp > NOW() - INTERVAL '24 hours') as avg_response_time_24h
       FROM data_sources ds
       LEFT JOIN compliance_records cr ON cr.data_source_id = ds.id
       GROUP BY ds.id
       ORDER BY ds.tier, ds.name`
    );
  }

  /**
   * Update data source reliability score based on recent performance
   */
  async updateSourceReliability(sourceId: string): Promise<void> {
    const metrics = await queryOne<any>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE response_code >= 200 AND response_code < 300) as successful,
        AVG(processing_time_ms) as avg_time
       FROM compliance_records
       WHERE data_source_id = $1
       AND collection_timestamp > NOW() - INTERVAL '7 days'`,
      [sourceId]
    );

    if (!metrics || parseInt(metrics.total) === 0) return;

    const reliability = Math.round(
      (parseInt(metrics.successful) / parseInt(metrics.total)) * 100
    );

    await query(
      `UPDATE data_sources SET reliability_score = $2, avg_response_time_ms = $3 WHERE id = $1`,
      [sourceId, reliability, Math.round(parseFloat(metrics.avg_time || '0'))]
    );
  }
}

export const complianceEngineService = new ComplianceEngineService();

import Bottleneck from 'bottleneck';
import { logger } from '../utils/logger';

/**
 * Base Data Connector - Adapter Pattern
 * All data providers implement this interface for easy swapping
 */
export interface DataConnectorConfig {
  name: string;
  tier: 'tier_1_official_api' | 'tier_2_approved_provider' | 'tier_3_configurable_connector';
  provider: string;
  enabled: boolean;
  rateLimit: {
    maxConcurrent: number;
    minTime: number; // ms between requests
    reservoir?: number; // max requests per interval
    reservoirRefreshInterval?: number; // ms
  };
  retryConfig: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

export interface ConnectorResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  metadata: {
    source: string;
    tier: string;
    responseTimeMs: number;
    recordCount: number;
    timestamp: Date;
    requestId: string;
  };
}

export abstract class BaseDataConnector<TConfig extends DataConnectorConfig = DataConnectorConfig> {
  protected config: TConfig;
  protected limiter: Bottleneck;
  protected isEnabled: boolean;

  constructor(config: TConfig) {
    this.config = config;
    this.isEnabled = config.enabled;
    
    this.limiter = new Bottleneck({
      maxConcurrent: config.rateLimit.maxConcurrent,
      minTime: config.rateLimit.minTime,
      reservoir: config.rateLimit.reservoir,
      reservoirRefreshInterval: config.rateLimit.reservoirRefreshInterval,
      reservoirRefreshAmount: config.rateLimit.reservoir,
    });

    this.limiter.on('error', (error) => {
      logger.error(`Rate limiter error for ${config.name}`, { error: error.message });
    });
  }

  /**
   * Execute a request with rate limiting and retry logic
   */
  protected async execute<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<ConnectorResult<T>> {
    if (!this.isEnabled) {
      return {
        success: false,
        data: null,
        error: `Connector ${this.config.name} is disabled`,
        metadata: this.createMetadata(0, 0),
      };
    }

    const startTime = Date.now();
    const requestId = `${this.config.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const result = await this.limiter.schedule(async () => {
        return await this.withRetry(operation, context);
      });

      const responseTimeMs = Date.now() - startTime;
      
      logger.info(`Connector ${this.config.name} success`, {
        context,
        responseTimeMs,
        requestId,
      });

      return {
        success: true,
        data: result,
        metadata: this.createMetadata(responseTimeMs, Array.isArray(result) ? result.length : 1, requestId),
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Connector ${this.config.name} failed`, {
        context,
        error: errorMessage,
        responseTimeMs,
        requestId,
      });

      return {
        success: false,
        data: null,
        error: errorMessage,
        metadata: this.createMetadata(responseTimeMs, 0, requestId),
      };
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = this.config.retryConfig;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) break;

        const delay = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt),
          maxDelayMs
        );

        logger.warn(`Retry ${attempt + 1}/${maxRetries} for ${this.config.name}:${context}`, {
          delay,
          error: lastError.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error(`Max retries exceeded for ${context}`);
  }

  private createMetadata(responseTimeMs: number, recordCount: number, requestId?: string) {
    return {
      source: this.config.name,
      tier: this.config.tier,
      responseTimeMs,
      recordCount,
      timestamp: new Date(),
      requestId: requestId || 'unknown',
    };
  }

  // Abstract methods to be implemented by each connector
  abstract healthCheck(): Promise<boolean>;
  abstract getName(): string;
  abstract getTier(): string;

  enable(): void {
    this.isEnabled = true;
    logger.info(`Connector ${this.config.name} enabled`);
  }

  disable(): void {
    this.isEnabled = false;
    logger.info(`Connector ${this.config.name} disabled`);
  }

  getStatus(): { enabled: boolean; name: string; tier: string } {
    return {
      enabled: this.isEnabled,
      name: this.config.name,
      tier: this.config.tier,
    };
  }
}

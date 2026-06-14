import { BaseDataConnector } from './base';
import { AmazonPaApiConnector } from './tier1/amazonPaApi';
import { GoogleTrendsConnector } from './tier1/googleTrends';
import { BrightDataConnector } from './tier2/brightData';
import { KeepaConnector } from './tier2/keepa';
import { IndiaMartConnector } from './tier3/indiaMart';
import { TradeIndiaConnector } from './tier3/tradeIndia';
import { AlibabaConnector } from './tier3/alibaba';
import { MSMEDirectoryConnector } from './tier3/msmeDirectory';
import { logger } from '../utils/logger';

/**
 * Connector Registry - Central management of all data connectors
 * Supports adding, removing, enabling/disabling connectors at runtime
 */
export class ConnectorRegistry {
  private connectors: Map<string, BaseDataConnector> = new Map();
  private static instance: ConnectorRegistry;

  private constructor() {
    this.registerDefaultConnectors();
  }

  static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  private registerDefaultConnectors(): void {
    // Tier 1 - Official APIs
    this.register('amazon_pa_api', new AmazonPaApiConnector());
    this.register('google_trends', new GoogleTrendsConnector());

    // Tier 2 - Approved Providers
    this.register('bright_data', new BrightDataConnector());
    this.register('keepa', new KeepaConnector());

    // Tier 3 - Configurable Connectors
    this.register('indiamart', new IndiaMartConnector());
    this.register('trade_india', new TradeIndiaConnector());
    this.register('alibaba', new AlibabaConnector());
    this.register('msme_directory', new MSMEDirectoryConnector());

    logger.info(`Connector registry initialized with ${this.connectors.size} connectors`);
  }

  register(name: string, connector: BaseDataConnector): void {
    this.connectors.set(name, connector);
    logger.info(`Registered connector: ${name}`);
  }

  unregister(name: string): void {
    this.connectors.delete(name);
    logger.info(`Unregistered connector: ${name}`);
  }

  get<T extends BaseDataConnector>(name: string): T | null {
    return (this.connectors.get(name) as T) || null;
  }

  getAll(): Map<string, BaseDataConnector> {
    return this.connectors;
  }

  getByTier(tier: string): BaseDataConnector[] {
    return Array.from(this.connectors.values()).filter(
      (c) => c.getTier() === tier
    );
  }

  enable(name: string): void {
    const connector = this.connectors.get(name);
    if (connector) {
      connector.enable();
    }
  }

  disable(name: string): void {
    const connector = this.connectors.get(name);
    if (connector) {
      connector.disable();
    }
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, connector] of this.connectors) {
      try {
        results[name] = await connector.healthCheck();
      } catch {
        results[name] = false;
      }
    }

    return results;
  }

  getStatus(): { name: string; enabled: boolean; tier: string }[] {
    return Array.from(this.connectors.entries()).map(([_, connector]) => connector.getStatus());
  }
}

export const connectorRegistry = ConnectorRegistry.getInstance();

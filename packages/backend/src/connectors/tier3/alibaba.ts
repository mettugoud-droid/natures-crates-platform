/**
 * Alibaba Connector
 * Searches manufacturers and suppliers on Alibaba (India-focused)
 */

import axios from 'axios';
import { BaseDataConnector, DataConnectorConfig, ConnectorResult } from '../base';
import { logger } from '../../utils/logger';

export interface AlibabaSupplier {
  companyName: string;
  contactPerson: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  yearEstablished: number | null;
  employeeCount: string;
  annualTurnover: string;
  mainProducts: string[];
  certifications: string[];
  oemAvailable: boolean;
  odmAvailable: boolean;
  moq: number | null;
  leadTimeDays: number | null;
  supplierType: 'gold' | 'verified' | 'standard';
  responseRate: number;
  responseTime: string;
  transactionLevel: string;
  tradeAssurance: boolean;
  onTimeDeliveryRate: number;
  sourceUrl: string;
}

const ALIBABA_CONFIG: DataConnectorConfig = {
  name: 'Alibaba',
  tier: 'tier_3_configurable_connector',
  provider: 'Alibaba',
  enabled: true,
  rateLimit: {
    maxConcurrent: 2,
    minTime: 8000,
    reservoir: 100,
    reservoirRefreshInterval: 3600000,
  },
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 10000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
  },
};

export class AlibabaConnector extends BaseDataConnector {
  constructor() {
    super(ALIBABA_CONFIG);
  }

  /**
   * Search for India-based suppliers on Alibaba
   */
  async searchIndianSuppliers(params: {
    product: string;
    minOrderQty?: number;
    goldSupplierOnly?: boolean;
    tradeAssuranceOnly?: boolean;
    limit?: number;
  }): Promise<ConnectorResult<AlibabaSupplier[]>> {
    return this.execute(async () => {
      // Use Apify or Bright Data for Alibaba data
      const apifyKey = process.env.APIFY_API_KEY;
      
      if (apifyKey) {
        try {
          const response = await axios.post(
            'https://api.apify.com/v2/acts/alibaba-product-scraper/runs',
            {
              searchQuery: params.product,
              country: 'India',
              supplierCountry: 'IN',
              maxResults: params.limit || 20,
              goldSupplierOnly: params.goldSupplierOnly || false,
            },
            {
              headers: { Authorization: `Bearer ${apifyKey}` },
              timeout: 60000,
            }
          );

          const runId = response.data?.data?.id;
          if (runId) {
            await this.delay(20000);
            
            const results = await axios.get(
              `https://api.apify.com/v2/acts/alibaba-product-scraper/runs/${runId}/dataset/items`,
              { headers: { Authorization: `Bearer ${apifyKey}` } }
            );

            return (results.data || [])
              .filter((item: any) => item.supplier_country === 'India' || item.country === 'IN')
              .map((item: any) => this.mapSupplier(item));
          }
        } catch (error) {
          logger.warn('Alibaba Apify actor failed', { error });
        }
      }

      return [];
    }, `searchIndianSuppliers:${params.product}`);
  }

  /**
   * Search for OEM manufacturers
   */
  async findOEMManufacturers(product: string, options?: {
    minResponseRate?: number;
    tradeAssuranceRequired?: boolean;
  }): Promise<ConnectorResult<AlibabaSupplier[]>> {
    return this.execute(async () => {
      const result = await this.searchIndianSuppliers({
        product: `${product} OEM manufacturer`,
        goldSupplierOnly: true,
        tradeAssuranceOnly: options?.tradeAssuranceRequired,
        limit: 25,
      });

      let suppliers = result.data || [];

      // Filter by response rate
      if (options?.minResponseRate) {
        suppliers = suppliers.filter(s => s.responseRate >= (options.minResponseRate || 0));
      }

      // Prioritize OEM capable
      suppliers = suppliers.filter(s => s.oemAvailable);

      return suppliers;
    }, `findOEMManufacturers:${product}`);
  }

  private mapSupplier(raw: any): AlibabaSupplier {
    return {
      companyName: raw.supplier_name || raw.company_name || raw.name || '',
      contactPerson: raw.contact_person || raw.contact_name || '',
      city: raw.city || raw.supplier_city || '',
      state: raw.state || raw.supplier_state || '',
      country: raw.country || raw.supplier_country || 'India',
      phone: raw.phone || '',
      email: raw.email || '',
      website: raw.website || raw.alibaba_url || '',
      yearEstablished: raw.year_established ? parseInt(raw.year_established) : null,
      employeeCount: raw.employees || raw.total_employees || '',
      annualTurnover: raw.revenue || raw.annual_revenue || '',
      mainProducts: raw.main_products
        ? (Array.isArray(raw.main_products) ? raw.main_products : raw.main_products.split(',').map((s: string) => s.trim()))
        : [],
      certifications: raw.certifications
        ? (Array.isArray(raw.certifications) ? raw.certifications : raw.certifications.split(',').map((s: string) => s.trim()))
        : [],
      oemAvailable: raw.oem === true || raw.oem_service === 'Yes' || String(raw.customization || '').includes('OEM'),
      odmAvailable: raw.odm === true || String(raw.customization || '').includes('ODM'),
      moq: raw.min_order ? parseInt(String(raw.min_order).replace(/\D/g, '')) : null,
      leadTimeDays: raw.lead_time ? parseInt(String(raw.lead_time).replace(/\D/g, '')) : null,
      supplierType: raw.gold_supplier ? 'gold' : raw.verified ? 'verified' : 'standard',
      responseRate: parseFloat(raw.response_rate || '0'),
      responseTime: raw.response_time || '',
      transactionLevel: raw.transaction_level || '',
      tradeAssurance: raw.trade_assurance === true,
      onTimeDeliveryRate: parseFloat(raw.on_time_delivery || '0'),
      sourceUrl: raw.url || raw.supplier_url || '',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getName(): string {
    return 'Alibaba';
  }

  getTier(): string {
    return 'tier_3_configurable_connector';
  }
}

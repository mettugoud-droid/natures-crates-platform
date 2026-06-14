/**
 * TradeIndia Connector
 * Searches manufacturers and suppliers on TradeIndia directory
 */

import axios from 'axios';
import { BaseDataConnector, DataConnectorConfig, ConnectorResult } from '../base';
import { logger } from '../../utils/logger';

export interface TradeIndiaSupplier {
  companyName: string;
  contactPerson: string;
  designation: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  yearEstablished: number | null;
  employeeCount: string;
  annualTurnover: string;
  companyType: string; // manufacturer, exporter, supplier
  gstNumber: string;
  certifications: string[];
  products: string[];
  oemAvailable: boolean;
  whiteLabelAvailable: boolean;
  moq: number | null;
  leadTimeDays: number | null;
  exportCapable: boolean;
  paymentModes: string[];
  sourceUrl: string;
}

const TRADE_INDIA_CONFIG: DataConnectorConfig = {
  name: 'TradeIndia',
  tier: 'tier_3_configurable_connector',
  provider: 'TradeIndia',
  enabled: true,
  rateLimit: {
    maxConcurrent: 2,
    minTime: 5000,
    reservoir: 150,
    reservoirRefreshInterval: 3600000,
  },
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
};

export class TradeIndiaConnector extends BaseDataConnector {
  constructor() {
    super(TRADE_INDIA_CONFIG);
  }

  /**
   * Search suppliers on TradeIndia
   */
  async searchSuppliers(params: {
    product: string;
    city?: string;
    state?: string;
    companyType?: string;
    limit?: number;
  }): Promise<ConnectorResult<TradeIndiaSupplier[]>> {
    return this.execute(async () => {
      // Use Apify actor or Bright Data for TradeIndia data
      const apifyKey = process.env.APIFY_API_KEY;
      
      if (apifyKey) {
        const response = await axios.post(
          `https://api.apify.com/v2/acts/trade-india-scraper/runs`,
          {
            searchQuery: `${params.product} manufacturer`,
            maxResults: params.limit || 20,
            location: params.state || params.city || 'India',
          },
          {
            headers: { Authorization: `Bearer ${apifyKey}` },
            params: { token: apifyKey },
            timeout: 60000,
          }
        );

        // Wait for results (simplified - in production use webhooks)
        const runId = response.data?.data?.id;
        if (runId) {
          await this.delay(15000); // Wait for actor to finish
          
          const resultsResponse = await axios.get(
            `https://api.apify.com/v2/acts/trade-india-scraper/runs/${runId}/dataset/items`,
            { headers: { Authorization: `Bearer ${apifyKey}` } }
          );

          return (resultsResponse.data || []).map((item: any) => this.mapSupplier(item));
        }
      }

      // Fallback: Use Bright Data
      const brightDataKey = process.env.BRIGHT_DATA_API_KEY;
      if (brightDataKey) {
        const response = await axios.post(
          'https://api.brightdata.com/dca/trigger',
          {
            collector: process.env.BD_COLLECTOR_TRADEINDIA || 'c_tradeindia',
            queue_next: 1,
            input: {
              search_query: params.product,
              location: params.state || 'India',
              max_results: params.limit || 20,
            },
          },
          { headers: { Authorization: `Bearer ${brightDataKey}` } }
        );

        return [];
      }

      return [];
    }, `searchSuppliers:${params.product}`);
  }

  /**
   * Search manufacturers specifically
   */
  async findManufacturers(product: string, requirements: {
    oemRequired?: boolean;
    exportRequired?: boolean;
    state?: string;
    minTurnover?: string;
  }): Promise<ConnectorResult<TradeIndiaSupplier[]>> {
    return this.execute(async () => {
      const allSuppliers = await this.searchSuppliers({
        product,
        state: requirements.state,
        companyType: 'manufacturer',
        limit: 30,
      });

      let filtered = allSuppliers.data || [];

      if (requirements.oemRequired) {
        filtered = filtered.filter(s => s.oemAvailable);
      }
      if (requirements.exportRequired) {
        filtered = filtered.filter(s => s.exportCapable);
      }

      return filtered;
    }, `findManufacturers:${product}`);
  }

  private mapSupplier(raw: any): TradeIndiaSupplier {
    return {
      companyName: raw.company_name || raw.companyName || raw.name || '',
      contactPerson: raw.contact_person || raw.contactPerson || '',
      designation: raw.designation || '',
      city: raw.city || '',
      state: raw.state || '',
      country: raw.country || 'India',
      phone: raw.phone || raw.landline || '',
      mobile: raw.mobile || raw.phone_mobile || '',
      email: raw.email || '',
      website: raw.website || raw.company_website || '',
      yearEstablished: raw.year_established ? parseInt(raw.year_established) : null,
      employeeCount: raw.employees || raw.employee_count || '',
      annualTurnover: raw.turnover || raw.annual_turnover || '',
      companyType: raw.company_type || raw.nature_of_business || 'manufacturer',
      gstNumber: raw.gst || raw.gst_number || '',
      certifications: this.parseCertifications(raw),
      products: raw.products ? (Array.isArray(raw.products) ? raw.products : raw.products.split(',')) : [],
      oemAvailable: raw.oem === true || raw.oem_service === 'Yes' || false,
      whiteLabelAvailable: raw.white_label === true || raw.private_label === 'Yes' || false,
      moq: raw.moq ? parseInt(raw.moq) : null,
      leadTimeDays: raw.lead_time ? parseInt(raw.lead_time) : null,
      exportCapable: raw.export === true || raw.export_percentage > 0 || false,
      paymentModes: raw.payment_modes ? raw.payment_modes.split(',').map((s: string) => s.trim()) : [],
      sourceUrl: raw.url || raw.profile_url || '',
    };
  }

  private parseCertifications(raw: any): string[] {
    if (raw.certifications) {
      return Array.isArray(raw.certifications)
        ? raw.certifications
        : raw.certifications.split(',').map((s: string) => s.trim());
    }
    return [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getName(): string {
    return 'TradeIndia';
  }

  getTier(): string {
    return 'tier_3_configurable_connector';
  }
}

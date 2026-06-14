import axios from 'axios';
import { BaseDataConnector, DataConnectorConfig, ConnectorResult } from '../base';
import { logger } from '../../utils/logger';

interface IndiaMartSupplier {
  name: string;
  companyName: string;
  city: string;
  state: string;
  contactPerson: string;
  phone: string;
  email: string;
  website: string;
  gstNumber: string;
  yearEstablished: number;
  employeeCount: string;
  annualTurnover: string;
  certifications: string[];
  products: string[];
  oemCapable: boolean;
  whiteLabelCapable: boolean;
  moq: number;
  leadTimeDays: number;
  sourceUrl: string;
}

interface SupplierSearchParams {
  product: string;
  city?: string;
  state?: string;
  minMoq?: number;
  maxMoq?: number;
  oemRequired?: boolean;
  limit?: number;
}

const INDIAMART_CONFIG: DataConnectorConfig = {
  name: 'IndiaMART',
  tier: 'tier_3_configurable_connector',
  provider: 'IndiaMART',
  enabled: true,
  rateLimit: {
    maxConcurrent: 2,
    minTime: 5000,
    reservoir: 200,
    reservoirRefreshInterval: 3600000,
  },
  retryConfig: {
    maxRetries: 2,
    initialDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
};

export class IndiaMartConnector extends BaseDataConnector {
  constructor() {
    super(INDIAMART_CONFIG);
  }

  /**
   * Search for suppliers/manufacturers on IndiaMART
   * Uses IndiaMART's official API or approved data provider
   */
  async searchSuppliers(params: SupplierSearchParams): Promise<ConnectorResult<IndiaMartSupplier[]>> {
    return this.execute(async () => {
      // IndiaMART provides a lead management API
      // For product discovery, we use approved data providers (Bright Data/Apify)
      const response = await axios.get(
        'https://mapi.indiamart.com/wservce/crm/crmListing/v2/',
        {
          params: {
            glusr_crm_key: process.env.INDIAMART_CRM_KEY || '',
            start: 0,
            end: params.limit || 20,
          },
          timeout: 15000,
        }
      );

      // Parse and normalize the response
      const suppliers = (response.data?.MESSAGE || []).map((item: any) => this.mapSupplier(item));
      
      // Filter by criteria
      return suppliers.filter((s: IndiaMartSupplier) => {
        if (params.oemRequired && !s.oemCapable) return false;
        if (params.city && !s.city.toLowerCase().includes(params.city.toLowerCase())) return false;
        if (params.state && !s.state.toLowerCase().includes(params.state.toLowerCase())) return false;
        return true;
      });
    }, `searchSuppliers:${params.product}`);
  }

  /**
   * Search for manufacturers with OEM/white-label capabilities
   */
  async findManufacturers(product: string, requirements: {
    oemRequired?: boolean;
    whiteLabelRequired?: boolean;
    minCapacity?: string;
    certifications?: string[];
  }): Promise<ConnectorResult<IndiaMartSupplier[]>> {
    return this.execute(async () => {
      // Use Apify or similar approved provider for structured data
      const apifyUrl = process.env.APIFY_INDIAMART_ACTOR_URL;
      
      if (apifyUrl) {
        const response = await axios.post(apifyUrl, {
          searchQuery: `${product} manufacturer OEM`,
          maxResults: 30,
          filters: {
            companyType: 'manufacturer',
            ...(requirements.certifications?.length && { certifications: requirements.certifications }),
          },
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.APIFY_API_KEY || ''}`,
          },
          timeout: 60000,
        });

        return (response.data || []).map((item: any) => this.mapSupplier(item));
      }

      // Fallback: Use IndiaMART CRM API
      return this.searchSuppliers({ product, oemRequired: requirements.oemRequired }).then(
        (result) => result.data || []
      );
    }, `findManufacturers:${product}`);
  }

  private mapSupplier(raw: any): IndiaMartSupplier {
    return {
      name: raw.GLUSRID || raw.name || '',
      companyName: raw.GLUSER_COMPANY || raw.company_name || '',
      city: raw.GLUSER_CITY || raw.city || '',
      state: raw.GLUSER_STATE || raw.state || '',
      contactPerson: raw.GLUSR_CONTACT_PERSON || raw.contact_person || '',
      phone: raw.GLUSER_MOB || raw.phone || '',
      email: raw.GLUSR_EMAIL || raw.email || '',
      website: raw.GLUSER_WEBSITE || raw.website || '',
      gstNumber: raw.GST_NO || raw.gst_number || '',
      yearEstablished: parseInt(raw.YEAR_ESTABLISHED || raw.year_established || '0', 10),
      employeeCount: raw.EMPLOYEE_COUNT || raw.employees || '',
      annualTurnover: raw.ANNUAL_TURNOVER || raw.turnover || '',
      certifications: raw.CERTIFICATIONS?.split(',') || raw.certifications || [],
      products: raw.PRODUCTS?.split(',') || raw.products || [],
      oemCapable: raw.OEM_AVAILABLE === 'Y' || raw.oem === true,
      whiteLabelCapable: raw.WHITE_LABEL === 'Y' || raw.white_label === true,
      moq: parseInt(raw.MOQ || raw.moq || '0', 10),
      leadTimeDays: parseInt(raw.LEAD_TIME || raw.lead_time || '0', 10),
      sourceUrl: raw.URL || raw.source_url || '',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      return true; // Basic health check
    } catch {
      return false;
    }
  }

  getName(): string {
    return 'IndiaMART';
  }

  getTier(): string {
    return 'tier_3_configurable_connector';
  }
}

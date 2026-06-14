import { query, queryOne } from '../db/pool';
import { connectorRegistry } from '../connectors/registry';
import { calculateSupplierTrustScore } from '../../../shared/src/index';
import { logger } from '../utils/logger';

interface ManufacturerSearchParams {
  product: string;
  category: string;
  requirements?: {
    oemRequired?: boolean;
    whiteLabelRequired?: boolean;
    minTrustScore?: number;
    state?: string;
    certifications?: string[];
  };
}

interface ManufacturerResult {
  id: string;
  name: string;
  location: { city: string; state: string; country: string };
  moq: number | null;
  oemAvailable: boolean;
  whiteLabelAvailable: boolean;
  customPackagingAvailable: boolean;
  privateLabelAvailable: boolean;
  certifications: string[];
  leadTimeDays: number | null;
  contactDetails: { phone: string; email: string; website: string; contactPerson: string };
  trustScore: number;
}

export class ManufacturerDiscoveryService {
  /**
   * Search for manufacturers across all supplier directories
   */
  async searchManufacturers(params: ManufacturerSearchParams): Promise<ManufacturerResult[]> {
    const results: ManufacturerResult[] = [];

    // Search IndiaMART
    try {
      const indiamart = connectorRegistry.get<any>('indiamart');
      if (indiamart) {
        const iResult = await indiamart.findManufacturers(params.product, {
          oemRequired: params.requirements?.oemRequired,
          whiteLabelRequired: params.requirements?.whiteLabelRequired,
          certifications: params.requirements?.certifications,
        });

        if (iResult.success && iResult.data) {
          for (const supplier of iResult.data) {
            const saved = await this.saveSupplier(supplier, 'indiamart');
            if (saved) results.push(saved);
          }
        }
      }
    } catch (error) {
      logger.error('IndiaMART search failed', { error, product: params.product });
    }

    // Search existing database
    const dbResults = await this.searchDatabase(params);
    results.push(...dbResults);

    // Deduplicate and sort by trust score
    const unique = this.deduplicateSuppliers(results);
    return unique.sort((a, b) => b.trustScore - a.trustScore);
  }

  /**
   * Verify a supplier
   */
  async verifySupplier(supplierId: string): Promise<{
    trustScore: number;
    verificationStatus: string;
  }> {
    const supplier = await queryOne<any>(
      'SELECT * FROM suppliers WHERE id = $1',
      [supplierId]
    );

    if (!supplier) throw new Error('Supplier not found');

    // Calculate trust score based on available data
    const trustScore = calculateSupplierTrustScore({
      gstVerified: !!supplier.gst_number && supplier.gst_registered,
      businessAge: supplier.year_established
        ? new Date().getFullYear() - supplier.year_established
        : 0,
      certificationCount: (supplier.certifications || []).length,
      oemCapable: supplier.oem_available,
      responseRate: 70, // Default until we track this
      reviewScore: 3.5, // Default
    });

    const verificationStatus = trustScore >= 70 ? 'verified' :
      trustScore >= 40 ? 'partially_verified' : 'unverified';

    // Update supplier
    await query(
      `UPDATE suppliers SET trust_score = $2, verification_status = $3 WHERE id = $1`,
      [supplierId, trustScore, verificationStatus]
    );

    // Create verification record
    await query(
      `INSERT INTO supplier_verifications (
        supplier_id, gst_verified, business_legitimacy, manufacturing_capacity,
        export_capable, oem_capable, packaging_capable, overall_score, verified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        supplierId,
        !!supplier.gst_number,
        verificationStatus === 'verified' ? 'confirmed' : 'unverified',
        supplier.employee_count ? 'medium' : 'unknown',
        false,
        supplier.oem_available,
        supplier.custom_packaging_available,
        trustScore,
        'system_auto',
      ]
    );

    return { trustScore, verificationStatus };
  }

  /**
   * Get suppliers for a specific product
   */
  async getSuppliersForProduct(productId: string): Promise<ManufacturerResult[]> {
    const product = await queryOne<any>('SELECT * FROM products WHERE id = $1', [productId]);
    if (!product) return [];

    // Check if we have cached suppliers
    const existing = await query<any>(
      `SELECT s.* FROM suppliers s
       JOIN supplier_quotes sq ON sq.supplier_id = s.id
       WHERE sq.product_id = $1
       ORDER BY s.trust_score DESC`,
      [productId]
    );

    if (existing.length > 0) {
      return existing.map(this.mapDbSupplier);
    }

    // Search for new manufacturers
    return this.searchManufacturers({
      product: product.name,
      category: product.category,
      requirements: { oemRequired: true, whiteLabelRequired: true },
    });
  }

  /**
   * Get top verified suppliers
   */
  async getTopSuppliers(limit: number = 20): Promise<ManufacturerResult[]> {
    const results = await query<any>(
      `SELECT * FROM suppliers
       WHERE trust_score >= 50 AND verification_status IN ('verified', 'partially_verified')
       ORDER BY trust_score DESC
       LIMIT $1`,
      [limit]
    );

    return results.map(this.mapDbSupplier);
  }

  private async saveSupplier(raw: any, sourceDirectory: string): Promise<ManufacturerResult | null> {
    try {
      // Check for existing
      const existing = await queryOne<any>(
        `SELECT id FROM suppliers WHERE name = $1 AND city = $2`,
        [raw.companyName || raw.name, raw.city]
      );

      if (existing) {
        return this.mapDbSupplier(await queryOne<any>('SELECT * FROM suppliers WHERE id = $1', [existing.id]));
      }

      // Calculate initial trust score
      const trustScore = calculateSupplierTrustScore({
        gstVerified: !!raw.gstNumber,
        businessAge: raw.yearEstablished ? new Date().getFullYear() - raw.yearEstablished : 0,
        certificationCount: (raw.certifications || []).length,
        oemCapable: raw.oemCapable || false,
        responseRate: 50,
        reviewScore: 3,
      });

      const result = await queryOne<any>(
        `INSERT INTO suppliers (
          name, company_type, city, state, country,
          phone, email, website, contact_person,
          oem_available, white_label_available, private_label_available, custom_packaging_available,
          moq, lead_time_days, gst_registered, gst_number,
          certifications, year_established, employee_count, annual_turnover,
          trust_score, verification_status, source_directory, source_url, product_categories
        ) VALUES ($1,$2,$3,$4,'India',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
        RETURNING *`,
        [
          raw.companyName || raw.name, 'manufacturer', raw.city, raw.state,
          raw.phone, raw.email, raw.website, raw.contactPerson,
          raw.oemCapable || false, raw.whiteLabelCapable || false,
          raw.whiteLabelCapable || false, true,
          raw.moq || null, raw.leadTimeDays || null,
          !!raw.gstNumber, raw.gstNumber || null,
          raw.certifications || [], raw.yearEstablished || null,
          raw.employeeCount || null, raw.annualTurnover || null,
          trustScore, trustScore >= 50 ? 'partially_verified' : 'unverified',
          sourceDirectory, raw.sourceUrl || '', raw.products || [],
        ]
      );

      return result ? this.mapDbSupplier(result) : null;
    } catch (error) {
      logger.error('Failed to save supplier', { error, raw });
      return null;
    }
  }

  private async searchDatabase(params: ManufacturerSearchParams): Promise<ManufacturerResult[]> {
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIdx = 0;

    if (params.requirements?.oemRequired) {
      whereClause += ' AND oem_available = TRUE';
    }
    if (params.requirements?.whiteLabelRequired) {
      whereClause += ' AND white_label_available = TRUE';
    }
    if (params.requirements?.minTrustScore) {
      paramIdx++;
      whereClause += ` AND trust_score >= $${paramIdx}`;
      queryParams.push(params.requirements.minTrustScore);
    }
    if (params.requirements?.state) {
      paramIdx++;
      whereClause += ` AND state ILIKE $${paramIdx}`;
      queryParams.push(`%${params.requirements.state}%`);
    }

    // Search by product categories
    paramIdx++;
    whereClause += ` AND ($${paramIdx} = ANY(product_categories) OR name ILIKE $${paramIdx + 1})`;
    queryParams.push(params.category);
    paramIdx++;
    queryParams.push(`%${params.product.split(' ').slice(0, 2).join('%')}%`);

    const results = await query<any>(
      `SELECT * FROM suppliers ${whereClause} ORDER BY trust_score DESC LIMIT 30`,
      queryParams
    );

    return results.map(this.mapDbSupplier);
  }

  private mapDbSupplier(row: any): ManufacturerResult {
    return {
      id: row.id,
      name: row.name,
      location: { city: row.city || '', state: row.state || '', country: row.country || 'India' },
      moq: row.moq,
      oemAvailable: row.oem_available,
      whiteLabelAvailable: row.white_label_available,
      customPackagingAvailable: row.custom_packaging_available,
      privateLabelAvailable: row.private_label_available,
      certifications: row.certifications || [],
      leadTimeDays: row.lead_time_days,
      contactDetails: {
        phone: row.phone || '',
        email: row.email || '',
        website: row.website || '',
        contactPerson: row.contact_person || '',
      },
      trustScore: row.trust_score || 0,
    };
  }

  private deduplicateSuppliers(suppliers: ManufacturerResult[]): ManufacturerResult[] {
    const seen = new Set<string>();
    return suppliers.filter((s) => {
      const key = `${s.name.toLowerCase()}-${s.location.city.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const manufacturerDiscoveryService = new ManufacturerDiscoveryService();

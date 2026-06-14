import { query, queryOne } from '../db/pool';
import { logger } from '../utils/logger';
import { GST_RATES, MARKETPLACE_FEE_RATES, MARGIN_TARGETS } from '../../../shared/src/index';

interface MarginInput {
  productId: string;
  sellingPrice: number;
  productCost: number;
  manufacturingCost?: number;
  packagingCost?: number;
  brandingCost?: number;
  shippingCost?: number;
  marketingCostPercent?: number;
  returnRate?: number;
  category: string;
  channel: string;
  estimatedMonthlySales?: number;
}

interface MarginResult {
  id: string;
  sellingPrice: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  netProfit: number;
  netMarginPercent: number;
  roi: number;
  breakEvenUnits: number;
  recommendedSellingPrice: number;
  meetsGrossMarginTarget: boolean;
  meetsNetMarginTarget: boolean;
  costBreakdown: {
    productCost: number;
    manufacturingCost: number;
    packagingCost: number;
    brandingCost: number;
    shippingCost: number;
    gst: number;
    marketingCost: number;
    returnCost: number;
    marketplaceFees: number;
  };
}

export class MarginAnalyzerService {
  /**
   * Calculate comprehensive margin analysis for a product
   */
  async calculateMargin(input: MarginInput): Promise<MarginResult> {
    const {
      sellingPrice,
      productCost,
      manufacturingCost = 0,
      packagingCost = sellingPrice * 0.03, // Default 3% of SP
      brandingCost = sellingPrice * 0.02, // Default 2% of SP
      shippingCost = 40, // Default flat shipping
      marketingCostPercent = 10,
      returnRate = 5,
      category,
      channel,
      estimatedMonthlySales = 100,
    } = input;

    // GST Calculation
    const gstRate = GST_RATES[category] || 18;
    const gst = (sellingPrice * gstRate) / (100 + gstRate); // GST included in SP

    // Marketplace Fees
    const marketplaceFeeRate = MARKETPLACE_FEE_RATES[channel] || 15;
    const marketplaceFees = (sellingPrice * marketplaceFeeRate) / 100;

    // Marketing Cost
    const marketingCost = (sellingPrice * marketingCostPercent) / 100;

    // Return Cost (% of sales * full product cost)
    const returnCost = (returnRate / 100) * (productCost + shippingCost);

    // Total Cost
    const totalCost =
      productCost +
      manufacturingCost +
      packagingCost +
      brandingCost +
      shippingCost +
      gst +
      marketingCost +
      returnCost +
      marketplaceFees;

    // Gross Profit (before marketing & returns)
    const grossProfit = sellingPrice - (productCost + manufacturingCost + packagingCost + shippingCost + gst + marketplaceFees);
    const grossMarginPercent = (grossProfit / sellingPrice) * 100;

    // Net Profit
    const netProfit = sellingPrice - totalCost;
    const netMarginPercent = (netProfit / sellingPrice) * 100;

    // ROI
    const investment = productCost + manufacturingCost + packagingCost + brandingCost;
    const roi = investment > 0 ? ((netProfit * estimatedMonthlySales) / (investment * estimatedMonthlySales)) * 100 : 0;

    // Break-even Units
    const fixedCosts = brandingCost * estimatedMonthlySales; // One-time branding amortized
    const variableMarginPerUnit = netProfit;
    const breakEvenUnits = variableMarginPerUnit > 0 ? Math.ceil(fixedCosts / variableMarginPerUnit) : 999999;

    // Recommended Selling Price (to achieve target margins)
    const recommendedSellingPrice = this.calculateRecommendedPrice(
      productCost + manufacturingCost,
      packagingCost,
      shippingCost,
      gstRate,
      marketplaceFeeRate,
      marketingCostPercent,
      returnRate
    );

    // Check targets
    const meetsGrossMarginTarget = grossMarginPercent >= MARGIN_TARGETS.minGrossMargin;
    const meetsNetMarginTarget = netMarginPercent >= MARGIN_TARGETS.minNetMargin;

    // Store in DB
    const result = await queryOne<{ id: string }>(
      `INSERT INTO margin_analyses (
        product_id, selling_price,
        product_cost, manufacturing_cost, packaging_cost, branding_cost,
        shipping_cost, gst, gst_rate, marketing_cost, return_cost,
        marketplace_fees, marketplace_fee_rate,
        total_cost, gross_profit, gross_margin_percent,
        net_profit, net_margin_percent, roi, break_even_units,
        recommended_selling_price, meets_gross_margin_target, meets_net_margin_target,
        assumptions, confidence
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING id`,
      [
        input.productId, sellingPrice,
        productCost, manufacturingCost, packagingCost, brandingCost,
        shippingCost, gst, gstRate, marketingCost, returnCost,
        marketplaceFees, marketplaceFeeRate,
        totalCost, grossProfit, grossMarginPercent,
        netProfit, netMarginPercent, roi, breakEvenUnits,
        recommendedSellingPrice, meetsGrossMarginTarget, meetsNetMarginTarget,
        JSON.stringify({ estimatedMonthlySales, returnRate, marketingCostPercent, channel }),
        'medium',
      ]
    );

    logger.info('Margin analysis calculated', {
      productId: input.productId,
      grossMargin: grossMarginPercent.toFixed(1),
      netMargin: netMarginPercent.toFixed(1),
      meetsTargets: meetsGrossMarginTarget && meetsNetMarginTarget,
    });

    return {
      id: result?.id || '',
      sellingPrice,
      totalCost,
      grossProfit,
      grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
      netProfit,
      netMarginPercent: Math.round(netMarginPercent * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      breakEvenUnits,
      recommendedSellingPrice,
      meetsGrossMarginTarget,
      meetsNetMarginTarget,
      costBreakdown: {
        productCost,
        manufacturingCost,
        packagingCost,
        brandingCost,
        shippingCost,
        gst,
        marketingCost,
        returnCost,
        marketplaceFees,
      },
    };
  }

  /**
   * Calculate recommended selling price to achieve target margins
   */
  private calculateRecommendedPrice(
    baseCost: number,
    packagingCost: number,
    shippingCost: number,
    gstRate: number,
    marketplaceFeeRate: number,
    marketingPercent: number,
    returnRate: number
  ): number {
    // Target: Net Margin of 25% (slightly above the 20% minimum)
    const targetNetMargin = 0.25;
    
    // SP = (baseCost + packaging + shipping + returnCost) / (1 - GST/(100+GST) - mktplaceFee% - marketing% - targetMargin)
    const fixedCosts = baseCost + packagingCost + shippingCost;
    const returnCostEstimate = (returnRate / 100) * (baseCost + shippingCost);
    const totalFixedCosts = fixedCosts + returnCostEstimate;
    
    const variableRateDeductions =
      gstRate / (100 + gstRate) +
      marketplaceFeeRate / 100 +
      marketingPercent / 100 +
      targetNetMargin;
    
    const denominator = 1 - variableRateDeductions;
    
    if (denominator <= 0) {
      // Cannot achieve target margin with these costs
      return baseCost * 4; // Fallback: 4x cost
    }
    
    return Math.ceil(totalFixedCosts / denominator);
  }

  /**
   * Get margin analysis for a product
   */
  async getMarginByProductId(productId: string): Promise<MarginResult | null> {
    const row = await queryOne<any>(
      `SELECT * FROM margin_analyses WHERE product_id = $1 ORDER BY calculated_at DESC LIMIT 1`,
      [productId]
    );

    if (!row) return null;

    return {
      id: row.id,
      sellingPrice: parseFloat(row.selling_price),
      totalCost: parseFloat(row.total_cost),
      grossProfit: parseFloat(row.gross_profit),
      grossMarginPercent: parseFloat(row.gross_margin_percent),
      netProfit: parseFloat(row.net_profit),
      netMarginPercent: parseFloat(row.net_margin_percent),
      roi: parseFloat(row.roi),
      breakEvenUnits: row.break_even_units,
      recommendedSellingPrice: parseFloat(row.recommended_selling_price || '0'),
      meetsGrossMarginTarget: row.meets_gross_margin_target,
      meetsNetMarginTarget: row.meets_net_margin_target,
      costBreakdown: {
        productCost: parseFloat(row.product_cost),
        manufacturingCost: parseFloat(row.manufacturing_cost),
        packagingCost: parseFloat(row.packaging_cost),
        brandingCost: parseFloat(row.branding_cost),
        shippingCost: parseFloat(row.shipping_cost),
        gst: parseFloat(row.gst),
        marketingCost: parseFloat(row.marketing_cost),
        returnCost: parseFloat(row.return_cost),
        marketplaceFees: parseFloat(row.marketplace_fees),
      },
    };
  }

  /**
   * Get all high-margin products
   */
  async getHighMarginProducts(limit: number = 50): Promise<any[]> {
    return query(
      `SELECT ma.*, p.name as product_name, p.category, p.brand
       FROM margin_analyses ma
       JOIN products p ON p.id = ma.product_id
       WHERE ma.meets_gross_margin_target = TRUE AND ma.meets_net_margin_target = TRUE
       ORDER BY ma.net_margin_percent DESC
       LIMIT $1`,
      [limit]
    );
  }
}

export const marginAnalyzerService = new MarginAnalyzerService();

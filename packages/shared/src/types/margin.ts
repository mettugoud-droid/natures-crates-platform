// Margin analysis types

export interface MarginAnalysis {
  id: string;
  productId: string;
  
  // Revenue
  sellingPrice: number;
  
  // Costs
  productCost: number;
  manufacturingCost: number;
  packagingCost: number;
  brandingCost: number;
  shippingCost: number;
  gst: number;
  gstRate: number; // percentage
  marketingCost: number;
  returnCost: number;
  marketplaceFees: number;
  marketplaceFeeRate: number; // percentage
  
  // Calculated Margins
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  netProfit: number;
  netMarginPercent: number;
  roi: number;
  breakEvenUnits: number;
  recommendedSellingPrice: number;
  
  // Flags
  meetsGrossMarginTarget: boolean; // > 40%
  meetsNetMarginTarget: boolean; // > 20%
  
  // Metadata
  assumptions: MarginAssumptions;
  calculatedAt: Date;
  confidence: 'high' | 'medium' | 'low';
}

export interface MarginAssumptions {
  estimatedMonthlySales: number;
  returnRate: number; // percentage
  marketingSpendPercent: number;
  shippingModel: 'self_ship' | 'fba' | 'marketplace_fulfilled';
  packagingType: 'basic' | 'premium' | 'gift';
  channel: string;
}

export interface MarginTarget {
  minGrossMargin: number; // default 40%
  minNetMargin: number; // default 20%
  minRoi: number;
  maxBreakEvenMonths: number;
}

export interface PricingRecommendation {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  minPrice: number;
  maxPrice: number;
  priceElasticity: 'high' | 'medium' | 'low';
  competitorPrices: {
    brand: string;
    price: number;
    marketplace: string;
  }[];
}

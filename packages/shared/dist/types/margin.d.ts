export interface MarginAnalysis {
    id: string;
    productId: string;
    sellingPrice: number;
    productCost: number;
    manufacturingCost: number;
    packagingCost: number;
    brandingCost: number;
    shippingCost: number;
    gst: number;
    gstRate: number;
    marketingCost: number;
    returnCost: number;
    marketplaceFees: number;
    marketplaceFeeRate: number;
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
    assumptions: MarginAssumptions;
    calculatedAt: Date;
    confidence: 'high' | 'medium' | 'low';
}
export interface MarginAssumptions {
    estimatedMonthlySales: number;
    returnRate: number;
    marketingSpendPercent: number;
    shippingModel: 'self_ship' | 'fba' | 'marketplace_fulfilled';
    packagingType: 'basic' | 'premium' | 'gift';
    channel: string;
}
export interface MarginTarget {
    minGrossMargin: number;
    minNetMargin: number;
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
//# sourceMappingURL=margin.d.ts.map
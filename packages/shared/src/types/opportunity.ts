// White-label opportunity and recommendation types

export interface WhiteLabelOpportunity {
  id: string;
  productId: string;
  
  // Scoring Factors (each 0-100)
  demandScore: number;
  competitionScore: number;
  marginScore: number;
  manufacturingEaseScore: number;
  repeatPurchaseScore: number;
  brandingPotentialScore: number;
  regulatoryComplexityScore: number;
  
  // Overall Score
  opportunityScore: number; // 0-100
  classification: OpportunityClassification;
  
  // Type
  opportunityType: OpportunityType[];
  
  // Analysis
  reasoning: string;
  risks: string[];
  improvements: string[];
  brandingOpportunities: string[];
  expectedMonthlyRevenue: number | null;
  
  // Metadata
  analyzedAt: Date;
  aiModel: string;
  confidence: 'high' | 'medium' | 'low';
}

export type OpportunityClassification =
  | 'excellent' // 80-100
  | 'good' // 60-79
  | 'moderate' // 40-59
  | 'avoid'; // 0-39

export type OpportunityType =
  | 'white_label'
  | 'oem_manufacturing'
  | 'private_label'
  | 'contract_manufacturing';

export interface LaunchRecommendation {
  id: string;
  productId: string;
  opportunityId: string;
  
  // Decision
  shouldLaunch: boolean;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedProfit: number;
  
  // Details
  recommendedChannels: string[];
  recommendedPrice: number;
  estimatedInvestment: number;
  estimatedTimeToMarket: number; // days
  
  // Priority
  priority: 'urgent' | 'high' | 'medium' | 'low';
  
  generatedAt: Date;
}

export interface ProductBundle {
  id: string;
  name: string;
  description: string;
  type: BundleType;
  products: BundleProduct[];
  
  // Financials
  totalCost: number;
  recommendedPrice: number;
  bundleMargin: number;
  bundleRoi: number;
  aovIncrease: number;
  
  // Metadata
  targetChannel: string[];
  seasonality: string[];
  createdAt: Date;
}

export type BundleType =
  | 'healthy_snack_box'
  | 'premium_dry_fruit_combo'
  | 'corporate_gift_hamper'
  | 'protein_power_pack'
  | 'family_nutrition_pack'
  | 'festival_special'
  | 'custom';

export interface BundleProduct {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface AIRecommendationList {
  category: RecommendationCategory;
  products: RankedProduct[];
  generatedAt: Date;
  validUntil: Date;
}

export type RecommendationCategory =
  | 'top_products_to_launch'
  | 'top_white_label_opportunities'
  | 'top_d2c_products'
  | 'top_corporate_gifting'
  | 'top_blinkit_products'
  | 'top_zepto_products'
  | 'top_repeat_purchase'
  | 'top_low_investment';

export interface RankedProduct {
  rank: number;
  productId: string;
  score: number;
  reasoning: string;
  keyMetrics: {
    demand: number;
    margin: number;
    competition: number;
    supplierAvailability: number;
    repeatPurchase: number;
  };
}

// Competitor intelligence types

export interface Competitor {
  id: string;
  name: string;
  brand: string;
  type: 'amazon_seller' | 'flipkart_seller' | 'd2c_brand' | 'offline_brand';
  website: string | null;
  marketplaces: string[];
  categories: string[];
  estimatedRevenue: string | null;
  
  // Analysis
  pricingStrategy: 'premium' | 'mid_range' | 'budget' | 'value';
  strengths: string[];
  weaknesses: string[];
  uniqueSellingPoints: string[];
  
  // Tracking
  lastAnalyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitorProduct {
  competitorId: string;
  productId: string;
  competitorPrice: number;
  competitorRating: number;
  competitorReviews: number;
  competitorSales: number | null;
  lastChecked: Date;
}

export interface CompetitorAnalysis {
  competitorId: string;
  pricingAnalysis: PricingComparison[];
  reviewAnalysis: ReviewInsights;
  packagingAnalysis: string;
  uspAnalysis: string[];
  opportunityGaps: string[];
  analyzedAt: Date;
}

export interface PricingComparison {
  productCategory: string;
  ourPrice: number | null;
  competitorPrice: number;
  priceDifference: number;
  priceAdvantage: 'us' | 'competitor' | 'similar';
}

export interface ReviewInsights {
  averageRating: number;
  totalReviews: number;
  topComplaints: string[];
  topPraises: string[];
  sentimentScore: number; // -1 to 1
}

export interface MarketRisk {
  id: string;
  productId: string;
  riskType: RiskType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  mitigation: string | null;
  classification: 'safe_to_launch' | 'review_required' | 'avoid';
  identifiedAt: Date;
}

export type RiskType =
  | 'trademark_protected'
  | 'patent_sensitive'
  | 'restricted_product'
  | 'certification_required'
  | 'compliance_risk'
  | 'legal_risk';

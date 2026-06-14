export interface Product {
    id: string;
    name: string;
    category: ProductCategory;
    subcategory: string;
    brand: string | null;
    description: string;
    sellingPrice: number;
    costPrice: number | null;
    currency: 'INR';
    images: string[];
    sourceMarketplace: Marketplace;
    sourceUrl: string;
    asin?: string;
    flipkartPid?: string;
    rating: number | null;
    reviewsCount: number | null;
    estimatedMonthlySales: number | null;
    growthRate: number | null;
    competitionScore: number | null;
    opportunityScore: number | null;
    confidenceScore: number;
    freshnessScore: number;
    sourceReliabilityScore: number;
    isWhiteLabelCandidate: boolean;
    isPrivateLabelCandidate: boolean;
    tags: string[];
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    lastScannedAt: Date;
}
export type ProductCategory = 'dry_fruits' | 'nuts' | 'seeds' | 'healthy_snacks' | 'trail_mixes' | 'gift_boxes' | 'functional_foods' | 'gourmet_foods' | 'imported_foods' | 'healthy_foods' | 'wellness_products' | 'fmcg_products' | 'kitchen_essentials' | 'corporate_gifting' | 'premium_daily_essentials';
export type Marketplace = 'amazon_india' | 'flipkart' | 'blinkit' | 'zepto' | 'instamart' | 'indiamart' | 'trade_india' | 'd2c_website' | 'other';
export type SalesChannel = 'd2c_website' | 'amazon_india' | 'flipkart' | 'blinkit' | 'zepto' | 'instamart' | 'corporate_orders' | 'offline_distribution';
export interface ProductSearchFilters {
    categories?: ProductCategory[];
    marketplaces?: Marketplace[];
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    minOpportunityScore?: number;
    minMargin?: number;
    isWhiteLabelOnly?: boolean;
    sortBy?: 'opportunity_score' | 'margin' | 'sales' | 'growth' | 'created_at';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}
export interface ProductTrend {
    productId: string;
    date: Date;
    price: number;
    sales: number;
    ranking: number;
    reviewsCount: number;
    rating: number;
}
//# sourceMappingURL=product.d.ts.map
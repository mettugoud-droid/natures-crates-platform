import type { OpportunityClassification } from '../types/opportunity';
/**
 * Classify opportunity based on score
 */
export declare function classifyOpportunity(score: number): OpportunityClassification;
/**
 * Calculate weighted opportunity score from individual factors
 */
export declare function calculateOpportunityScore(factors: {
    demand: number;
    competition: number;
    margin: number;
    manufacturingEase: number;
    repeatPurchase: number;
    brandingPotential: number;
    regulatoryComplexity: number;
}): number;
/**
 * Check if margin meets targets
 */
export declare function meetsMarginTargets(grossMargin: number, netMargin: number): {
    meetsGross: boolean;
    meetsNet: boolean;
    meetsBoth: boolean;
};
/**
 * Calculate supplier trust score
 */
export declare function calculateSupplierTrustScore(factors: {
    gstVerified: boolean;
    businessAge: number;
    certificationCount: number;
    oemCapable: boolean;
    responseRate: number;
    reviewScore: number;
}): number;
/**
 * Calculate data freshness score based on age
 */
export declare function calculateFreshnessScore(lastUpdated: Date): number;
//# sourceMappingURL=scoring.d.ts.map
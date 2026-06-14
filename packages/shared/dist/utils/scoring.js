"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyOpportunity = classifyOpportunity;
exports.calculateOpportunityScore = calculateOpportunityScore;
exports.meetsMarginTargets = meetsMarginTargets;
exports.calculateSupplierTrustScore = calculateSupplierTrustScore;
exports.calculateFreshnessScore = calculateFreshnessScore;
const categories_1 = require("../constants/categories");
/**
 * Classify opportunity based on score
 */
function classifyOpportunity(score) {
    if (score >= categories_1.OPPORTUNITY_THRESHOLDS.excellent)
        return 'excellent';
    if (score >= categories_1.OPPORTUNITY_THRESHOLDS.good)
        return 'good';
    if (score >= categories_1.OPPORTUNITY_THRESHOLDS.moderate)
        return 'moderate';
    return 'avoid';
}
/**
 * Calculate weighted opportunity score from individual factors
 */
function calculateOpportunityScore(factors) {
    const weights = {
        demand: 0.20,
        competition: 0.15,
        margin: 0.25,
        manufacturingEase: 0.10,
        repeatPurchase: 0.15,
        brandingPotential: 0.10,
        regulatoryComplexity: 0.05,
    };
    const score = factors.demand * weights.demand +
        (100 - factors.competition) * weights.competition + // Lower competition = better
        factors.margin * weights.margin +
        factors.manufacturingEase * weights.manufacturingEase +
        factors.repeatPurchase * weights.repeatPurchase +
        factors.brandingPotential * weights.brandingPotential +
        (100 - factors.regulatoryComplexity) * weights.regulatoryComplexity; // Lower complexity = better
    return Math.round(Math.min(100, Math.max(0, score)));
}
/**
 * Check if margin meets targets
 */
function meetsMarginTargets(grossMargin, netMargin) {
    const meetsGross = grossMargin >= categories_1.MARGIN_TARGETS.minGrossMargin;
    const meetsNet = netMargin >= categories_1.MARGIN_TARGETS.minNetMargin;
    return { meetsGross, meetsNet, meetsBoth: meetsGross && meetsNet };
}
/**
 * Calculate supplier trust score
 */
function calculateSupplierTrustScore(factors) {
    let score = 0;
    if (factors.gstVerified)
        score += 25;
    if (factors.businessAge >= 10)
        score += 15;
    else if (factors.businessAge >= 5)
        score += 10;
    else if (factors.businessAge >= 2)
        score += 5;
    score += Math.min(20, factors.certificationCount * 5);
    if (factors.oemCapable)
        score += 10;
    score += (factors.responseRate / 100) * 15;
    score += (factors.reviewScore / 5) * 15;
    return Math.round(Math.min(100, Math.max(0, score)));
}
/**
 * Calculate data freshness score based on age
 */
function calculateFreshnessScore(lastUpdated) {
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate <= 24)
        return 100;
    if (hoursSinceUpdate <= 72)
        return 85;
    if (hoursSinceUpdate <= 168)
        return 70; // 1 week
    if (hoursSinceUpdate <= 720)
        return 50; // 1 month
    if (hoursSinceUpdate <= 2160)
        return 25; // 3 months
    return 10;
}
//# sourceMappingURL=scoring.js.map
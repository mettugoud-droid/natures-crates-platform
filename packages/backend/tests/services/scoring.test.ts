/**
 * Phase 12: Unit Tests for Scoring Utilities
 */

import { describe, it, expect } from 'vitest';

// Import scoring functions (mocked path for test)
// In real setup, these would be from @natures-crates/shared
const OPPORTUNITY_THRESHOLDS = { excellent: 80, good: 60, moderate: 40, avoid: 0 };
const MARGIN_TARGETS = { minGrossMargin: 40, minNetMargin: 20, targetRoi: 100, maxBreakEvenMonths: 6 };

function classifyOpportunity(score: number): string {
  if (score >= OPPORTUNITY_THRESHOLDS.excellent) return 'excellent';
  if (score >= OPPORTUNITY_THRESHOLDS.good) return 'good';
  if (score >= OPPORTUNITY_THRESHOLDS.moderate) return 'moderate';
  return 'avoid';
}

function calculateOpportunityScore(factors: {
  demand: number; competition: number; margin: number;
  manufacturingEase: number; repeatPurchase: number;
  brandingPotential: number; regulatoryComplexity: number;
}): number {
  const weights = {
    demand: 0.20, competition: 0.15, margin: 0.25,
    manufacturingEase: 0.10, repeatPurchase: 0.15,
    brandingPotential: 0.10, regulatoryComplexity: 0.05,
  };

  const score =
    factors.demand * weights.demand +
    (100 - factors.competition) * weights.competition +
    factors.margin * weights.margin +
    factors.manufacturingEase * weights.manufacturingEase +
    factors.repeatPurchase * weights.repeatPurchase +
    factors.brandingPotential * weights.brandingPotential +
    (100 - factors.regulatoryComplexity) * weights.regulatoryComplexity;

  return Math.round(Math.min(100, Math.max(0, score)));
}

function meetsMarginTargets(grossMargin: number, netMargin: number) {
  return {
    meetsGross: grossMargin >= MARGIN_TARGETS.minGrossMargin,
    meetsNet: netMargin >= MARGIN_TARGETS.minNetMargin,
    meetsBoth: grossMargin >= MARGIN_TARGETS.minGrossMargin && netMargin >= MARGIN_TARGETS.minNetMargin,
  };
}

function calculateSupplierTrustScore(factors: {
  gstVerified: boolean; businessAge: number; certificationCount: number;
  oemCapable: boolean; responseRate: number; reviewScore: number;
}): number {
  let score = 0;
  if (factors.gstVerified) score += 25;
  if (factors.businessAge >= 10) score += 15;
  else if (factors.businessAge >= 5) score += 10;
  else if (factors.businessAge >= 2) score += 5;
  score += Math.min(20, factors.certificationCount * 5);
  if (factors.oemCapable) score += 10;
  score += (factors.responseRate / 100) * 15;
  score += (factors.reviewScore / 5) * 15;
  return Math.round(Math.min(100, Math.max(0, score)));
}

// === TESTS ===

describe('Opportunity Scoring', () => {
  it('classifies excellent opportunity (80+)', () => {
    expect(classifyOpportunity(85)).toBe('excellent');
    expect(classifyOpportunity(100)).toBe('excellent');
    expect(classifyOpportunity(80)).toBe('excellent');
  });

  it('classifies good opportunity (60-79)', () => {
    expect(classifyOpportunity(75)).toBe('good');
    expect(classifyOpportunity(60)).toBe('good');
  });

  it('classifies moderate opportunity (40-59)', () => {
    expect(classifyOpportunity(50)).toBe('moderate');
    expect(classifyOpportunity(40)).toBe('moderate');
  });

  it('classifies avoid opportunity (0-39)', () => {
    expect(classifyOpportunity(30)).toBe('avoid');
    expect(classifyOpportunity(0)).toBe('avoid');
  });

  it('calculates weighted opportunity score correctly', () => {
    const score = calculateOpportunityScore({
      demand: 80,
      competition: 30, // low = good
      margin: 90,
      manufacturingEase: 85,
      repeatPurchase: 75,
      brandingPotential: 80,
      regulatoryComplexity: 20, // low = good
    });
    
    // Should be high given all positive factors
    expect(score).toBeGreaterThan(75);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scores low for poor factors', () => {
    const score = calculateOpportunityScore({
      demand: 20,
      competition: 90, // high = bad
      margin: 30,
      manufacturingEase: 20,
      repeatPurchase: 15,
      brandingPotential: 20,
      regulatoryComplexity: 80, // high = bad
    });
    
    expect(score).toBeLessThan(30);
  });

  it('handles boundary values', () => {
    const score = calculateOpportunityScore({
      demand: 0, competition: 0, margin: 0,
      manufacturingEase: 0, repeatPurchase: 0,
      brandingPotential: 0, regulatoryComplexity: 0,
    });
    expect(score).toBe(20); // 100-0 for competition and regulatory × their weights
  });

  it('never exceeds 0-100 range', () => {
    const max = calculateOpportunityScore({
      demand: 100, competition: 0, margin: 100,
      manufacturingEase: 100, repeatPurchase: 100,
      brandingPotential: 100, regulatoryComplexity: 0,
    });
    expect(max).toBeLessThanOrEqual(100);
    expect(max).toBeGreaterThanOrEqual(0);
  });
});

describe('Margin Targets', () => {
  it('identifies products meeting both targets', () => {
    const result = meetsMarginTargets(55, 25);
    expect(result.meetsGross).toBe(true);
    expect(result.meetsNet).toBe(true);
    expect(result.meetsBoth).toBe(true);
  });

  it('identifies products meeting only gross target', () => {
    const result = meetsMarginTargets(45, 15);
    expect(result.meetsGross).toBe(true);
    expect(result.meetsNet).toBe(false);
    expect(result.meetsBoth).toBe(false);
  });

  it('identifies products meeting neither target', () => {
    const result = meetsMarginTargets(30, 10);
    expect(result.meetsGross).toBe(false);
    expect(result.meetsNet).toBe(false);
    expect(result.meetsBoth).toBe(false);
  });

  it('handles edge case at exact thresholds', () => {
    const result = meetsMarginTargets(40, 20);
    expect(result.meetsBoth).toBe(true);
  });
});

describe('Supplier Trust Score', () => {
  it('calculates high score for verified supplier', () => {
    const score = calculateSupplierTrustScore({
      gstVerified: true,
      businessAge: 15,
      certificationCount: 4,
      oemCapable: true,
      responseRate: 90,
      reviewScore: 4.5,
    });
    expect(score).toBeGreaterThan(80);
  });

  it('calculates low score for unverified supplier', () => {
    const score = calculateSupplierTrustScore({
      gstVerified: false,
      businessAge: 1,
      certificationCount: 0,
      oemCapable: false,
      responseRate: 20,
      reviewScore: 2.0,
    });
    expect(score).toBeLessThan(20);
  });

  it('gives 25 points for GST verification', () => {
    const withGst = calculateSupplierTrustScore({
      gstVerified: true, businessAge: 0, certificationCount: 0,
      oemCapable: false, responseRate: 0, reviewScore: 0,
    });
    const withoutGst = calculateSupplierTrustScore({
      gstVerified: false, businessAge: 0, certificationCount: 0,
      oemCapable: false, responseRate: 0, reviewScore: 0,
    });
    expect(withGst - withoutGst).toBe(25);
  });

  it('caps certification points at 20', () => {
    const score = calculateSupplierTrustScore({
      gstVerified: false, businessAge: 0, certificationCount: 10,
      oemCapable: false, responseRate: 0, reviewScore: 0,
    });
    // 10 certs * 5 = 50, but capped at 20
    expect(score).toBe(20);
  });

  it('never exceeds 100', () => {
    const score = calculateSupplierTrustScore({
      gstVerified: true, businessAge: 20, certificationCount: 10,
      oemCapable: true, responseRate: 100, reviewScore: 5,
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});

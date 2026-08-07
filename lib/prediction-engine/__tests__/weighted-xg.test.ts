import { describe, it, expect } from 'vitest';
import {
  exponentialDecay,
  weightedMean,
  shrinkage,
  calculateWeightedXG,
  MatchObservation,
} from '../weighted-xg';

describe('exponentialDecay', () => {
  it('returns 1 for daysSince=0 (today)', () => {
    expect(exponentialDecay(0)).toBe(1);
  });

  it('returns positive value for any positive daysSince', () => {
    expect(exponentialDecay(1)).toBeGreaterThan(0);
    expect(exponentialDecay(100)).toBeGreaterThan(0);
    expect(exponentialDecay(365)).toBeGreaterThan(0);
  });

  it('decreases monotonically with daysSince', () => {
    const w1 = exponentialDecay(1);
    const w10 = exponentialDecay(10);
    const w30 = exponentialDecay(30);
    const w90 = exponentialDecay(90);
    expect(w1).toBeGreaterThan(w10);
    expect(w10).toBeGreaterThan(w30);
    expect(w30).toBeGreaterThan(w90);
  });

  it('higher decay rate = faster falloff', () => {
    const slow = exponentialDecay(30, 0.01);
    const fast = exponentialDecay(30, 0.05);
    expect(slow).toBeGreaterThan(fast);
  });

  it('returns 0 for negative daysSince', () => {
    expect(exponentialDecay(-1)).toBe(0);
  });

  it('returns 1 for negative decayRate (guard)', () => {
    expect(exponentialDecay(10, -0.05)).toBe(1);
  });

  it('returns 0 for NaN daysSince', () => {
    expect(exponentialDecay(NaN)).toBe(0);
  });

  it('never returns NaN or Infinity', () => {
    for (let d = 0; d <= 1000; d += 50) {
      const w = exponentialDecay(d, 0.02);
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
    }
  });

  it('half-life of ~35 days at default decay 0.02', () => {
    const halfLife = Math.log(2) / 0.02; // ~34.66 days
    const weight = exponentialDecay(Math.round(halfLife));
    expect(weight).toBeCloseTo(0.5, 1);
  });
});

describe('weightedMean', () => {
  it('returns null for empty observations', () => {
    expect(weightedMean([])).toBeNull();
  });

  it('returns the value for a single observation', () => {
    const result = weightedMean([{ value: 2.5, daysSince: 0 }]);
    expect(result).toBe(2.5);
  });

  it('weights recent observations more', () => {
    const obs: MatchObservation[] = [
      { value: 3.0, daysSince: 0 },  // recent, high value
      { value: 1.0, daysSince: 60 }, // old, low value
    ];
    const result = weightedMean(obs)!;
    // Result should be closer to 3.0 than to 2.0 (simple average)
    expect(result).toBeGreaterThan(2.0);
    expect(result).toBeLessThan(3.0);
  });

  it('equal daysSince gives simple mean', () => {
    const obs: MatchObservation[] = [
      { value: 1.0, daysSince: 5 },
      { value: 3.0, daysSince: 5 },
    ];
    const result = weightedMean(obs)!;
    expect(result).toBeCloseTo(2.0, 8);
  });

  it('ignores non-finite values', () => {
    const obs: MatchObservation[] = [
      { value: 2.0, daysSince: 0 },
      { value: NaN, daysSince: 1 },
      { value: Infinity, daysSince: 2 },
    ];
    const result = weightedMean(obs)!;
    expect(result).toBe(2.0);
  });

  it('returns null if all values are non-finite', () => {
    const obs: MatchObservation[] = [
      { value: NaN, daysSince: 0 },
      { value: Infinity, daysSince: 1 },
    ];
    expect(weightedMean(obs)).toBeNull();
  });
});

describe('shrinkage', () => {
  it('returns prior when sampleSize=0', () => {
    expect(shrinkage(5.0, 1.0, 0, 10)).toBe(1.0);
  });

  it('returns observed when priorWeight=0', () => {
    expect(shrinkage(5.0, 1.0, 10, 0)).toBe(5.0);
  });

  it('pulls extreme values toward the prior', () => {
    // Extreme attack rating of 3.0 with small sample
    const result = shrinkage(3.0, 1.0, 3, 5);
    expect(result).toBeGreaterThan(1.0);
    expect(result).toBeLessThan(3.0);
  });

  it('larger sample size = less shrinkage', () => {
    const small = shrinkage(2.0, 1.0, 3, 5);
    const large = shrinkage(2.0, 1.0, 20, 5);
    // Larger sample should be closer to observed (2.0)
    expect(large).toBeGreaterThan(small);
    expect(large).toBeCloseTo(2.0, 0);
  });

  it('equal sample and prior weights = midpoint', () => {
    const result = shrinkage(2.0, 1.0, 5, 5);
    expect(result).toBeCloseTo(1.5, 8);
  });

  it('returns prior for non-finite observed', () => {
    expect(shrinkage(NaN, 1.0, 10, 5)).toBe(1.0);
    expect(shrinkage(Infinity, 1.0, 10, 5)).toBe(1.0);
  });
});

describe('calculateWeightedXG', () => {
  it('returns null for empty data', () => {
    expect(calculateWeightedXG([])).toBeNull();
  });

  it('weights recent matches higher for xG', () => {
    const matches: MatchObservation[] = [
      { value: 2.5, daysSince: 3 },   // recent high xG
      { value: 0.5, daysSince: 60 },  // old low xG
    ];
    const result = calculateWeightedXG(matches)!;
    expect(result).toBeGreaterThan(1.5); // biased toward recent 2.5
  });
});

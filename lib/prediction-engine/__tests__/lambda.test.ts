import { describe, it, expect } from 'vitest';
import { calculateLambdas, calculateLambdasFromGoals } from '../lambda';
import { LAMBDA_MIN, LAMBDA_MAX } from '../constants';

describe('calculateLambdas', () => {
  it('should compute correct lambdas with typical xG data', () => {
    const result = calculateLambdas(
      { xgFor: 1.8, xgAgainst: 1.2 },
      { xgFor: 1.5, xgAgainst: 1.0 }
    );
    // lambdaHome = 1.8 * 0.6 + 1.0 * 0.4 = 1.08 + 0.4 = 1.48
    expect(result.lambdaHome).toBeCloseTo(1.48, 5);
    // lambdaAway = 1.5 * 0.6 + 1.2 * 0.4 = 0.9 + 0.48 = 1.38
    expect(result.lambdaAway).toBeCloseTo(1.38, 5);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should produce the same lambda as the existing predictor formula', () => {
    // Matching lib/predictor.ts line 128-129:
    // homeLambda = (hxg.xgFor * 0.6 + axg.xgAgainst * 0.4)
    // awayLambda = (axg.xgFor * 0.6 + hxg.xgAgainst * 0.4)
    const homeXG = { xgFor: 2.0, xgAgainst: 0.8 };
    const awayXG = { xgFor: 1.6, xgAgainst: 1.3 };

    const result = calculateLambdas(homeXG, awayXG);
    expect(result.lambdaHome).toBeCloseTo(2.0 * 0.6 + 1.3 * 0.4, 10);
    expect(result.lambdaAway).toBeCloseTo(1.6 * 0.6 + 0.8 * 0.4, 10);
  });

  it('should respect custom weights', () => {
    const result = calculateLambdas(
      { xgFor: 2.0, xgAgainst: 1.0 },
      { xgFor: 1.5, xgAgainst: 0.8 },
      0.7, // more weight on attack
      0.3
    );
    // lambdaHome = 2.0 * 0.7 + 0.8 * 0.3 = 1.4 + 0.24 = 1.64
    expect(result.lambdaHome).toBeCloseTo(1.64, 5);
  });

  it('should warn when weights do not sum to 1', () => {
    const result = calculateLambdas(
      { xgFor: 1.5, xgAgainst: 1.0 },
      { xgFor: 1.5, xgAgainst: 1.0 },
      0.5,
      0.3
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Weights');
  });

  it('should clamp lambda to LAMBDA_MAX when too high', () => {
    const result = calculateLambdas(
      { xgFor: 10.0, xgAgainst: 0.5 },
      { xgFor: 1.0, xgAgainst: 10.0 }
    );
    // lambdaHome = 10 * 0.6 + 10 * 0.4 = 10 → clamped to LAMBDA_MAX
    expect(result.lambdaHome).toBe(LAMBDA_MAX);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should clamp lambda to LAMBDA_MIN when result is 0', () => {
    const result = calculateLambdas(
      { xgFor: 0, xgAgainst: 0 },
      { xgFor: 0, xgAgainst: 0 }
    );
    expect(result.lambdaHome).toBe(LAMBDA_MIN);
    expect(result.lambdaAway).toBe(LAMBDA_MIN);
  });

  it('should handle NaN in xG data', () => {
    const result = calculateLambdas(
      { xgFor: NaN, xgAgainst: 1.0 },
      { xgFor: 1.5, xgAgainst: 1.0 }
    );
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should handle Infinity in xG data', () => {
    const result = calculateLambdas(
      { xgFor: Infinity, xgAgainst: 1.0 },
      { xgFor: 1.5, xgAgainst: 1.0 }
    );
    expect(result.valid).toBe(false);
  });
});

describe('calculateLambdasFromGoals', () => {
  it('should compute lambdas from raw goal averages', () => {
    const result = calculateLambdasFromGoals(1.8, 1.2, 1.5, 1.0);
    // Same formula: lambdaHome = homeAvgFor * 0.6 + awayAvgAgainst * 0.4
    expect(result.lambdaHome).toBeCloseTo(1.8 * 0.6 + 1.0 * 0.4, 5);
    expect(result.lambdaAway).toBeCloseTo(1.5 * 0.6 + 1.2 * 0.4, 5);
  });

  it('should match calculateLambdas behavior', () => {
    const fromGoals = calculateLambdasFromGoals(2.0, 0.8, 1.6, 1.3);
    const fromXG = calculateLambdas(
      { xgFor: 2.0, xgAgainst: 0.8 },
      { xgFor: 1.6, xgAgainst: 1.3 }
    );
    expect(fromGoals.lambdaHome).toBeCloseTo(fromXG.lambdaHome, 10);
    expect(fromGoals.lambdaAway).toBeCloseTo(fromXG.lambdaAway, 10);
  });
});

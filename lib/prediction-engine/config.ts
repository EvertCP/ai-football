/**
 * Prediction Engine V2 — Centralized Configuration
 *
 * ALL tunable parameters for the prediction model live here.
 * No magic numbers scattered across the codebase.
 *
 * Each parameter documents:
 * - What it controls
 * - Valid range
 * - Default value rationale
 */

export const PREDICTION_CONFIG = {
  /**
   * Maximum goals considered in the Poisson distribution.
   * A 7×7 matrix (0–6) captures >99.5% mass for typical lambdas.
   */
  maxGoals: 6,

  /**
   * Exponential time decay for weighting historical matches.
   *
   * weight = exp(-decayRate * daysSinceMatch)
   *
   * Higher = faster decay (recent matches matter more).
   * - 0.01: ~60% weight at 50 days ago
   * - 0.02: ~37% weight at 50 days ago (default)
   * - 0.05: ~8% weight at 50 days ago
   *
   * DECISION: 0.02 gives a half-life of ~35 days.
   * REASON: Football form cycles are typically 4-6 weeks.
   * ALTERNATIVES: 0.01 (slower decay), 0.05 (aggressive).
   */
  decayRate: 0.02,

  /**
   * Shrinkage / regularization prior weight.
   * Controls how much to pull extreme values toward the league mean.
   *
   * adjustedValue = (N * observed + priorWeight * leagueMean) / (N + priorWeight)
   *
   * Higher = more conservative (stronger pull to mean).
   */
  shrinkage: {
    /** Weight when fewer than 3 matches available */
    veryLowSample: 10,
    /** Weight when 3-5 matches available */
    lowSample: 5,
    /** Weight when 6-10 matches available */
    mediumSample: 3,
    /** Weight when more than 10 matches available */
    highSample: 1,
  },

  /**
   * Minimum number of matches for various confidence levels.
   */
  minimumMatches: {
    /** Below this: use league average with very strong shrinkage */
    veryLow: 3,
    /** Below this: moderate shrinkage */
    low: 6,
    /** Below this: light shrinkage */
    medium: 10,
    /** At or above: trust team data primarily */
    high: 15,
  },

  /**
   * Maximum number of historical matches to consider per team.
   * Older matches beyond this window are excluded regardless of decay.
   */
  maxHistoricalMatches: 20,

  /**
   * Maximum age (in days) for a match to be included.
   * Matches older than this are excluded.
   */
  maxMatchAgeDays: 180,

  /**
   * Lambda clamping range.
   * Values outside indicate data issues.
   */
  lambda: {
    min: 0.3,
    max: 4.5,
  },

  /**
   * League baseline defaults when no league data available.
   */
  leagueDefaults: {
    avgHomeXG: 1.45,
    avgAwayXG: 1.15,
  },

  /**
   * Home advantage factor applied to neutral venue.
   * 1.0 = no advantage (neutral), >1.0 = home boost.
   */
  homeAdvantageFactor: 1.0,

  /**
   * Form factor weight.
   * How much recent form (beyond base strength) adjusts lambda.
   * Range: [0.0, 0.3]. Higher = form matters more.
   */
  formFactorWeight: 0.15,

  /**
   * Model version identifiers
   */
  models: {
    v1: 'POISSON_V1',
    v2: 'POISSON_V2',
    dixonColes: 'DIXON_COLES_V1',
    heuristic: 'HEURISTIC_V1',
  },
} as const;

/**
 * Get the shrinkage prior weight based on sample size.
 */
export function getShrinkageWeight(sampleSize: number): number {
  const { shrinkage, minimumMatches } = PREDICTION_CONFIG;
  if (sampleSize < minimumMatches.veryLow) return shrinkage.veryLowSample;
  if (sampleSize < minimumMatches.low) return shrinkage.lowSample;
  if (sampleSize < minimumMatches.medium) return shrinkage.mediumSample;
  return shrinkage.highSample;
}

export type PredictionConfig = typeof PREDICTION_CONFIG;

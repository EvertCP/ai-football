/**
 * Weighted xG / xGA Calculation with Exponential Time Decay
 *
 * More recent matches carry more weight.
 * The decay function ensures that a match from 3 months ago
 * has significantly less influence than last week's match.
 */

import { PREDICTION_CONFIG } from './config';

/** A single match observation for weighting */
export interface MatchObservation {
  /** Value to weight (e.g., xG, xGA, goals) */
  value: number;
  /** Days since this match was played (0 = today) */
  daysSince: number;
}

/**
 * Calculate exponential time decay weight.
 *
 * weight = exp(-decayRate * daysSince)
 *
 * Properties:
 * - Always positive
 * - Monotonically decreasing
 * - weight(0) = 1 (most recent has full weight)
 *
 * @param daysSince - Number of days since the match
 * @param decayRate - Decay rate parameter (default from config)
 * @returns Weight in (0, 1]
 */
export function exponentialDecay(
  daysSince: number,
  decayRate: number = PREDICTION_CONFIG.decayRate
): number {
  if (!Number.isFinite(daysSince) || daysSince < 0) return 0;
  if (!Number.isFinite(decayRate) || decayRate < 0) return 1;
  return Math.exp(-decayRate * daysSince);
}

/**
 * Calculate weighted mean of observations using exponential time decay.
 *
 * weightedMean = Σ(weight_i * value_i) / Σ(weight_i)
 *
 * @param observations - Array of { value, daysSince }
 * @param decayRate - Decay rate (default from config)
 * @returns Weighted mean, or null if no valid observations
 */
export function weightedMean(
  observations: MatchObservation[],
  decayRate: number = PREDICTION_CONFIG.decayRate
): number | null {
  if (observations.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const obs of observations) {
    if (!Number.isFinite(obs.value)) continue;

    const weight = exponentialDecay(obs.daysSince, decayRate);
    weightedSum += weight * obs.value;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

/**
 * Calculate weighted xG for a team from historical match data.
 *
 * @param matches - Array of per-match xG values with dates
 * @param decayRate - Decay rate
 * @returns Weighted average xG per match
 */
export function calculateWeightedXG(
  matches: MatchObservation[],
  decayRate: number = PREDICTION_CONFIG.decayRate
): number | null {
  return weightedMean(matches, decayRate);
}

/**
 * Calculate weighted xGA (expected goals against) for a team.
 *
 * @param matches - Array of per-match xGA values with dates
 * @param decayRate - Decay rate
 * @returns Weighted average xGA per match
 */
export function calculateWeightedXGA(
  matches: MatchObservation[],
  decayRate: number = PREDICTION_CONFIG.decayRate
): number | null {
  return weightedMean(matches, decayRate);
}

/**
 * Apply shrinkage (regularization) to an observed value.
 *
 * Pulls extreme values toward a prior (typically league average).
 *
 * Formula:
 *   adjusted = (N * observed + priorWeight * prior) / (N + priorWeight)
 *
 * @param observed - The raw observed value
 * @param prior - The prior value to shrink toward (e.g., league average = 1.0)
 * @param sampleSize - Number of observations (N)
 * @param priorWeight - Strength of the prior pull
 * @returns Regularized value
 */
export function shrinkage(
  observed: number,
  prior: number,
  sampleSize: number,
  priorWeight: number
): number {
  if (!Number.isFinite(observed)) return prior;
  if (sampleSize <= 0) return prior;
  if (priorWeight <= 0) return observed;
  return (sampleSize * observed + priorWeight * prior) / (sampleSize + priorWeight);
}

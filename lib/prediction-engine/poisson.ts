/**
 * Poisson Distribution Utilities
 *
 * Pure mathematical functions for computing Poisson probabilities.
 * No side effects, no external dependencies — fully testeable.
 *
 * The Poisson distribution models the probability of a given number of events
 * (goals) occurring in a fixed interval, given the average rate (lambda).
 *
 * P(X = k) = (e^(-λ) * λ^k) / k!
 */

import { MAX_GOALS } from './constants';
import { GoalDistribution } from './types';

/**
 * Compute factorial of n using iterative method.
 * Uses a lookup table for values 0-20 to avoid redundant computation.
 *
 * @param n - Non-negative integer
 * @returns n!
 * @throws Error if n is negative or not an integer
 */
const FACTORIAL_CACHE: number[] = [1]; // factorial(0) = 1

export function factorial(n: number): number {
  if (!Number.isFinite(n) || n < 0 || n !== Math.floor(n)) {
    throw new Error(`factorial: invalid input n=${n}. Must be non-negative integer.`);
  }

  if (n < FACTORIAL_CACHE.length) {
    return FACTORIAL_CACHE[n];
  }

  // Build up cache from where we left off
  let result = FACTORIAL_CACHE[FACTORIAL_CACHE.length - 1];
  for (let i = FACTORIAL_CACHE.length; i <= n; i++) {
    result *= i;
    FACTORIAL_CACHE.push(result);
  }

  return result;
}

/**
 * Compute Poisson probability mass function P(X = k) for a given lambda.
 *
 * P(X = k) = (e^(-λ) * λ^k) / k!
 *
 * Special cases:
 * - lambda = 0: P(0) = 1, P(k>0) = 0
 * - lambda < 0: throws Error
 * - lambda = NaN/Infinity: throws Error
 * - k < 0 or non-integer: throws Error
 *
 * @param lambda - Expected value (average rate), must be >= 0
 * @param k - Number of occurrences, must be non-negative integer
 * @returns Probability P(X = k)
 */
export function poissonPmf(lambda: number, k: number): number {
  // Validate inputs
  if (!Number.isFinite(lambda)) {
    throw new Error(`poissonPmf: lambda must be finite, got ${lambda}`);
  }
  if (lambda < 0) {
    throw new Error(`poissonPmf: lambda must be non-negative, got ${lambda}`);
  }
  if (!Number.isFinite(k) || k < 0 || k !== Math.floor(k)) {
    throw new Error(`poissonPmf: k must be non-negative integer, got ${k}`);
  }

  // Special case: lambda = 0 means the event never happens
  if (lambda === 0) {
    return k === 0 ? 1.0 : 0.0;
  }

  // For numerical stability with large k, use log-space computation
  // log(P) = -lambda + k*log(lambda) - log(k!)
  if (k > 20) {
    const logP = -lambda + k * Math.log(lambda) - logFactorial(k);
    return Math.exp(logP);
  }

  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/**
 * Compute log(n!) using Stirling's approximation for large n,
 * or exact computation for small n.
 */
function logFactorial(n: number): number {
  if (n <= 20) {
    return Math.log(factorial(n));
  }
  // Stirling's approximation: log(n!) ≈ n*log(n) - n + 0.5*log(2*π*n)
  return n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n);
}

/**
 * Generate the goal distribution for a team.
 * Returns an array where index k = P(team scores k goals).
 *
 * @param lambda - Expected goals for the team
 * @param maxGoals - Maximum goals to compute (default: MAX_GOALS from constants)
 * @returns Array of probabilities P(0), P(1), ..., P(maxGoals)
 */
export function generateGoalDistribution(
  lambda: number,
  maxGoals: number = MAX_GOALS
): GoalDistribution {
  if (!Number.isFinite(lambda) || lambda < 0) {
    throw new Error(`generateGoalDistribution: invalid lambda=${lambda}`);
  }
  if (!Number.isFinite(maxGoals) || maxGoals < 0 || maxGoals !== Math.floor(maxGoals)) {
    throw new Error(`generateGoalDistribution: invalid maxGoals=${maxGoals}`);
  }

  const distribution: GoalDistribution = [];
  for (let k = 0; k <= maxGoals; k++) {
    distribution.push(poissonPmf(lambda, k));
  }
  return distribution;
}

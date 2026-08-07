/**
 * Dixon-Coles Correction — Phase 7 Placeholder
 *
 * The Dixon-Coles model adjusts the standard Poisson model
 * for low-scoring outcomes (0-0, 1-0, 0-1, 1-1) which are
 * empirically more/less likely than Poisson predicts.
 *
 * The correction factor τ(x, y, λ₁, λ₂, ρ) modifies joint probabilities:
 *
 * For x=0, y=0: τ = 1 - λ₁*λ₂*ρ
 * For x=0, y=1: τ = 1 + λ₁*ρ
 * For x=1, y=0: τ = 1 + λ₂*ρ
 * For x=1, y=1: τ = 1 - ρ
 * Otherwise:    τ = 1
 *
 * Where ρ (rho) is the dependence parameter estimated from data.
 * Typical values: ρ ∈ [-0.15, 0.00]
 *
 * Implementation requires:
 * 1. Historical match data to estimate ρ via maximum likelihood
 * 2. Attack/defense strength ratings per team
 * 3. Time decay weighting (Phases 8-9)
 *
 * References:
 * - Dixon, M. & Coles, S. (1997). "Modelling Association Football Scores
 *   and Inefficiencies in the Football Betting Market."
 *   Journal of the Royal Statistical Society.
 *
 * Status: NOT IMPLEMENTED — awaiting persistence layer data accumulation.
 */

import { ScoreMatrix } from './types';
import { MODEL_DIXON_COLES_V1 } from './constants';

/**
 * Apply Dixon-Coles correction to a Poisson score matrix.
 *
 * @param matrix - Original Poisson score matrix
 * @param lambdaHome - Home team expected goals
 * @param lambdaAway - Away team expected goals
 * @param rho - Dependence parameter (typically negative, ~-0.05 to -0.13)
 * @returns Corrected score matrix
 */
export function applyDixonColesCorrection(
  matrix: ScoreMatrix,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): ScoreMatrix {
  // Deep copy the matrix
  const corrected: ScoreMatrix = matrix.map(row => [...row]);

  if (corrected.length < 2 || corrected[0].length < 2) return corrected;

  // Apply tau corrections to low-scoring outcomes
  corrected[0][0] *= (1 - lambdaHome * lambdaAway * rho); // 0-0
  corrected[0][1] *= (1 + lambdaHome * rho);               // 0-1
  corrected[1][0] *= (1 + lambdaAway * rho);               // 1-0
  corrected[1][1] *= (1 - rho);                             // 1-1

  // Ensure no negative probabilities
  for (let i = 0; i < corrected.length; i++) {
    for (let j = 0; j < corrected[i].length; j++) {
      corrected[i][j] = Math.max(0, corrected[i][j]);
    }
  }

  return corrected;
}

/**
 * Estimate rho from historical match data.
 *
 * TODO: Phase 7 — Implement maximum likelihood estimation.
 * This requires accumulated match data from the persistence layer.
 *
 * @returns Estimated rho value
 */
export function estimateRho(): number {
  // Placeholder: return typical value from literature
  // Real implementation: MLE over historical data
  console.warn(
    `[${MODEL_DIXON_COLES_V1}] Using placeholder rho=-0.05. MLE estimation not yet implemented.`
  );
  return -0.05;
}

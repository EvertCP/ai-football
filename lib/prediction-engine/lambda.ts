/**
 * Lambda (Expected Goals) Calculator
 *
 * Extracts and computes lambda values from team form data.
 * Lambda represents the expected number of goals a team will score.
 *
 * Current formula (v1):
 *   lambdaHome = xgFor_home * 0.6 + xgAgainst_away * 0.4
 *   lambdaAway = xgFor_away * 0.6 + xgAgainst_home * 0.4
 *
 * This weighs the team's own attacking output (60%) against
 * the opponent's defensive weakness (40%).
 *
 * Future improvements (Phase 8+):
 * - Home/away split attack/defense ratings
 * - Exponential time decay on historical data
 * - League-adjusted strength ratings
 * - ML-predicted lambdas
 */

import { LAMBDA_MIN, LAMBDA_MAX } from './constants';

/** Input data needed to calculate lambda for one team */
export interface TeamXGData {
  xgFor: number;      // Average estimated xG scored per match
  xgAgainst: number;  // Average estimated xG conceded per match
}

/** Result of lambda calculation with validation info */
export interface LambdaResult {
  lambdaHome: number;
  lambdaAway: number;
  valid: boolean;
  warnings: string[];
}

/**
 * Calculate lambdas (expected goals) for a match.
 *
 * @param homeXG - Home team's xG data (xgFor, xgAgainst per match)
 * @param awayXG - Away team's xG data (xgFor, xgAgainst per match)
 * @param attackWeight - Weight for team's own attacking xG (default: 0.6)
 * @param defenseWeight - Weight for opponent's defensive xG (default: 0.4)
 * @returns Lambda values with validation
 */
export function calculateLambdas(
  homeXG: TeamXGData,
  awayXG: TeamXGData,
  attackWeight: number = 0.6,
  defenseWeight: number = 0.4
): LambdaResult {
  const warnings: string[] = [];

  // Validate weights sum to 1
  const weightSum = attackWeight + defenseWeight;
  if (Math.abs(weightSum - 1.0) > 0.001) {
    warnings.push(`Weights do not sum to 1.0 (got ${weightSum})`);
  }

  // Calculate raw lambdas
  let lambdaHome = homeXG.xgFor * attackWeight + awayXG.xgAgainst * defenseWeight;
  let lambdaAway = awayXG.xgFor * attackWeight + homeXG.xgAgainst * defenseWeight;

  // Validate and clamp
  let valid = true;

  if (!Number.isFinite(lambdaHome) || !Number.isFinite(lambdaAway)) {
    warnings.push('Lambda calculation produced non-finite value');
    valid = false;
    lambdaHome = Number.isFinite(lambdaHome) ? lambdaHome : 1.0;
    lambdaAway = Number.isFinite(lambdaAway) ? lambdaAway : 1.0;
  }

  if (lambdaHome < LAMBDA_MIN) {
    warnings.push(`lambdaHome clamped from ${lambdaHome} to ${LAMBDA_MIN}`);
    lambdaHome = LAMBDA_MIN;
  }
  if (lambdaHome > LAMBDA_MAX) {
    warnings.push(`lambdaHome clamped from ${lambdaHome} to ${LAMBDA_MAX}`);
    lambdaHome = LAMBDA_MAX;
  }
  if (lambdaAway < LAMBDA_MIN) {
    warnings.push(`lambdaAway clamped from ${lambdaAway} to ${LAMBDA_MIN}`);
    lambdaAway = LAMBDA_MIN;
  }
  if (lambdaAway > LAMBDA_MAX) {
    warnings.push(`lambdaAway clamped from ${lambdaAway} to ${LAMBDA_MAX}`);
    lambdaAway = LAMBDA_MAX;
  }

  return {
    lambdaHome,
    lambdaAway,
    valid,
    warnings,
  };
}

/**
 * Fallback lambda calculation when xG data is unavailable.
 * Uses raw goals scored/conceded averages as a proxy.
 *
 * @param homeAvgGoalsFor - Home team's average goals scored per match
 * @param homeAvgGoalsAgainst - Home team's average goals conceded per match
 * @param awayAvgGoalsFor - Away team's average goals scored per match
 * @param awayAvgGoalsAgainst - Away team's average goals conceded per match
 */
export function calculateLambdasFromGoals(
  homeAvgGoalsFor: number,
  homeAvgGoalsAgainst: number,
  awayAvgGoalsFor: number,
  awayAvgGoalsAgainst: number
): LambdaResult {
  return calculateLambdas(
    { xgFor: homeAvgGoalsFor, xgAgainst: homeAvgGoalsAgainst },
    { xgFor: awayAvgGoalsFor, xgAgainst: awayAvgGoalsAgainst }
  );
}

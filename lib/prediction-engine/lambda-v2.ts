/**
 * Expected Goals Engine V2 — Lambda Calculator
 *
 * Produces lambdaHome and lambdaAway using:
 * 1. League baseline averages
 * 2. Team strength ratings (home/away split)
 * 3. Weighted xG with time decay
 * 4. Opponent strength adjustment
 * 5. Regularization (shrinkage)
 * 6. Form factor
 *
 * Architecture:
 *   λHome = leagueAvgHomeXG × homeAttackStrength × awayDefenseWeakness × formFactor
 *   λAway = leagueAvgAwayXG × awayAttackStrength × homeDefenseWeakness × formFactor
 *
 * This module does NOT:
 * - Fetch data from APIs (that's the caller's job)
 * - Apply Poisson (that's the score-matrix module)
 * - Make UI decisions (that's the frontend)
 */

import { PREDICTION_CONFIG } from './config';
import { LeagueBaseline, getDefaultLeagueBaseline } from './league-baseline';
import { TeamStrength } from './team-strength';

/** Input required for V2 lambda calculation */
export interface LambdaV2Input {
  /** Strength ratings for the home team */
  homeStrength: TeamStrength;
  /** Strength ratings for the away team */
  awayStrength: TeamStrength;
  /** League baseline averages */
  leagueBaseline: LeagueBaseline;
  /** Whether the match is at a neutral venue */
  isNeutralVenue?: boolean;
  /** Optional form factor override for home team (multiplier, 1.0 = neutral) */
  homeFormFactor?: number;
  /** Optional form factor override for away team */
  awayFormFactor?: number;
}

/** Result of V2 lambda calculation with full diagnostic data */
export interface LambdaV2Result {
  lambdaHome: number;
  lambdaAway: number;
  valid: boolean;
  warnings: string[];

  /** Diagnostic breakdown of the calculation */
  diagnostics: {
    leagueAvgHomeXG: number;
    leagueAvgAwayXG: number;
    homeAttack: number;
    homeDefense: number;
    awayAttack: number;
    awayDefense: number;
    homeFormFactor: number;
    awayFormFactor: number;
    isNeutralVenue: boolean;
    rawLambdaHome: number;
    rawLambdaAway: number;
    clampedHome: boolean;
    clampedAway: boolean;
    model: string;
  };

  /** Metadata about data quality */
  metadata: {
    homeMatchesUsed: number;
    awayMatchesUsed: number;
    homeRegularized: boolean;
    awayRegularized: boolean;
    leagueBaselineReliable: boolean;
    fallbacks: string[];
  };
}

/**
 * Calculate lambdas using the V2 engine.
 *
 * Formula:
 *   λHome = leagueAvgHomeXG × homeTeam.homeAttackStrength × awayTeam.awayDefenseWeakness × formFactor
 *   λAway = leagueAvgAwayXG × awayTeam.awayAttackStrength × homeTeam.homeDefenseWeakness × formFactor
 *
 * For neutral venues:
 *   Use overall (non-split) attack/defense ratings instead of home/away specific.
 */
export function calculateLambdasV2(input: LambdaV2Input): LambdaV2Result {
  const {
    homeStrength,
    awayStrength,
    leagueBaseline,
    isNeutralVenue = false,
    homeFormFactor = 1.0,
    awayFormFactor = 1.0,
  } = input;

  const warnings: string[] = [];
  const fallbacks: string[] = [];

  // Use league baseline (or defaults if unreliable)
  let baseline = leagueBaseline;
  if (!baseline.reliable) {
    warnings.push('League baseline is based on insufficient data — using defaults');
    if (baseline.matchCount === 0) {
      baseline = getDefaultLeagueBaseline();
      fallbacks.push('LEAGUE_DEFAULT');
    }
  }

  // Select appropriate strength ratings based on venue
  let homeAttack: number;
  let homeDefense: number;
  let awayAttack: number;
  let awayDefense: number;

  if (isNeutralVenue) {
    // Neutral venue: use overall ratings (not home/away split)
    homeAttack = homeStrength.attackStrength;
    homeDefense = homeStrength.defenseWeakness;
    awayAttack = awayStrength.attackStrength;
    awayDefense = awayStrength.defenseWeakness;
    fallbacks.push('NEUTRAL_VENUE_OVERALL_RATINGS');
  } else {
    // Standard venue: use location-specific ratings
    homeAttack = homeStrength.homeAttackStrength;
    homeDefense = homeStrength.homeDefenseWeakness;
    awayAttack = awayStrength.awayAttackStrength;
    awayDefense = awayStrength.awayDefenseWeakness;
  }

  // Clamp form factors to reasonable range
  const clampedHomeForm = Math.max(0.7, Math.min(1.3, homeFormFactor));
  const clampedAwayForm = Math.max(0.7, Math.min(1.3, awayFormFactor));

  if (homeFormFactor !== clampedHomeForm) {
    warnings.push(`homeFormFactor clamped from ${homeFormFactor} to ${clampedHomeForm}`);
  }
  if (awayFormFactor !== clampedAwayForm) {
    warnings.push(`awayFormFactor clamped from ${awayFormFactor} to ${clampedAwayForm}`);
  }

  // Calculate raw lambdas
  const rawLambdaHome = baseline.avgHomeXG * homeAttack * awayDefense * clampedHomeForm;
  const rawLambdaAway = baseline.avgAwayXG * awayAttack * homeDefense * clampedAwayForm;

  // Clamp to valid range
  const { min, max } = PREDICTION_CONFIG.lambda;
  let lambdaHome = rawLambdaHome;
  let lambdaAway = rawLambdaAway;
  let clampedHome = false;
  let clampedAway = false;

  if (lambdaHome < min) { lambdaHome = min; clampedHome = true; warnings.push(`lambdaHome clamped: ${rawLambdaHome.toFixed(4)} → ${min}`); }
  if (lambdaHome > max) { lambdaHome = max; clampedHome = true; warnings.push(`lambdaHome clamped: ${rawLambdaHome.toFixed(4)} → ${max}`); }
  if (lambdaAway < min) { lambdaAway = min; clampedAway = true; warnings.push(`lambdaAway clamped: ${rawLambdaAway.toFixed(4)} → ${min}`); }
  if (lambdaAway > max) { lambdaAway = max; clampedAway = true; warnings.push(`lambdaAway clamped: ${rawLambdaAway.toFixed(4)} → ${max}`); }

  // Validate
  const valid = Number.isFinite(lambdaHome) && Number.isFinite(lambdaAway) &&
    lambdaHome > 0 && lambdaAway > 0;

  if (!valid) {
    warnings.push('Lambda calculation produced invalid values — falling back to league averages');
    lambdaHome = baseline.avgHomeXG;
    lambdaAway = baseline.avgAwayXG;
    fallbacks.push('INVALID_LAMBDA_FALLBACK');
  }

  return {
    lambdaHome,
    lambdaAway,
    valid,
    warnings,
    diagnostics: {
      leagueAvgHomeXG: baseline.avgHomeXG,
      leagueAvgAwayXG: baseline.avgAwayXG,
      homeAttack,
      homeDefense,
      awayAttack,
      awayDefense,
      homeFormFactor: clampedHomeForm,
      awayFormFactor: clampedAwayForm,
      isNeutralVenue,
      rawLambdaHome,
      rawLambdaAway,
      clampedHome,
      clampedAway,
      model: PREDICTION_CONFIG.models.v2,
    },
    metadata: {
      homeMatchesUsed: homeStrength.metadata.totalMatches,
      awayMatchesUsed: awayStrength.metadata.totalMatches,
      homeRegularized: homeStrength.metadata.regularized,
      awayRegularized: awayStrength.metadata.regularized,
      leagueBaselineReliable: baseline.reliable,
      fallbacks,
    },
  };
}

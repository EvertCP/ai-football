/**
 * Team Strength Engine
 *
 * Calculates attack strength and defense weakness ratings
 * relative to the league average. Supports home/away splits.
 *
 * Naming convention:
 * - attackStrength: >1 means team attacks better than league avg (good)
 * - defenseWeakness: >1 means team concedes MORE than league avg (bad for them)
 *
 * This avoids ambiguity — "high defense" could mean good or bad.
 * Here: high defenseWeakness = bad defense.
 */

import { PREDICTION_CONFIG, getShrinkageWeight } from './config';
import { LeagueBaseline } from './league-baseline';
import { MatchObservation, weightedMean, shrinkage } from './weighted-xg';

/** Historical match data for a single team */
export interface TeamMatchHistory {
  /** xG scored in this match */
  xgFor: number;
  /** xG conceded in this match */
  xgAgainst: number;
  /** Days since this match was played */
  daysSince: number;
  /** Whether the team played at home in this match */
  isHome: boolean;
  /** Opponent's defense weakness rating (for adjustment). null = unadjusted. */
  opponentDefenseWeakness?: number;
  /** Opponent's attack strength rating (for adjustment). null = unadjusted. */
  opponentAttackStrength?: number;
}

/** Full team strength output */
export interface TeamStrength {
  /** Overall attack strength (xG / league avg) */
  attackStrength: number;
  /** Overall defense weakness (xGA / league avg) — high = bad */
  defenseWeakness: number;

  /** Home-specific attack strength */
  homeAttackStrength: number;
  /** Home-specific defense weakness */
  homeDefenseWeakness: number;

  /** Away-specific attack strength */
  awayAttackStrength: number;
  /** Away-specific defense weakness */
  awayDefenseWeakness: number;

  /** Metadata about the calculation */
  metadata: {
    totalMatches: number;
    homeMatches: number;
    awayMatches: number;
    regularized: boolean;
    fallbackUsed: string | null;
  };
}

/**
 * Calculate full team strength ratings from historical match data.
 *
 * @param history - Array of TeamMatchHistory entries (pre-filtered, no future data)
 * @param baseline - League average xG values
 * @param adjustForOpponent - Whether to apply opponent strength adjustment
 * @returns TeamStrength with all ratings
 */
export function calculateTeamStrength(
  history: TeamMatchHistory[],
  baseline: LeagueBaseline,
  adjustForOpponent: boolean = false
): TeamStrength {
  const decayRate = PREDICTION_CONFIG.decayRate;

  // Split into home/away
  const homeMatches = history.filter(m => m.isHome);
  const awayMatches = history.filter(m => !m.isHome);

  // Prepare observations (optionally adjusted for opponent)
  const xgForObs = history.map(m => ({
    value: adjustForOpponent && m.opponentDefenseWeakness && m.opponentDefenseWeakness > 0
      ? m.xgFor / m.opponentDefenseWeakness
      : m.xgFor,
    daysSince: m.daysSince,
  }));

  const xgAgainstObs = history.map(m => ({
    value: adjustForOpponent && m.opponentAttackStrength && m.opponentAttackStrength > 0
      ? m.xgAgainst / m.opponentAttackStrength
      : m.xgAgainst,
    daysSince: m.daysSince,
  }));

  const homeXGForObs: MatchObservation[] = homeMatches.map(m => ({
    value: adjustForOpponent && m.opponentDefenseWeakness && m.opponentDefenseWeakness > 0
      ? m.xgFor / m.opponentDefenseWeakness
      : m.xgFor,
    daysSince: m.daysSince,
  }));

  const homeXGAgainstObs: MatchObservation[] = homeMatches.map(m => ({
    value: adjustForOpponent && m.opponentAttackStrength && m.opponentAttackStrength > 0
      ? m.xgAgainst / m.opponentAttackStrength
      : m.xgAgainst,
    daysSince: m.daysSince,
  }));

  const awayXGForObs: MatchObservation[] = awayMatches.map(m => ({
    value: adjustForOpponent && m.opponentDefenseWeakness && m.opponentDefenseWeakness > 0
      ? m.xgFor / m.opponentDefenseWeakness
      : m.xgFor,
    daysSince: m.daysSince,
  }));

  const awayXGAgainstObs: MatchObservation[] = awayMatches.map(m => ({
    value: adjustForOpponent && m.opponentAttackStrength && m.opponentAttackStrength > 0
      ? m.xgAgainst / m.opponentAttackStrength
      : m.xgAgainst,
    daysSince: m.daysSince,
  }));

  // Calculate weighted means
  const overallXGFor = weightedMean(xgForObs, decayRate) ?? baseline.avgHomeXG;
  const overallXGAgainst = weightedMean(xgAgainstObs, decayRate) ?? baseline.avgAwayXG;

  const homeXGFor = weightedMean(homeXGForObs, decayRate);
  const homeXGAgainst = weightedMean(homeXGAgainstObs, decayRate);
  const awayXGFor = weightedMean(awayXGForObs, decayRate);
  const awayXGAgainst = weightedMean(awayXGAgainstObs, decayRate);

  // Compute raw strengths relative to league
  // Overall uses combined league average (home+away / 2) since it mixes venues
  const leagueOverallXG = (baseline.avgHomeXG + baseline.avgAwayXG) / 2;
  const rawAttack = overallXGFor / leagueOverallXG;
  const rawDefense = overallXGAgainst / leagueOverallXG;

  // Home/away-specific ratings use the appropriate league context:
  // - Home team xG compared to league home average
  // - Away team xG compared to league away average
  // - Home defense (xGA) compared to league away xG (what opponents typically score away)
  // - Away defense (xGA) compared to league home xG (what opponents typically score at home)
  const rawHomeAttack = homeXGFor !== null ? homeXGFor / baseline.avgHomeXG : rawAttack;
  const rawHomeDefense = homeXGAgainst !== null ? homeXGAgainst / baseline.avgAwayXG : rawDefense;
  const rawAwayAttack = awayXGFor !== null ? awayXGFor / baseline.avgAwayXG : rawAttack;
  const rawAwayDefense = awayXGAgainst !== null ? awayXGAgainst / baseline.avgHomeXG : rawDefense;

  // Apply shrinkage
  // For home/away splits, use the OVERALL match count for determining confidence tier.
  // Rationale: splitting 10 matches into 5 home + 5 away shouldn't DOUBLE the shrinkage.
  // The per-venue count affects the weighted mean already; we don't penalize it again.
  const overallPrior = getShrinkageWeight(history.length);

  const attackStrength = shrinkage(rawAttack, 1.0, history.length, overallPrior);
  const defenseWeakness = shrinkage(rawDefense, 1.0, history.length, overallPrior);

  const homeAttackStrength = shrinkage(rawHomeAttack, 1.0, homeMatches.length, overallPrior);
  const homeDefenseWeakness = shrinkage(rawHomeDefense, 1.0, homeMatches.length, overallPrior);
  const awayAttackStrength = shrinkage(rawAwayAttack, 1.0, awayMatches.length, overallPrior);
  const awayDefenseWeakness = shrinkage(rawAwayDefense, 1.0, awayMatches.length, overallPrior);

  // Determine fallback
  let fallbackUsed: string | null = null;
  if (history.length === 0) fallbackUsed = 'NO_DATA';
  else if (homeMatches.length === 0 && awayMatches.length === 0) fallbackUsed = 'NO_SPLIT_DATA';

  return {
    attackStrength: clampStrength(attackStrength),
    defenseWeakness: clampStrength(defenseWeakness),
    homeAttackStrength: clampStrength(homeAttackStrength),
    homeDefenseWeakness: clampStrength(homeDefenseWeakness),
    awayAttackStrength: clampStrength(awayAttackStrength),
    awayDefenseWeakness: clampStrength(awayDefenseWeakness),
    metadata: {
      totalMatches: history.length,
      homeMatches: homeMatches.length,
      awayMatches: awayMatches.length,
      regularized: overallPrior > 1,
      fallbackUsed,
    },
  };
}

/**
 * Clamp strength rating to reasonable range [0.1, 4.0].
 * Prevents extreme values from corrupting lambda calculation.
 */
function clampStrength(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1.0;
  return Math.max(0.1, Math.min(4.0, value));
}

/**
 * League Baseline Calculator
 *
 * Computes average home xG and away xG for a league/competition.
 * These values contextualize team strength ratings:
 *   - attackStrength = teamXG / leagueAvgXG
 *   - defenseWeakness = teamXGA / leagueAvgXGA
 *
 * Values of 1.0 represent exactly league average.
 */

import { PREDICTION_CONFIG } from './config';

/** Per-match stats needed for league baseline calculation */
export interface LeagueMatchData {
  homeXG: number;
  awayXG: number;
}

/** Calculated league averages */
export interface LeagueBaseline {
  /** Average xG scored by home teams per match */
  avgHomeXG: number;
  /** Average xG scored by away teams per match */
  avgAwayXG: number;
  /** Number of matches used to calculate the baseline */
  matchCount: number;
  /** Whether the baseline is based on sufficient data */
  reliable: boolean;
}

/**
 * Calculate league average xG values from historical match data.
 *
 * @param matches - Array of per-match { homeXG, awayXG } values
 * @param minimumMatches - Minimum matches for reliable baseline (default: 30)
 * @returns LeagueBaseline with averages and reliability flag
 */
export function calculateLeagueBaseline(
  matches: LeagueMatchData[],
  minimumMatches: number = 30
): LeagueBaseline {
  if (matches.length === 0) {
    return {
      avgHomeXG: PREDICTION_CONFIG.leagueDefaults.avgHomeXG,
      avgAwayXG: PREDICTION_CONFIG.leagueDefaults.avgAwayXG,
      matchCount: 0,
      reliable: false,
    };
  }

  let totalHomeXG = 0;
  let totalAwayXG = 0;
  let validCount = 0;

  for (const match of matches) {
    if (Number.isFinite(match.homeXG) && Number.isFinite(match.awayXG)) {
      totalHomeXG += match.homeXG;
      totalAwayXG += match.awayXG;
      validCount++;
    }
  }

  if (validCount === 0) {
    return {
      avgHomeXG: PREDICTION_CONFIG.leagueDefaults.avgHomeXG,
      avgAwayXG: PREDICTION_CONFIG.leagueDefaults.avgAwayXG,
      matchCount: 0,
      reliable: false,
    };
  }

  return {
    avgHomeXG: totalHomeXG / validCount,
    avgAwayXG: totalAwayXG / validCount,
    matchCount: validCount,
    reliable: validCount >= minimumMatches,
  };
}

/**
 * Get the default league baseline when no league data is available.
 */
export function getDefaultLeagueBaseline(): LeagueBaseline {
  return {
    avgHomeXG: PREDICTION_CONFIG.leagueDefaults.avgHomeXG,
    avgAwayXG: PREDICTION_CONFIG.leagueDefaults.avgAwayXG,
    matchCount: 0,
    reliable: false,
  };
}

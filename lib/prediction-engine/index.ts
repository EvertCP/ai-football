/**
 * Prediction Engine — Public API
 *
 * Entry point for the exact score prediction system.
 * Combines lambda calculation, Poisson distribution, and score matrix
 * into a single cohesive prediction output.
 */

export { factorial, poissonPmf, generateGoalDistribution } from './poisson';
export {
  generateScoreMatrix,
  computeTotalMass,
  extractExactScores,
  deriveMatchResult,
  deriveOverUnder,
  deriveBTTS,
  getTopScores,
  generateFullPrediction,
} from './score-matrix';
export { calculateLambdas, calculateLambdasFromGoals } from './lambda';
export type { TeamXGData, LambdaResult } from './lambda';
export { calculateLambdasV2 } from './lambda-v2';
export type { LambdaV2Input, LambdaV2Result } from './lambda-v2';
export { calculateTeamStrength } from './team-strength';
export type { TeamMatchHistory, TeamStrength } from './team-strength';
export { calculateLeagueBaseline, getDefaultLeagueBaseline } from './league-baseline';
export type { LeagueMatchData, LeagueBaseline } from './league-baseline';
export { exponentialDecay, weightedMean, shrinkage, calculateWeightedXG, calculateWeightedXGA } from './weighted-xg';
export type { MatchObservation } from './weighted-xg';
export { adjustXGForOpponent, adjustXGAForOpponent } from './opponent-adjustment';
export { PREDICTION_CONFIG, getShrinkageWeight } from './config';
export * from './types';
export * from './constants';

import { generateFullPrediction } from './score-matrix';
import { MAX_GOALS, MODEL_POISSON_V1, MODEL_POISSON_V2, TOP_SCORES_COUNT } from './constants';
import { ExactScorePrediction, PredictionEngineInput } from './types';

/**
 * Generate a complete exact score prediction (V1 model tag).
 *
 * This is the primary entry point for consumers of the prediction engine.
 * It takes lambdas as input and returns a fully-typed prediction result.
 *
 * @param input - lambdaHome, lambdaAway, optional maxGoals override
 * @returns Complete prediction with exact scores, 1X2, O/U, BTTS
 * @throws Error if lambdas are invalid
 */
export function predictExactScores(input: PredictionEngineInput): ExactScorePrediction {
  return predictWithModel(input, MODEL_POISSON_V1);
}

/**
 * Generate a complete exact score prediction (V2 model tag).
 * Uses the same Poisson engine but tags it as V2 for comparison.
 */
export function predictExactScoresV2(input: PredictionEngineInput): ExactScorePrediction {
  return predictWithModel(input, MODEL_POISSON_V2);
}

function predictWithModel(input: PredictionEngineInput, model: string): ExactScorePrediction {
  const { lambdaHome, lambdaAway, maxGoals = MAX_GOALS } = input;

  // Validate inputs
  if (!Number.isFinite(lambdaHome) || lambdaHome < 0) {
    throw new Error(`predictExactScores: invalid lambdaHome=${lambdaHome}`);
  }
  if (!Number.isFinite(lambdaAway) || lambdaAway < 0) {
    throw new Error(`predictExactScores: invalid lambdaAway=${lambdaAway}`);
  }
  if (!Number.isFinite(maxGoals) || maxGoals < 1 || maxGoals !== Math.floor(maxGoals)) {
    throw new Error(`predictExactScores: invalid maxGoals=${maxGoals}`);
  }

  const result = generateFullPrediction(lambdaHome, lambdaAway, maxGoals);

  return {
    model,
    expectedGoals: {
      home: lambdaHome,
      away: lambdaAway,
    },
    matchResult: result.matchResult,
    exactScores: result.exactScores,
    topExactScores: result.topExactScores,
    totals: result.totals,
    btts: result.btts,
    metadata: {
      model,
      maxGoals,
      totalProbabilityMass: result.totalMass,
      normalized: Math.abs(result.totalMass - 1.0) > 1e-10,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Score Matrix Generator
 *
 * Generates a complete probability matrix for all possible scorelines,
 * then derives market probabilities (1X2, Over/Under, BTTS) from it.
 *
 * The matrix is computed as:
 *   P(home=i, away=j) = P_home(i) * P_away(j)
 *
 * This assumes independence between home and away goals (standard Poisson).
 * Dixon-Coles correction (Phase 7) will adjust low-scoring outcomes.
 */

import { MAX_GOALS, OVER_UNDER_LINES, TOP_SCORES_COUNT, EPSILON } from './constants';
import { generateGoalDistribution } from './poisson';
import {
  ScoreMatrix,
  ExactScoreOutcome,
  MatchResultProbabilities,
  OverUnderLine,
  BTTSProbabilities,
} from './types';

/**
 * Generate the score probability matrix.
 *
 * matrix[i][j] = P(home scores i goals AND away scores j goals)
 *
 * @param homeDist - Goal distribution for home team
 * @param awayDist - Goal distribution for away team
 * @returns 2D array of joint probabilities
 */
export function generateScoreMatrix(
  homeDist: number[],
  awayDist: number[]
): ScoreMatrix {
  const rows = homeDist.length;
  const cols = awayDist.length;
  const matrix: ScoreMatrix = [];

  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(homeDist[i] * awayDist[j]);
    }
    matrix.push(row);
  }

  return matrix;
}

/**
 * Compute the total probability mass of the score matrix.
 * Should be close to 1.0 — any deviation is due to truncation.
 */
export function computeTotalMass(matrix: ScoreMatrix): number {
  let total = 0;
  for (const row of matrix) {
    for (const cell of row) {
      total += cell;
    }
  }
  return total;
}

/**
 * Extract all exact score outcomes from the matrix, sorted by probability descending.
 *
 * @param matrix - Score probability matrix
 * @param normalize - Whether to normalize probabilities to sum to 1
 * @returns Array of ExactScoreOutcome sorted by probability (highest first)
 */
export function extractExactScores(
  matrix: ScoreMatrix,
  normalize: boolean = true
): ExactScoreOutcome[] {
  const outcomes: ExactScoreOutcome[] = [];
  const totalMass = normalize ? computeTotalMass(matrix) : 1.0;

  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      const rawProb = matrix[i][j];
      const probability = normalize && totalMass > 0 ? rawProb / totalMass : rawProb;
      outcomes.push({
        homeGoals: i,
        awayGoals: j,
        score: `${i}-${j}`,
        probability,
      });
    }
  }

  // Sort by probability descending
  outcomes.sort((a, b) => b.probability - a.probability);
  return outcomes;
}

/**
 * Derive 1X2 match result probabilities from the score matrix.
 *
 * Home Win  = Σ P(i,j) where i > j
 * Draw      = Σ P(i,j) where i == j
 * Away Win  = Σ P(i,j) where i < j
 *
 * Results are normalized to sum to 1.
 */
export function deriveMatchResult(matrix: ScoreMatrix): MatchResultProbabilities {
  let home = 0;
  let draw = 0;
  let away = 0;

  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      const p = matrix[i][j];
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
    }
  }

  // Normalize
  const total = home + draw + away;
  if (total > 0 && Math.abs(total - 1.0) > EPSILON) {
    home /= total;
    draw /= total;
    away /= total;
  }

  return { home, draw, away };
}

/**
 * Derive Over/Under probabilities from the score matrix.
 *
 * Over X.5 = Σ P(i,j) where (i + j) > X.5  →  (i + j) >= X+1
 * Under X.5 = 1 - Over X.5
 */
export function deriveOverUnder(matrix: ScoreMatrix): OverUnderLine[] {
  const totalMass = computeTotalMass(matrix);
  const results: OverUnderLine[] = [];

  for (const line of OVER_UNDER_LINES) {
    let over = 0;
    const threshold = Math.ceil(line); // e.g., 2.5 → 3

    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        if (i + j >= threshold) {
          over += matrix[i][j];
        }
      }
    }

    // Normalize
    const overNorm = totalMass > 0 ? over / totalMass : 0;
    results.push({
      line,
      over: overNorm,
      under: 1.0 - overNorm,
    });
  }

  return results;
}

/**
 * Derive Both Teams To Score (BTTS) probabilities from the score matrix.
 *
 * BTTS Yes = Σ P(i,j) where i >= 1 AND j >= 1
 * BTTS No  = 1 - BTTS Yes
 */
export function deriveBTTS(matrix: ScoreMatrix): BTTSProbabilities {
  const totalMass = computeTotalMass(matrix);
  let bttsYes = 0;

  for (let i = 1; i < matrix.length; i++) {
    for (let j = 1; j < matrix[i].length; j++) {
      bttsYes += matrix[i][j];
    }
  }

  const yesNorm = totalMass > 0 ? bttsYes / totalMass : 0;
  return {
    yes: yesNorm,
    no: 1.0 - yesNorm,
  };
}

/**
 * Get the top N exact scores by probability.
 */
export function getTopScores(
  exactScores: ExactScoreOutcome[],
  count: number = TOP_SCORES_COUNT
): ExactScoreOutcome[] {
  return exactScores.slice(0, count);
}

/**
 * Full pipeline: generate all derived markets from lambda values.
 *
 * This is the main entry point for the score matrix module.
 *
 * @param lambdaHome - Expected goals for home team
 * @param lambdaAway - Expected goals for away team
 * @param maxGoals - Maximum goals per team (default: MAX_GOALS)
 * @returns All derived data: matrix, exact scores, 1X2, O/U, BTTS
 */
export function generateFullPrediction(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number = MAX_GOALS
) {
  const homeDist = generateGoalDistribution(lambdaHome, maxGoals);
  const awayDist = generateGoalDistribution(lambdaAway, maxGoals);
  const matrix = generateScoreMatrix(homeDist, awayDist);
  const totalMass = computeTotalMass(matrix);
  const exactScores = extractExactScores(matrix, true);
  const matchResult = deriveMatchResult(matrix);
  const totals = deriveOverUnder(matrix);
  const btts = deriveBTTS(matrix);
  const topExactScores = getTopScores(exactScores);

  return {
    matrix,
    homeDist,
    awayDist,
    totalMass,
    exactScores,
    topExactScores,
    matchResult,
    totals,
    btts,
  };
}

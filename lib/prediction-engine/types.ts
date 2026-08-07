/**
 * Prediction Engine Types
 *
 * All interfaces for the exact score prediction system.
 * These are independent of Sportmonks types to keep the engine decoupled.
 */

/** A single exact score outcome with its probability */
export interface ExactScoreOutcome {
  homeGoals: number;
  awayGoals: number;
  score: string; // e.g. "1-1"
  probability: number;
}

/** 1X2 match result probabilities */
export interface MatchResultProbabilities {
  home: number;
  draw: number;
  away: number;
}

/** Over/Under probabilities for a specific goal line */
export interface OverUnderLine {
  line: number; // e.g. 2.5
  over: number;
  under: number;
}

/** Both Teams To Score probabilities */
export interface BTTSProbabilities {
  yes: number;
  no: number;
}

/** Metadata about the prediction generation */
export interface PredictionMetadata {
  model: string;
  maxGoals: number;
  totalProbabilityMass: number; // Sum before normalization (should be ≈1)
  normalized: boolean; // Whether normalization was applied
  generatedAt: string; // ISO timestamp
}

/** Full output of the Exact Score Prediction Engine */
export interface ExactScorePrediction {
  /** Model version identifier */
  model: string;

  /** Expected goals (lambda) for each team */
  expectedGoals: {
    home: number;
    away: number;
  };

  /** 1X2 probabilities derived from the score matrix */
  matchResult: MatchResultProbabilities;

  /** All exact score outcomes (ordered by probability descending) */
  exactScores: ExactScoreOutcome[];

  /** Top N most probable exact scores */
  topExactScores: ExactScoreOutcome[];

  /** Over/Under probabilities for standard lines */
  totals: OverUnderLine[];

  /** Both Teams To Score */
  btts: BTTSProbabilities;

  /** Generation metadata */
  metadata: PredictionMetadata;
}

/** Input parameters for the engine */
export interface PredictionEngineInput {
  lambdaHome: number;
  lambdaAway: number;
  maxGoals?: number; // Override default MAX_GOALS
}

/** Goal distribution for a single team: P(goals = k) for k = 0..maxGoals */
export type GoalDistribution = number[];

/** Score matrix: matrix[homeGoals][awayGoals] = probability */
export type ScoreMatrix = number[][];

/**
 * Prediction Engine Constants
 *
 * Centralized configuration for the prediction models.
 * All tunable parameters live here — never hardcode magic numbers elsewhere.
 */

/** Maximum number of goals considered per team in the Poisson distribution.
 *  A 7x7 matrix (0–6) captures >99.5% of probability mass for typical lambdas. */
export const MAX_GOALS = 6;

/** Floating-point tolerance for probability sum validation */
export const EPSILON = 1e-8;

/** Model version identifiers — used for persistence and comparison */
export const MODEL_POISSON_V1 = 'POISSON_V1';
export const MODEL_POISSON_V2 = 'POISSON_V2';
export const MODEL_DIXON_COLES_V1 = 'DIXON_COLES_V1';
export const MODEL_HEURISTIC_V1 = 'HEURISTIC_V1';

/** Number of top exact scores to highlight in the UI */
export const TOP_SCORES_COUNT = 5;

/** Valid lambda range — values outside this indicate data issues */
export const LAMBDA_MIN = 0.0;
export const LAMBDA_MAX = 6.0;

/** Over/Under goal lines to calculate */
export const OVER_UNDER_LINES = [0.5, 1.5, 2.5, 3.5] as const;

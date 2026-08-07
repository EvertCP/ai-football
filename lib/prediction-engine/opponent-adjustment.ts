/**
 * Opponent Strength Adjustment
 *
 * Adjusts observed xG values based on the quality of the opponent faced.
 *
 * Rationale:
 *   2.0 xG against a weak defense (defenseWeakness = 1.5) is less impressive
 *   than 2.0 xG against a strong defense (defenseWeakness = 0.7).
 *
 * Formula:
 *   adjustedXG = observedXG / opponentDefenseWeakness
 *   adjustedXGA = observedXGA / opponentAttackStrength
 *
 * This normalizes performance to "league average opponent" context.
 *
 * CIRCURALITY PREVENTION:
 * We use a simple, non-iterative approach:
 * 1. Calculate raw (unadjusted) league averages first.
 * 2. Calculate raw team strengths relative to those averages.
 * 3. Use those raw strengths as opponent adjustments.
 * No iterative refinement — one pass only.
 * This is stable and sufficient for a non-ML model.
 */

/** Result of adjusting a match observation for opponent quality */
export interface AdjustedObservation {
  /** Original observed value */
  original: number;
  /** Adjusted value (normalized to league-average opponent) */
  adjusted: number;
  /** The opponent factor used for adjustment */
  opponentFactor: number;
}

/**
 * Adjust an observed xG value for opponent defensive quality.
 *
 * If the opponent has defenseWeakness = 1.5 (bad defense),
 * our xG against them is inflated → divide to normalize.
 *
 * @param observedXG - The xG scored in this match
 * @param opponentDefenseWeakness - Opponent's defensive weakness rating (1.0 = avg)
 * @returns Adjusted xG normalized to league-average opponent
 */
export function adjustXGForOpponent(
  observedXG: number,
  opponentDefenseWeakness: number
): AdjustedObservation {
  // Guard: if opponent data unavailable, return original
  if (!Number.isFinite(opponentDefenseWeakness) || opponentDefenseWeakness <= 0) {
    return { original: observedXG, adjusted: observedXG, opponentFactor: 1.0 };
  }

  return {
    original: observedXG,
    adjusted: observedXG / opponentDefenseWeakness,
    opponentFactor: opponentDefenseWeakness,
  };
}

/**
 * Adjust an observed xGA value for opponent attacking quality.
 *
 * If the opponent has attackStrength = 1.8 (strong attack),
 * our xGA against them is expected to be inflated → divide to normalize.
 *
 * @param observedXGA - The xGA (conceded) in this match
 * @param opponentAttackStrength - Opponent's attacking strength rating (1.0 = avg)
 * @returns Adjusted xGA normalized to league-average opponent
 */
export function adjustXGAForOpponent(
  observedXGA: number,
  opponentAttackStrength: number
): AdjustedObservation {
  if (!Number.isFinite(opponentAttackStrength) || opponentAttackStrength <= 0) {
    return { original: observedXGA, adjusted: observedXGA, opponentFactor: 1.0 };
  }

  return {
    original: observedXGA,
    adjusted: observedXGA / opponentAttackStrength,
    opponentFactor: opponentAttackStrength,
  };
}

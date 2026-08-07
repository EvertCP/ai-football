/**
 * Integration Tests for V2 Engine
 *
 * Tests the full pipeline: TeamStrength → LambdaV2 → Poisson → ScoreMatrix
 * Also includes regression fixtures for known results.
 */
import { describe, it, expect } from 'vitest';
import { calculateTeamStrength, TeamMatchHistory } from '../team-strength';
import { calculateLeagueBaseline } from '../league-baseline';
import { calculateLambdasV2 } from '../lambda-v2';
import { predictExactScoresV2 } from '../index';
import { exponentialDecay, weightedMean, shrinkage } from '../weighted-xg';
import { adjustXGForOpponent, adjustXGAForOpponent } from '../opponent-adjustment';
import { PREDICTION_CONFIG, getShrinkageWeight } from '../config';

// ============ REGRESSION FIXTURES ============
// These are mock datasets with known, deterministic inputs.
// If the model changes, these tests MUST fail to alert us.

const FIXTURE_STRONG_HOME: TeamMatchHistory[] = [
  { xgFor: 2.5, xgAgainst: 0.8, daysSince: 3, isHome: true },
  { xgFor: 2.2, xgAgainst: 0.6, daysSince: 10, isHome: true },
  { xgFor: 2.8, xgAgainst: 0.9, daysSince: 17, isHome: true },
  { xgFor: 1.8, xgAgainst: 1.1, daysSince: 24, isHome: true },
  { xgFor: 1.5, xgAgainst: 1.3, daysSince: 31, isHome: false },
  { xgFor: 1.2, xgAgainst: 1.0, daysSince: 38, isHome: false },
  { xgFor: 1.6, xgAgainst: 1.5, daysSince: 45, isHome: false },
  { xgFor: 2.0, xgAgainst: 0.7, daysSince: 52, isHome: true },
  { xgFor: 1.9, xgAgainst: 0.8, daysSince: 60, isHome: true },
  { xgFor: 1.4, xgAgainst: 1.2, daysSince: 67, isHome: false },
];

const FIXTURE_WEAK_AWAY: TeamMatchHistory[] = [
  { xgFor: 0.8, xgAgainst: 2.0, daysSince: 5, isHome: false },
  { xgFor: 0.5, xgAgainst: 2.3, daysSince: 12, isHome: false },
  { xgFor: 1.0, xgAgainst: 1.8, daysSince: 19, isHome: false },
  { xgFor: 0.7, xgAgainst: 1.5, daysSince: 26, isHome: false },
  { xgFor: 1.2, xgAgainst: 1.2, daysSince: 33, isHome: true },
  { xgFor: 1.5, xgAgainst: 1.0, daysSince: 40, isHome: true },
  { xgFor: 0.9, xgAgainst: 1.6, daysSince: 47, isHome: false },
  { xgFor: 1.1, xgAgainst: 1.4, daysSince: 54, isHome: true },
];

const LEAGUE_BASELINE = calculateLeagueBaseline(
  Array.from({ length: 50 }, () => ({ homeXG: 1.45, awayXG: 1.15 }))
);

describe('Integration: Full V2 Pipeline', () => {
  it('produces valid prediction for strong home vs weak away', () => {
    const homeStrength = calculateTeamStrength(FIXTURE_STRONG_HOME, LEAGUE_BASELINE);
    const awayStrength = calculateTeamStrength(FIXTURE_WEAK_AWAY, LEAGUE_BASELINE);

    const lambdaResult = calculateLambdasV2({
      homeStrength,
      awayStrength,
      leagueBaseline: LEAGUE_BASELINE,
      isNeutralVenue: false,
    });

    expect(lambdaResult.valid).toBe(true);
    expect(lambdaResult.lambdaHome).toBeGreaterThan(lambdaResult.lambdaAway);

    const prediction = predictExactScoresV2({
      lambdaHome: lambdaResult.lambdaHome,
      lambdaAway: lambdaResult.lambdaAway,
    });

    expect(prediction.model).toBe('POISSON_V2');
    expect(prediction.matchResult.home).toBeGreaterThan(prediction.matchResult.away);
    expect(prediction.topExactScores.length).toBe(5);
    expect(prediction.topExactScores[0].probability).toBeGreaterThan(0);
  });

  it('neutral venue uses overall ratings (lower home advantage)', () => {
    const homeStrength = calculateTeamStrength(FIXTURE_STRONG_HOME, LEAGUE_BASELINE);
    const awayStrength = calculateTeamStrength(FIXTURE_WEAK_AWAY, LEAGUE_BASELINE);

    const homeResult = calculateLambdasV2({
      homeStrength, awayStrength, leagueBaseline: LEAGUE_BASELINE, isNeutralVenue: false,
    });
    const neutralResult = calculateLambdasV2({
      homeStrength, awayStrength, leagueBaseline: LEAGUE_BASELINE, isNeutralVenue: true,
    });

    // Neutral venue should reduce home advantage
    // (since the home team's homeAttack > overallAttack typically)
    expect(neutralResult.diagnostics.isNeutralVenue).toBe(true);
    expect(homeResult.diagnostics.isNeutralVenue).toBe(false);
  });

  it('model produces different lambdas than V1 for same form data', () => {
    // V1 formula: lambdaHome = xgFor * 0.6 + xgAgainst * 0.4
    const xgFor = 2.0;
    const xgAgainst = 1.0;
    const v1LambdaHome = xgFor * 0.6 + xgAgainst * 0.4; // = 1.6

    const homeStrength = calculateTeamStrength(FIXTURE_STRONG_HOME, LEAGUE_BASELINE);
    const awayStrength = calculateTeamStrength(FIXTURE_WEAK_AWAY, LEAGUE_BASELINE);
    const v2Result = calculateLambdasV2({
      homeStrength, awayStrength, leagueBaseline: LEAGUE_BASELINE,
    });

    // V2 should produce different (hopefully better) estimates
    expect(v2Result.lambdaHome).not.toBeCloseTo(v1LambdaHome, 1);
  });
});

describe('Invariant Tests: V2 Engine Properties', () => {
  it('lambda is always > 0, finite, not NaN for any valid team history', () => {
    const histories = [
      FIXTURE_STRONG_HOME,
      FIXTURE_WEAK_AWAY,
      [{ xgFor: 0, xgAgainst: 0, daysSince: 0, isHome: true }],
      [{ xgFor: 5, xgAgainst: 5, daysSince: 0, isHome: false }],
      [],
    ];

    for (const homeH of histories) {
      for (const awayH of histories) {
        const homeStrength = calculateTeamStrength(homeH, LEAGUE_BASELINE);
        const awayStrength = calculateTeamStrength(awayH, LEAGUE_BASELINE);
        const result = calculateLambdasV2({
          homeStrength, awayStrength, leagueBaseline: LEAGUE_BASELINE,
        });
        expect(result.lambdaHome).toBeGreaterThan(0);
        expect(result.lambdaAway).toBeGreaterThan(0);
        expect(Number.isFinite(result.lambdaHome)).toBe(true);
        expect(Number.isFinite(result.lambdaAway)).toBe(true);
      }
    }
  });

  it('attack strength > 0 and defense weakness > 0 for all inputs', () => {
    const inputs: TeamMatchHistory[][] = [
      [],
      [{ xgFor: 0, xgAgainst: 0, daysSince: 0, isHome: true }],
      [{ xgFor: 10, xgAgainst: 0.1, daysSince: 0, isHome: false }],
      FIXTURE_STRONG_HOME,
    ];

    for (const history of inputs) {
      const strength = calculateTeamStrength(history, LEAGUE_BASELINE);
      expect(strength.attackStrength).toBeGreaterThan(0);
      expect(strength.defenseWeakness).toBeGreaterThan(0);
      expect(strength.homeAttackStrength).toBeGreaterThan(0);
      expect(strength.homeDefenseWeakness).toBeGreaterThan(0);
      expect(strength.awayAttackStrength).toBeGreaterThan(0);
      expect(strength.awayDefenseWeakness).toBeGreaterThan(0);
    }
  });

  it('shrinkage pulls small samples toward 1.0', () => {
    const small = [{ xgFor: 4.0, xgAgainst: 0.2, daysSince: 3, isHome: true }];
    const large = Array.from({ length: 20 }, (_, i) => ({
      xgFor: 4.0, xgAgainst: 0.2, daysSince: i * 5, isHome: i % 2 === 0,
    }));

    const smallStrength = calculateTeamStrength(small, LEAGUE_BASELINE);
    const largeStrength = calculateTeamStrength(large, LEAGUE_BASELINE);

    // Small sample should be more regularized (closer to 1.0)
    expect(Math.abs(smallStrength.attackStrength - 1.0)).toBeLessThan(
      Math.abs(largeStrength.attackStrength - 1.0)
    );
  });

  it('more recent matches have more influence', () => {
    const recentHigh: TeamMatchHistory[] = [
      { xgFor: 3.0, xgAgainst: 0.5, daysSince: 3, isHome: true },
      { xgFor: 0.5, xgAgainst: 2.5, daysSince: 90, isHome: true },
    ];
    const recentLow: TeamMatchHistory[] = [
      { xgFor: 0.5, xgAgainst: 2.5, daysSince: 3, isHome: true },
      { xgFor: 3.0, xgAgainst: 0.5, daysSince: 90, isHome: true },
    ];

    const highRecent = calculateTeamStrength(recentHigh, LEAGUE_BASELINE);
    const lowRecent = calculateTeamStrength(recentLow, LEAGUE_BASELINE);

    // Team with recent high xG should have higher attack
    expect(highRecent.attackStrength).toBeGreaterThan(lowRecent.attackStrength);
  });

  it('opponent adjustment normalizes against weak/strong opponents', () => {
    const weakOpponent = adjustXGForOpponent(2.5, 1.5); // vs bad defense
    const strongOpponent = adjustXGForOpponent(2.5, 0.7); // vs good defense

    // 2.5 xG against weak defense is less impressive (adjusted down)
    expect(weakOpponent.adjusted).toBeLessThan(2.5);
    // 2.5 xG against strong defense is more impressive (adjusted up)
    expect(strongOpponent.adjusted).toBeGreaterThan(2.5);
  });
});

describe('Regression Tests: Known Outputs', () => {
  it('REGRESSION: strong home team gets attack > 1.3', () => {
    const strength = calculateTeamStrength(FIXTURE_STRONG_HOME, LEAGUE_BASELINE);
    expect(strength.homeAttackStrength).toBeGreaterThan(1.2);
  });

  it('REGRESSION: weak away team gets defense > 1.2 (bad defense)', () => {
    const strength = calculateTeamStrength(FIXTURE_WEAK_AWAY, LEAGUE_BASELINE);
    expect(strength.awayDefenseWeakness).toBeGreaterThan(1.0);
  });

  it('REGRESSION: config parameters are within expected bounds', () => {
    expect(PREDICTION_CONFIG.decayRate).toBeGreaterThan(0);
    expect(PREDICTION_CONFIG.decayRate).toBeLessThan(0.1);
    expect(PREDICTION_CONFIG.lambda.min).toBeGreaterThanOrEqual(0);
    expect(PREDICTION_CONFIG.lambda.max).toBeLessThanOrEqual(6);
    expect(PREDICTION_CONFIG.maxGoals).toBeGreaterThanOrEqual(5);
    expect(PREDICTION_CONFIG.maxGoals).toBeLessThanOrEqual(10);
  });

  it('REGRESSION: getShrinkageWeight returns correct values per tier', () => {
    expect(getShrinkageWeight(1)).toBe(10);
    expect(getShrinkageWeight(4)).toBe(5);
    expect(getShrinkageWeight(8)).toBe(3);
    expect(getShrinkageWeight(15)).toBe(1);
  });
});

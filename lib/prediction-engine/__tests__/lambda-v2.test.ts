import { describe, it, expect } from 'vitest';
import { calculateLambdasV2, LambdaV2Input } from '../lambda-v2';
import { TeamStrength } from '../team-strength';
import { LeagueBaseline } from '../league-baseline';

const makeTeamStrength = (overrides: Partial<TeamStrength> = {}): TeamStrength => ({
  attackStrength: 1.0,
  defenseWeakness: 1.0,
  homeAttackStrength: 1.0,
  homeDefenseWeakness: 1.0,
  awayAttackStrength: 1.0,
  awayDefenseWeakness: 1.0,
  metadata: {
    totalMatches: 10,
    homeMatches: 5,
    awayMatches: 5,
    regularized: false,
    fallbackUsed: null,
  },
  ...overrides,
});

const defaultBaseline: LeagueBaseline = {
  avgHomeXG: 1.45,
  avgAwayXG: 1.15,
  matchCount: 100,
  reliable: true,
};

describe('calculateLambdasV2', () => {
  it('returns league averages for average teams (all strengths = 1.0)', () => {
    const input: LambdaV2Input = {
      homeStrength: makeTeamStrength(),
      awayStrength: makeTeamStrength(),
      leagueBaseline: defaultBaseline,
    };
    const result = calculateLambdasV2(input);
    expect(result.lambdaHome).toBeCloseTo(1.45, 2);
    expect(result.lambdaAway).toBeCloseTo(1.15, 2);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('increases lambda for strong attack vs weak defense', () => {
    const input: LambdaV2Input = {
      homeStrength: makeTeamStrength({ homeAttackStrength: 1.5 }),
      awayStrength: makeTeamStrength({ awayDefenseWeakness: 1.3 }),
      leagueBaseline: defaultBaseline,
    };
    const result = calculateLambdasV2(input);
    // 1.45 * 1.5 * 1.3 = 2.8275
    expect(result.lambdaHome).toBeGreaterThan(2.5);
    expect(result.valid).toBe(true);
  });

  it('decreases lambda for weak attack vs strong defense', () => {
    const input: LambdaV2Input = {
      homeStrength: makeTeamStrength({ homeAttackStrength: 0.6 }),
      awayStrength: makeTeamStrength({ awayDefenseWeakness: 0.7 }),
      leagueBaseline: defaultBaseline,
    };
    const result = calculateLambdasV2(input);
    // 1.45 * 0.6 * 0.7 = 0.609
    expect(result.lambdaHome).toBeLessThan(0.7);
    expect(result.valid).toBe(true);
  });

  it('uses overall ratings for neutral venue', () => {
    const home = makeTeamStrength({
      attackStrength: 1.2,
      homeAttackStrength: 1.8,
    });
    const away = makeTeamStrength({
      defenseWeakness: 1.1,
      awayDefenseWeakness: 1.5,
    });
    const input: LambdaV2Input = {
      homeStrength: home,
      awayStrength: away,
      leagueBaseline: defaultBaseline,
      isNeutralVenue: true,
    };
    const result = calculateLambdasV2(input);
    // Should use overall (1.2 * 1.1) not home/away (1.8 * 1.5)
    expect(result.diagnostics.homeAttack).toBe(1.2);
    expect(result.diagnostics.awayDefense).toBe(1.1);
    expect(result.diagnostics.isNeutralVenue).toBe(true);
  });

  it('applies form factor', () => {
    const input: LambdaV2Input = {
      homeStrength: makeTeamStrength(),
      awayStrength: makeTeamStrength(),
      leagueBaseline: defaultBaseline,
      homeFormFactor: 1.2,
      awayFormFactor: 0.8,
    };
    const result = calculateLambdasV2(input);
    expect(result.lambdaHome).toBeGreaterThan(1.45);
    expect(result.lambdaAway).toBeLessThan(1.15);
  });

  it('clamps form factor to [0.7, 1.3]', () => {
    const input: LambdaV2Input = {
      homeStrength: makeTeamStrength(),
      awayStrength: makeTeamStrength(),
      leagueBaseline: defaultBaseline,
      homeFormFactor: 2.0,
      awayFormFactor: 0.1,
    };
    const result = calculateLambdasV2(input);
    expect(result.diagnostics.homeFormFactor).toBe(1.3);
    expect(result.diagnostics.awayFormFactor).toBe(0.7);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('clamps lambda to valid range', () => {
    const input: LambdaV2Input = {
      homeStrength: makeTeamStrength({ homeAttackStrength: 3.5 }),
      awayStrength: makeTeamStrength({ awayDefenseWeakness: 3.5 }),
      leagueBaseline: defaultBaseline,
      homeFormFactor: 1.3,
    };
    const result = calculateLambdasV2(input);
    expect(result.lambdaHome).toBeLessThanOrEqual(4.5);
    expect(result.diagnostics.clampedHome).toBe(true);
  });

  it('uses defaults when league baseline unreliable', () => {
    const unreliable: LeagueBaseline = {
      avgHomeXG: 0, avgAwayXG: 0, matchCount: 0, reliable: false,
    };
    const input: LambdaV2Input = {
      homeStrength: makeTeamStrength(),
      awayStrength: makeTeamStrength(),
      leagueBaseline: unreliable,
    };
    const result = calculateLambdasV2(input);
    expect(result.metadata.fallbacks).toContain('LEAGUE_DEFAULT');
    expect(result.lambdaHome).toBeGreaterThan(0);
    expect(result.lambdaAway).toBeGreaterThan(0);
  });

  it('diagnostics include all calculation components', () => {
    const input: LambdaV2Input = {
      homeStrength: makeTeamStrength({ homeAttackStrength: 1.3 }),
      awayStrength: makeTeamStrength({ awayDefenseWeakness: 1.1, awayAttackStrength: 0.9 }),
      leagueBaseline: defaultBaseline,
    };
    const result = calculateLambdasV2(input);
    expect(result.diagnostics.leagueAvgHomeXG).toBe(1.45);
    expect(result.diagnostics.leagueAvgAwayXG).toBe(1.15);
    expect(result.diagnostics.homeAttack).toBe(1.3);
    expect(result.diagnostics.awayDefense).toBe(1.1);
    expect(result.diagnostics.model).toBe('POISSON_V2');
  });

  it('lambda is always > 0, finite, and not NaN', () => {
    const extremes = [0.1, 0.5, 1.0, 2.0, 3.5];
    for (const a of extremes) {
      for (const d of extremes) {
        const input: LambdaV2Input = {
          homeStrength: makeTeamStrength({ homeAttackStrength: a }),
          awayStrength: makeTeamStrength({ awayDefenseWeakness: d }),
          leagueBaseline: defaultBaseline,
        };
        const result = calculateLambdasV2(input);
        expect(result.lambdaHome).toBeGreaterThan(0);
        expect(result.lambdaAway).toBeGreaterThan(0);
        expect(Number.isFinite(result.lambdaHome)).toBe(true);
        expect(Number.isFinite(result.lambdaAway)).toBe(true);
      }
    }
  });
});

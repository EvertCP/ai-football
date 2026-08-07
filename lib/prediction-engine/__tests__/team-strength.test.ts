import { describe, it, expect } from 'vitest';
import { calculateTeamStrength, TeamMatchHistory } from '../team-strength';
import { LeagueBaseline } from '../league-baseline';

const defaultBaseline: LeagueBaseline = {
  avgHomeXG: 1.5,
  avgAwayXG: 1.2,
  matchCount: 100,
  reliable: true,
};

function makeHistory(overrides: Partial<TeamMatchHistory>[] = []): TeamMatchHistory[] {
  const defaults: TeamMatchHistory = {
    xgFor: 1.5,
    xgAgainst: 1.2,
    daysSince: 10,
    isHome: true,
  };
  return overrides.map(o => ({ ...defaults, ...o }));
}

describe('calculateTeamStrength', () => {
  it('returns ~1.0 ratings for team that is exactly league average', () => {
    const history = makeHistory([
      { xgFor: 1.5, xgAgainst: 1.2, isHome: true, daysSince: 5 },
      { xgFor: 1.5, xgAgainst: 1.2, isHome: true, daysSince: 10 },
      { xgFor: 1.5, xgAgainst: 1.2, isHome: true, daysSince: 15 },
      { xgFor: 1.5, xgAgainst: 1.2, isHome: true, daysSince: 20 },
      { xgFor: 1.5, xgAgainst: 1.2, isHome: true, daysSince: 25 },
      { xgFor: 1.2, xgAgainst: 1.5, isHome: false, daysSince: 8 },
      { xgFor: 1.2, xgAgainst: 1.5, isHome: false, daysSince: 12 },
      { xgFor: 1.2, xgAgainst: 1.5, isHome: false, daysSince: 18 },
      { xgFor: 1.2, xgAgainst: 1.5, isHome: false, daysSince: 22 },
      { xgFor: 1.2, xgAgainst: 1.5, isHome: false, daysSince: 28 },
    ]);
    const result = calculateTeamStrength(history, defaultBaseline);
    expect(result.attackStrength).toBeCloseTo(1.0, 1);
    expect(result.defenseWeakness).toBeCloseTo(1.0, 1);
  });

  it('returns high attack for team that outscores league average', () => {
    const history = makeHistory([
      { xgFor: 3.0, xgAgainst: 0.8, isHome: true, daysSince: 3 },
      { xgFor: 2.8, xgAgainst: 0.9, isHome: true, daysSince: 7 },
      { xgFor: 2.5, xgAgainst: 1.0, isHome: true, daysSince: 14 },
      { xgFor: 2.5, xgAgainst: 0.5, isHome: false, daysSince: 5 },
      { xgFor: 2.0, xgAgainst: 0.7, isHome: false, daysSince: 10 },
      { xgFor: 2.2, xgAgainst: 0.6, isHome: false, daysSince: 17 },
    ]);
    const result = calculateTeamStrength(history, defaultBaseline);
    expect(result.attackStrength).toBeGreaterThan(1.3);
    expect(result.defenseWeakness).toBeLessThan(0.8);
  });

  it('applies shrinkage with small sample sizes', () => {
    const smallSample = makeHistory([
      { xgFor: 4.0, xgAgainst: 0.3, isHome: true, daysSince: 3 },
    ]);
    const largeSample = makeHistory(
      Array.from({ length: 15 }, (_, i) => ({
        xgFor: 4.0, xgAgainst: 0.3, isHome: i % 2 === 0, daysSince: i * 5,
      }))
    );

    const small = calculateTeamStrength(smallSample, defaultBaseline);
    const large = calculateTeamStrength(largeSample, defaultBaseline);

    // Small sample should be pulled more toward 1.0
    expect(small.attackStrength).toBeLessThan(large.attackStrength);
    expect(small.metadata.regularized).toBe(true);
  });

  it('produces separate home/away ratings', () => {
    const history = makeHistory([
      { xgFor: 3.0, xgAgainst: 0.5, isHome: true, daysSince: 5 },
      { xgFor: 2.8, xgAgainst: 0.6, isHome: true, daysSince: 12 },
      { xgFor: 2.5, xgAgainst: 0.7, isHome: true, daysSince: 20 },
      { xgFor: 0.8, xgAgainst: 2.0, isHome: false, daysSince: 7 },
      { xgFor: 0.7, xgAgainst: 2.2, isHome: false, daysSince: 15 },
      { xgFor: 0.9, xgAgainst: 1.8, isHome: false, daysSince: 22 },
    ]);
    const result = calculateTeamStrength(history, defaultBaseline);
    // Home attack should be much higher than away attack
    expect(result.homeAttackStrength).toBeGreaterThan(result.awayAttackStrength);
    // Home defense should be better (lower weakness) than away
    expect(result.homeDefenseWeakness).toBeLessThan(result.awayDefenseWeakness);
  });

  it('returns 1.0 (neutral) with empty history', () => {
    const result = calculateTeamStrength([], defaultBaseline);
    expect(result.attackStrength).toBeCloseTo(1.0, 1);
    expect(result.defenseWeakness).toBeCloseTo(1.0, 1);
    expect(result.metadata.fallbackUsed).toBe('NO_DATA');
  });

  it('all ratings are > 0 and finite', () => {
    const history = makeHistory([
      { xgFor: 0.1, xgAgainst: 3.5, isHome: true, daysSince: 2 },
      { xgFor: 0.0, xgAgainst: 4.0, isHome: false, daysSince: 5 },
    ]);
    const result = calculateTeamStrength(history, defaultBaseline);
    expect(result.attackStrength).toBeGreaterThan(0);
    expect(result.defenseWeakness).toBeGreaterThan(0);
    expect(Number.isFinite(result.attackStrength)).toBe(true);
    expect(Number.isFinite(result.defenseWeakness)).toBe(true);
  });

  it('reports metadata correctly', () => {
    const history = makeHistory([
      { xgFor: 1.5, isHome: true, daysSince: 3 },
      { xgFor: 1.5, isHome: true, daysSince: 8 },
      { xgFor: 1.2, isHome: false, daysSince: 5 },
    ]);
    const result = calculateTeamStrength(history, defaultBaseline);
    expect(result.metadata.totalMatches).toBe(3);
    expect(result.metadata.homeMatches).toBe(2);
    expect(result.metadata.awayMatches).toBe(1);
  });
});

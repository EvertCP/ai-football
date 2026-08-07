import { describe, it, expect } from 'vitest';
import { predictExactScores } from '../index';
import { EPSILON } from '../constants';

/**
 * Property / Invariant Tests
 *
 * These tests verify mathematical invariants that must hold
 * for ANY valid combination of lambdas.
 */

const LAMBDA_VALUES = [0.2, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0];

describe('Invariant Tests — Mathematical Properties', () => {
  for (const lambdaH of LAMBDA_VALUES) {
    for (const lambdaA of LAMBDA_VALUES) {
      describe(`lambda_home=${lambdaH}, lambda_away=${lambdaA}`, () => {
        const prediction = predictExactScores({
          lambdaHome: lambdaH,
          lambdaAway: lambdaA,
        });

        it('all exact score probabilities are between 0 and 1', () => {
          for (const score of prediction.exactScores) {
            expect(score.probability).toBeGreaterThanOrEqual(0);
            expect(score.probability).toBeLessThanOrEqual(1);
          }
        });

        it('sum of all exact score probabilities ≈ 1', () => {
          const sum = prediction.exactScores.reduce((acc, s) => acc + s.probability, 0);
          expect(Math.abs(sum - 1.0)).toBeLessThan(EPSILON);
        });

        it('Home + Draw + Away ≈ 1', () => {
          const { home, draw, away } = prediction.matchResult;
          const sum = home + draw + away;
          expect(Math.abs(sum - 1.0)).toBeLessThan(EPSILON);
        });

        it('all 1X2 probabilities are between 0 and 1', () => {
          expect(prediction.matchResult.home).toBeGreaterThanOrEqual(0);
          expect(prediction.matchResult.home).toBeLessThanOrEqual(1);
          expect(prediction.matchResult.draw).toBeGreaterThanOrEqual(0);
          expect(prediction.matchResult.draw).toBeLessThanOrEqual(1);
          expect(prediction.matchResult.away).toBeGreaterThanOrEqual(0);
          expect(prediction.matchResult.away).toBeLessThanOrEqual(1);
        });

        it('BTTS Yes + No ≈ 1', () => {
          const sum = prediction.btts.yes + prediction.btts.no;
          expect(Math.abs(sum - 1.0)).toBeLessThan(EPSILON);
        });

        it('Over + Under ≈ 1 for each goal line', () => {
          for (const line of prediction.totals) {
            const sum = line.over + line.under;
            expect(Math.abs(sum - 1.0)).toBeLessThan(EPSILON);
          }
        });

        it('Over probabilities decrease as line increases', () => {
          for (let i = 1; i < prediction.totals.length; i++) {
            expect(prediction.totals[i].over).toBeLessThanOrEqual(
              prediction.totals[i - 1].over + EPSILON
            );
          }
        });

        it('exact scores are sorted by probability descending', () => {
          for (let i = 1; i < prediction.exactScores.length; i++) {
            expect(prediction.exactScores[i].probability).toBeLessThanOrEqual(
              prediction.exactScores[i - 1].probability + EPSILON
            );
          }
        });

        it('topExactScores is subset of exactScores and has length 5', () => {
          expect(prediction.topExactScores).toHaveLength(5);
          for (const top of prediction.topExactScores) {
            const found = prediction.exactScores.find(
              s => s.score === top.score && Math.abs(s.probability - top.probability) < EPSILON
            );
            expect(found).toBeDefined();
          }
        });

        it('metadata reports correct maxGoals', () => {
          expect(prediction.metadata.maxGoals).toBe(6);
        });

        it('metadata totalProbabilityMass is reasonable', () => {
          expect(prediction.metadata.totalProbabilityMass).toBeGreaterThan(0.5);
          expect(prediction.metadata.totalProbabilityMass).toBeLessThanOrEqual(1.0);
        });
      });
    }
  }

  describe('Symmetry: equal lambdas on neutral ground', () => {
    for (const lambda of LAMBDA_VALUES) {
      it(`lambda=${lambda}: Home ≈ Away probability`, () => {
        const prediction = predictExactScores({
          lambdaHome: lambda,
          lambdaAway: lambda,
        });
        const diff = Math.abs(prediction.matchResult.home - prediction.matchResult.away);
        expect(diff).toBeLessThan(EPSILON);
      });
    }
  });
});

describe('Edge Cases', () => {
  it('should throw for negative lambdaHome', () => {
    expect(() => predictExactScores({ lambdaHome: -1, lambdaAway: 1.5 })).toThrow();
  });

  it('should throw for negative lambdaAway', () => {
    expect(() => predictExactScores({ lambdaHome: 1.5, lambdaAway: -1 })).toThrow();
  });

  it('should throw for NaN lambdaHome', () => {
    expect(() => predictExactScores({ lambdaHome: NaN, lambdaAway: 1.5 })).toThrow();
  });

  it('should throw for NaN lambdaAway', () => {
    expect(() => predictExactScores({ lambdaHome: 1.5, lambdaAway: NaN })).toThrow();
  });

  it('should throw for Infinity lambdaHome', () => {
    expect(() => predictExactScores({ lambdaHome: Infinity, lambdaAway: 1.5 })).toThrow();
  });

  it('should throw for invalid maxGoals', () => {
    expect(() => predictExactScores({ lambdaHome: 1.5, lambdaAway: 1.5, maxGoals: 0 })).toThrow();
    expect(() => predictExactScores({ lambdaHome: 1.5, lambdaAway: 1.5, maxGoals: -1 })).toThrow();
    expect(() => predictExactScores({ lambdaHome: 1.5, lambdaAway: 1.5, maxGoals: 2.5 })).toThrow();
  });

  it('should handle lambda=0 (team never scores)', () => {
    const prediction = predictExactScores({ lambdaHome: 0, lambdaAway: 1.5 });
    // Home should never score, so all outcomes have homeGoals=0
    const nonZeroHome = prediction.exactScores.filter(
      s => s.homeGoals > 0 && s.probability > EPSILON
    );
    expect(nonZeroHome).toHaveLength(0);
    // Away win should dominate
    expect(prediction.matchResult.away).toBeGreaterThan(prediction.matchResult.home);
  });

  it('should handle both lambdas=0', () => {
    const prediction = predictExactScores({ lambdaHome: 0, lambdaAway: 0 });
    // Only 0-0 should have probability
    expect(prediction.exactScores[0].score).toBe('0-0');
    expect(prediction.exactScores[0].probability).toBeCloseTo(1.0, 5);
    expect(prediction.matchResult.draw).toBeCloseTo(1.0, 5);
  });

  it('should work with custom maxGoals', () => {
    const prediction = predictExactScores({ lambdaHome: 1.5, lambdaAway: 1.5, maxGoals: 3 });
    expect(prediction.exactScores).toHaveLength(16); // 4x4
    expect(prediction.metadata.maxGoals).toBe(3);
  });
});

describe('Specific Mathematical Validation — lambda_h=1.68, lambda_a=1.57', () => {
  const prediction = predictExactScores({ lambdaHome: 1.68, lambdaAway: 1.57 });

  it('no probability is negative', () => {
    for (const s of prediction.exactScores) {
      expect(s.probability).toBeGreaterThanOrEqual(0);
    }
  });

  it('no probability is > 1', () => {
    for (const s of prediction.exactScores) {
      expect(s.probability).toBeLessThanOrEqual(1);
    }
  });

  it('sum of score matrix ≈ 1', () => {
    const sum = prediction.exactScores.reduce((acc, s) => acc + s.probability, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(EPSILON);
  });

  it('Home + Draw + Away ≈ 1', () => {
    const { home, draw, away } = prediction.matchResult;
    expect(Math.abs(home + draw + away - 1.0)).toBeLessThan(EPSILON);
  });

  it('BTTS Yes + No ≈ 1', () => {
    expect(Math.abs(prediction.btts.yes + prediction.btts.no - 1.0)).toBeLessThan(EPSILON);
  });

  it('Over + Under ≈ 1 for each line', () => {
    for (const line of prediction.totals) {
      expect(Math.abs(line.over + line.under - 1.0)).toBeLessThan(EPSILON);
    }
  });

  it('model is POISSON_V1', () => {
    expect(prediction.model).toBe('POISSON_V1');
  });

  it('expectedGoals are correct', () => {
    expect(prediction.expectedGoals.home).toBe(1.68);
    expect(prediction.expectedGoals.away).toBe(1.57);
  });

  it('home has slight edge (lambdaHome > lambdaAway)', () => {
    expect(prediction.matchResult.home).toBeGreaterThan(prediction.matchResult.away);
  });
});

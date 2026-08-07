import { describe, it, expect } from 'vitest';
import {
  generateScoreMatrix,
  computeTotalMass,
  extractExactScores,
  deriveMatchResult,
  deriveOverUnder,
  deriveBTTS,
  getTopScores,
  generateFullPrediction,
} from '../score-matrix';
import { generateGoalDistribution } from '../poisson';
import { EPSILON } from '../constants';

describe('generateScoreMatrix', () => {
  it('should create matrix with correct dimensions', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);

    expect(matrix).toHaveLength(7);
    matrix.forEach(row => expect(row).toHaveLength(7));
  });

  it('should have all non-negative values', () => {
    const homeDist = generateGoalDistribution(2.0, 6);
    const awayDist = generateGoalDistribution(1.0, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);

    for (const row of matrix) {
      for (const cell of row) {
        expect(cell).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should have no value > 1', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.5, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);

    for (const row of matrix) {
      for (const cell of row) {
        expect(cell).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('should produce P(0,0) = P_home(0) * P_away(0)', () => {
    const homeDist = generateGoalDistribution(1.68, 6);
    const awayDist = generateGoalDistribution(1.57, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);

    expect(matrix[0][0]).toBeCloseTo(homeDist[0] * awayDist[0], 10);
  });
});

describe('computeTotalMass', () => {
  it('should be close to 1 for typical lambdas', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const mass = computeTotalMass(matrix);

    expect(mass).toBeGreaterThan(0.98);
    expect(mass).toBeLessThanOrEqual(1.0);
  });

  it('should equal 1 when lambda=0 for both teams', () => {
    const homeDist = generateGoalDistribution(0, 6);
    const awayDist = generateGoalDistribution(0, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const mass = computeTotalMass(matrix);

    expect(mass).toBeCloseTo(1.0, 10);
  });
});

describe('extractExactScores', () => {
  it('should return correct number of outcomes', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const scores = extractExactScores(matrix);

    expect(scores).toHaveLength(49); // 7 * 7
  });

  it('should be sorted by probability descending', () => {
    const homeDist = generateGoalDistribution(1.68, 6);
    const awayDist = generateGoalDistribution(1.57, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const scores = extractExactScores(matrix);

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i].probability).toBeLessThanOrEqual(scores[i - 1].probability);
    }
  });

  it('should have normalized probabilities summing to ≈1', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const scores = extractExactScores(matrix, true);

    const sum = scores.reduce((acc, s) => acc + s.probability, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(EPSILON);
  });

  it('should format score strings correctly', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const scores = extractExactScores(matrix);

    const score11 = scores.find(s => s.homeGoals === 1 && s.awayGoals === 1);
    expect(score11?.score).toBe('1-1');

    const score00 = scores.find(s => s.homeGoals === 0 && s.awayGoals === 0);
    expect(score00?.score).toBe('0-0');
  });
});

describe('deriveMatchResult', () => {
  it('should have probabilities summing to ≈1', () => {
    const homeDist = generateGoalDistribution(1.68, 6);
    const awayDist = generateGoalDistribution(1.57, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const result = deriveMatchResult(matrix);

    const sum = result.home + result.draw + result.away;
    expect(Math.abs(sum - 1.0)).toBeLessThan(EPSILON);
  });

  it('should favor home when homeLambda > awayLambda', () => {
    const homeDist = generateGoalDistribution(2.5, 6);
    const awayDist = generateGoalDistribution(0.8, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const result = deriveMatchResult(matrix);

    expect(result.home).toBeGreaterThan(result.away);
    expect(result.home).toBeGreaterThan(result.draw);
  });

  it('should favor away when awayLambda > homeLambda', () => {
    const homeDist = generateGoalDistribution(0.8, 6);
    const awayDist = generateGoalDistribution(2.5, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const result = deriveMatchResult(matrix);

    expect(result.away).toBeGreaterThan(result.home);
  });

  it('should be symmetric when lambdas are equal', () => {
    const dist = generateGoalDistribution(1.5, 6);
    const matrix = generateScoreMatrix(dist, dist);
    const result = deriveMatchResult(matrix);

    // Home and Away should be approximately equal (symmetric)
    expect(Math.abs(result.home - result.away)).toBeLessThan(EPSILON);
  });

  it('should have all probabilities between 0 and 1', () => {
    const homeDist = generateGoalDistribution(1.68, 6);
    const awayDist = generateGoalDistribution(1.57, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const result = deriveMatchResult(matrix);

    expect(result.home).toBeGreaterThanOrEqual(0);
    expect(result.home).toBeLessThanOrEqual(1);
    expect(result.draw).toBeGreaterThanOrEqual(0);
    expect(result.draw).toBeLessThanOrEqual(1);
    expect(result.away).toBeGreaterThanOrEqual(0);
    expect(result.away).toBeLessThanOrEqual(1);
  });
});

describe('deriveOverUnder', () => {
  it('should return results for all standard lines', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const ou = deriveOverUnder(matrix);

    expect(ou).toHaveLength(4); // 0.5, 1.5, 2.5, 3.5
    expect(ou[0].line).toBe(0.5);
    expect(ou[1].line).toBe(1.5);
    expect(ou[2].line).toBe(2.5);
    expect(ou[3].line).toBe(3.5);
  });

  it('should have over + under ≈ 1 for each line', () => {
    const homeDist = generateGoalDistribution(1.68, 6);
    const awayDist = generateGoalDistribution(1.57, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const ou = deriveOverUnder(matrix);

    for (const line of ou) {
      expect(Math.abs(line.over + line.under - 1.0)).toBeLessThan(EPSILON);
    }
  });

  it('should have decreasing over probability as line increases', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const ou = deriveOverUnder(matrix);

    for (let i = 1; i < ou.length; i++) {
      expect(ou[i].over).toBeLessThan(ou[i - 1].over);
    }
  });

  it('should have all values between 0 and 1', () => {
    const homeDist = generateGoalDistribution(2.0, 6);
    const awayDist = generateGoalDistribution(2.0, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const ou = deriveOverUnder(matrix);

    for (const line of ou) {
      expect(line.over).toBeGreaterThanOrEqual(0);
      expect(line.over).toBeLessThanOrEqual(1);
      expect(line.under).toBeGreaterThanOrEqual(0);
      expect(line.under).toBeLessThanOrEqual(1);
    }
  });
});

describe('deriveBTTS', () => {
  it('should have yes + no ≈ 1', () => {
    const homeDist = generateGoalDistribution(1.68, 6);
    const awayDist = generateGoalDistribution(1.57, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const btts = deriveBTTS(matrix);

    expect(Math.abs(btts.yes + btts.no - 1.0)).toBeLessThan(EPSILON);
  });

  it('should have high BTTS yes when both lambdas are high', () => {
    const homeDist = generateGoalDistribution(2.5, 6);
    const awayDist = generateGoalDistribution(2.5, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const btts = deriveBTTS(matrix);

    expect(btts.yes).toBeGreaterThan(0.7);
  });

  it('should have low BTTS yes when one lambda is very low', () => {
    const homeDist = generateGoalDistribution(0.3, 6);
    const awayDist = generateGoalDistribution(2.0, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const btts = deriveBTTS(matrix);

    expect(btts.yes).toBeLessThan(0.5);
  });

  it('should be 0 when both lambdas are 0', () => {
    const homeDist = generateGoalDistribution(0, 6);
    const awayDist = generateGoalDistribution(0, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const btts = deriveBTTS(matrix);

    expect(btts.yes).toBe(0);
    expect(btts.no).toBe(1);
  });

  it('should have values between 0 and 1', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const btts = deriveBTTS(matrix);

    expect(btts.yes).toBeGreaterThanOrEqual(0);
    expect(btts.yes).toBeLessThanOrEqual(1);
    expect(btts.no).toBeGreaterThanOrEqual(0);
    expect(btts.no).toBeLessThanOrEqual(1);
  });
});

describe('getTopScores', () => {
  it('should return 5 scores by default', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const scores = extractExactScores(matrix);
    const top = getTopScores(scores);

    expect(top).toHaveLength(5);
  });

  it('should return the highest probability scores', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const scores = extractExactScores(matrix);
    const top = getTopScores(scores, 3);

    expect(top[0].probability).toBeGreaterThanOrEqual(top[1].probability);
    expect(top[1].probability).toBeGreaterThanOrEqual(top[2].probability);
  });

  it('should respect custom count parameter', () => {
    const homeDist = generateGoalDistribution(1.5, 6);
    const awayDist = generateGoalDistribution(1.3, 6);
    const matrix = generateScoreMatrix(homeDist, awayDist);
    const scores = extractExactScores(matrix);

    expect(getTopScores(scores, 10)).toHaveLength(10);
    expect(getTopScores(scores, 1)).toHaveLength(1);
  });
});

describe('generateFullPrediction', () => {
  it('should generate a complete prediction with typical lambdas', () => {
    const result = generateFullPrediction(1.68, 1.57);

    expect(result.matrix).toHaveLength(7);
    expect(result.exactScores).toHaveLength(49);
    expect(result.topExactScores).toHaveLength(5);
    expect(result.matchResult.home + result.matchResult.draw + result.matchResult.away).toBeCloseTo(1.0, 5);
    expect(result.btts.yes + result.btts.no).toBeCloseTo(1.0, 5);
    expect(result.totals).toHaveLength(4);
    expect(result.totalMass).toBeGreaterThan(0.95);
  });

  it('should produce realistic probabilities for 1-1 with lambdas ≈1.5', () => {
    const result = generateFullPrediction(1.68, 1.57);
    const score11 = result.exactScores.find(s => s.score === '1-1');
    // P(1-1) with lambda_h=1.68, lambda_a=1.57 should be roughly 9-12%
    expect(score11!.probability).toBeGreaterThan(0.08);
    expect(score11!.probability).toBeLessThan(0.15);
  });
});

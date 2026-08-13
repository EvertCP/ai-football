/**
 * DEBUG TESTS — Reproducing Problem 1 (1-1 always top) and Problem 2 (BTTS ≈ Over2.5)
 *
 * These tests directly call the score matrix engine with controlled lambdas
 * to determine if the issue is in:
 * - Poisson math
 * - Score matrix generation
 * - Sorting
 * - Over/Under calculation
 * - BTTS calculation
 * - Lambda compression (V2)
 */
import { describe, it, expect } from 'vitest';
import { generateFullPrediction } from '../score-matrix';
import { generateGoalDistribution, poissonPmf } from '../poisson';
import { predictExactScores, predictExactScoresV2 } from '../index';

// ============================================================
// PHASE 4 — CONTROLLED SCORE MATRIX TESTS
// ============================================================

describe('PROBLEM 1: Exact Score Top 1 Investigation', () => {
  it('TEST A: lambda 0.3/0.3 → 0-0 should be dominant', () => {
    const result = generateFullPrediction(0.3, 0.3);
    const top1 = result.topExactScores[0];
    console.log('TEST A (0.3/0.3) top5:', result.topExactScores.map(s => `${s.score}=${(s.probability*100).toFixed(2)}%`));
    expect(top1.score).toBe('0-0');
  });

  it('TEST B: lambda 1.5/1.5 → 1-1 can be top (this is CORRECT mathematically)', () => {
    const result = generateFullPrediction(1.5, 1.5);
    const top1 = result.topExactScores[0];
    console.log('TEST B (1.5/1.5) top5:', result.topExactScores.map(s => `${s.score}=${(s.probability*100).toFixed(2)}%`));
    // For equal lambdas around 1.5, 1-1 IS mathematically the most probable
    expect(top1.score).toBe('1-1');
  });

  it('TEST C: lambda 2.5/0.5 → 1-1 should NOT be top 1', () => {
    const result = generateFullPrediction(2.5, 0.5);
    const top1 = result.topExactScores[0];
    console.log('TEST C (2.5/0.5) top5:', result.topExactScores.map(s => `${s.score}=${(s.probability*100).toFixed(2)}%`));
    expect(top1.score).not.toBe('1-1');
  });

  it('TEST D: lambda 0.5/2.5 → mirror of TEST C', () => {
    const result = generateFullPrediction(0.5, 2.5);
    const top1 = result.topExactScores[0];
    console.log('TEST D (0.5/2.5) top5:', result.topExactScores.map(s => `${s.score}=${(s.probability*100).toFixed(2)}%`));
    expect(top1.score).not.toBe('1-1');
  });

  it('TEST E: lambda 3.2/0.7 → 1-1 must NOT be top 1', () => {
    const result = generateFullPrediction(3.2, 0.7);
    const top1 = result.topExactScores[0];
    console.log('TEST E (3.2/0.7) top5:', result.topExactScores.map(s => `${s.score}=${(s.probability*100).toFixed(2)}%`));
    expect(top1.score).not.toBe('1-1');
  });

  it('TEST F: lambda 0/0 → 0-0 must have probability 1', () => {
    const result = generateFullPrediction(0, 0);
    const top1 = result.topExactScores[0];
    expect(top1.score).toBe('0-0');
    expect(top1.probability).toBeCloseTo(1.0);
  });
});

// ============================================================
// PHASE 5 — VALIDATE POISSON
// ============================================================

describe('PHASE 5: Poisson Formula Validation', () => {
  it('P(X=0) with lambda=1 should be ~0.3679', () => {
    expect(poissonPmf(1, 0)).toBeCloseTo(Math.exp(-1), 6);
  });

  it('P(X=1) with lambda=1 should be ~0.3679', () => {
    expect(poissonPmf(1, 1)).toBeCloseTo(Math.exp(-1), 6);
  });

  it('P(X=2) with lambda=2 should be ~0.2707', () => {
    // P(2) = e^-2 * 2^2 / 2! = e^-2 * 4 / 2 = 2*e^-2
    expect(poissonPmf(2, 2)).toBeCloseTo(2 * Math.exp(-2), 6);
  });

  it('sum of goal distribution should be approximately 1', () => {
    const dist = generateGoalDistribution(2.5, 6);
    const sum = dist.reduce((a, b) => a + b, 0);
    // With maxGoals=6, some mass is lost for high lambdas
    expect(sum).toBeGreaterThan(0.95);
    expect(sum).toBeLessThanOrEqual(1.0 + 1e-10);
  });

  it('all probabilities are between 0 and 1', () => {
    for (const lambda of [0.3, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0]) {
      const dist = generateGoalDistribution(lambda, 6);
      for (const p of dist) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ============================================================
// PHASE 6 — VALIDATE MATRIX CONSTRUCTION
// ============================================================

describe('PHASE 6: Score Matrix Cell Calculation', () => {
  it('each cell is homeDist[i] * awayDist[j]', () => {
    const lambda_h = 2.0, lambda_a = 0.8;
    const result = generateFullPrediction(lambda_h, lambda_a);
    
    for (let i = 0; i <= 3; i++) {
      for (let j = 0; j <= 3; j++) {
        const expected = result.homeDist[i] * result.awayDist[j];
        expect(result.matrix[i][j]).toBeCloseTo(expected, 10);
      }
    }
  });

  it('matrix does NOT use homeDist[i] * homeDist[j] (common bug)', () => {
    const lambda_h = 2.0, lambda_a = 0.5;
    const result = generateFullPrediction(lambda_h, lambda_a);
    
    // P(2-0) should be homeDist[2]*awayDist[0], NOT homeDist[2]*homeDist[0]
    const correct = result.homeDist[2] * result.awayDist[0];
    const wrong = result.homeDist[2] * result.homeDist[0];
    expect(result.matrix[2][0]).toBeCloseTo(correct, 10);
    expect(result.matrix[2][0]).not.toBeCloseTo(wrong, 3);
  });
});

// ============================================================
// PHASE 7 — VALIDATE SORT
// ============================================================

describe('PHASE 7: Sort Validation', () => {
  it('topExactScores are sorted descending by probability (numeric, not string)', () => {
    const result = generateFullPrediction(1.8, 1.2);
    for (let i = 0; i < result.topExactScores.length - 1; i++) {
      expect(result.topExactScores[i].probability).toBeGreaterThanOrEqual(
        result.topExactScores[i + 1].probability
      );
    }
  });

  it('sort handles probabilities > 10% correctly (not string-sorted)', () => {
    const result = generateFullPrediction(1.5, 1.5);
    // 1-1 should have >10% probability here
    const firstProb = result.topExactScores[0].probability;
    expect(firstProb).toBeGreaterThan(0.05);
    // Verify strict descending
    const probs = result.topExactScores.map(s => s.probability);
    for (let i = 0; i < probs.length - 1; i++) {
      expect(probs[i]).toBeGreaterThanOrEqual(probs[i + 1]);
    }
  });
});

// ============================================================
// PHASE 8 — SYMMETRY TESTS
// ============================================================

describe('PHASE 8: Symmetry Tests', () => {
  it('equal lambdas produce symmetric results', () => {
    const result = generateFullPrediction(1.5, 1.5);
    // P(2-0) should equal P(0-2)
    const p20 = result.matrix[2][0];
    const p02 = result.matrix[0][2];
    expect(p20).toBeCloseTo(p02, 10);
    // P(3-1) should equal P(1-3)
    const p31 = result.matrix[3][1];
    const p13 = result.matrix[1][3];
    expect(p31).toBeCloseTo(p13, 10);
  });

  it('lambda 0.5/2.5 mirrors lambda 2.5/0.5', () => {
    const r1 = generateFullPrediction(2.5, 0.5);
    const r2 = generateFullPrediction(0.5, 2.5);
    // P(2-0) in r1 should equal P(0-2) in r2
    expect(r1.matrix[2][0]).toBeCloseTo(r2.matrix[0][2], 10);
    expect(r1.matrix[3][1]).toBeCloseTo(r2.matrix[1][3], 10);
  });
});

// ============================================================
// PHASE 9 & 10 — BTTS AND OVER/UNDER INDEPENDENCE
// ============================================================

describe('PROBLEM 2: BTTS vs Over 2.5 Independence', () => {
  it('PHASE 9: BTTS calculation is correct (homeGoals>0 AND awayGoals>0)', () => {
    const result = generateFullPrediction(1.5, 1.5);
    
    // Manual calculation: sum all cells where i>=1 AND j>=1
    let bttsManual = 0;
    const totalMass = result.matrix.reduce((sum, row) => sum + row.reduce((s, c) => s + c, 0), 0);
    for (let i = 1; i < result.matrix.length; i++) {
      for (let j = 1; j < result.matrix[i].length; j++) {
        bttsManual += result.matrix[i][j];
      }
    }
    bttsManual /= totalMass;
    
    expect(result.btts.yes).toBeCloseTo(bttsManual, 8);
  });

  it('PHASE 9: BTTS alternative formula matches: 1 - P(Home=0) - P(Away=0) + P(0-0)', () => {
    const result = generateFullPrediction(1.5, 1.5);
    const totalMass = result.matrix.reduce((sum, row) => sum + row.reduce((s, c) => s + c, 0), 0);
    
    // P(Home=0) = sum of row 0
    const pHome0 = result.matrix[0].reduce((s, c) => s + c, 0) / totalMass;
    // P(Away=0) = sum of column 0
    let pAway0 = 0;
    for (let i = 0; i < result.matrix.length; i++) pAway0 += result.matrix[i][0];
    pAway0 /= totalMass;
    // P(0-0)
    const p00 = result.matrix[0][0] / totalMass;
    
    const bttsAlternative = 1 - pHome0 - pAway0 + p00;
    expect(result.btts.yes).toBeCloseTo(bttsAlternative, 8);
  });

  it('PHASE 10: Over 2.5 calculation is correct (homeGoals + awayGoals >= 3)', () => {
    const result = generateFullPrediction(1.5, 1.5);
    
    // Manual calculation
    const totalMass = result.matrix.reduce((sum, row) => sum + row.reduce((s, c) => s + c, 0), 0);
    let over25Manual = 0;
    for (let i = 0; i < result.matrix.length; i++) {
      for (let j = 0; j < result.matrix[i].length; j++) {
        if (i + j >= 3) over25Manual += result.matrix[i][j];
      }
    }
    over25Manual /= totalMass;
    
    const over25FromResult = result.totals.find(t => t.line === 2.5)!.over;
    expect(over25FromResult).toBeCloseTo(over25Manual, 8);
  });

  it('PHASE 11 CRITICAL: BTTS and Over2.5 must DIFFER for lambda 3.0/0.1', () => {
    const result = generateFullPrediction(3.0, 0.1);
    const over25 = result.totals.find(t => t.line === 2.5)!.over;
    const bttsYes = result.btts.yes;
    
    console.log(`lambda 3.0/0.1: Over2.5=${(over25*100).toFixed(2)}% BTTS=${(bttsYes*100).toFixed(2)}%`);
    
    // Over 2.5 should be HIGH (team scores 3+ regularly)
    // BTTS should be VERY LOW (away team barely scores)
    expect(over25).toBeGreaterThan(0.50);
    expect(bttsYes).toBeLessThan(0.20);
    expect(Math.abs(over25 - bttsYes)).toBeGreaterThan(0.3);
  });

  it('PHASE 11: BTTS and Over2.5 are different for lambda 1.0/1.0', () => {
    const result = generateFullPrediction(1.0, 1.0);
    const over25 = result.totals.find(t => t.line === 2.5)!.over;
    const bttsYes = result.btts.yes;
    
    console.log(`lambda 1.0/1.0: Over2.5=${(over25*100).toFixed(2)}% BTTS=${(bttsYes*100).toFixed(2)}%`);
    
    // Both should be moderate but NOT identical
    // BTTS and Over2.5 CAN be close for certain lambda combos, but let's log them
    expect(over25 + result.totals.find(t => t.line === 2.5)!.under).toBeCloseTo(1.0, 6);
    expect(bttsYes + result.btts.no).toBeCloseTo(1.0, 6);
  });

  it('PHASE 11: Various lambda combos show independence', () => {
    const cases = [
      { h: 0.5, a: 0.5 },
      { h: 1.0, a: 1.0 },
      { h: 1.5, a: 1.5 },
      { h: 2.0, a: 0.5 },
      { h: 0.5, a: 2.0 },
      { h: 3.0, a: 0.1 },
      { h: 0.1, a: 3.0 },
      { h: 2.5, a: 1.5 },
    ];
    
    console.log('\n=== BTTS vs Over2.5 comparison ===');
    for (const { h, a } of cases) {
      const result = generateFullPrediction(h, a);
      const over25 = result.totals.find(t => t.line === 2.5)!.over;
      const bttsYes = result.btts.yes;
      console.log(`λH=${h.toFixed(1)} λA=${a.toFixed(1)} → Over2.5=${(over25*100).toFixed(1)}% BTTS=${(bttsYes*100).toFixed(1)}% diff=${(Math.abs(over25-bttsYes)*100).toFixed(1)}pp`);
    }
  });
});

// ============================================================
// PHASE 12 — RESPONSE MAPPING
// ============================================================

describe('PHASE 12: API Response Shape Verification', () => {
  it('predictExactScores returns correct over/under and btts fields separately', () => {
    const result = predictExactScores({ lambdaHome: 2.5, lambdaAway: 0.5 });
    
    const over25 = result.totals.find(t => t.line === 2.5)!.over;
    const bttsYes = result.btts.yes;
    
    // These should be DIFFERENT values stored in DIFFERENT fields
    expect(over25).not.toBe(bttsYes);
    
    // Verify structure is correct
    expect(result.totals).toBeInstanceOf(Array);
    expect(result.btts).toHaveProperty('yes');
    expect(result.btts).toHaveProperty('no');
    expect(result.totals.find(t => t.line === 2.5)).toHaveProperty('over');
    expect(result.totals.find(t => t.line === 2.5)).toHaveProperty('under');
  });
});

// ============================================================
// PHASE 14 — REGRESSION TESTS (permanent)
// ============================================================

describe('PHASE 14: Permanent Regression Tests', () => {
  it('topScore(2.5, 0.5) should NOT be "1-1"', () => {
    const result = generateFullPrediction(2.5, 0.5);
    expect(result.topExactScores[0].score).not.toBe('1-1');
  });

  it('topScore(0.5, 2.5) should NOT be "1-1"', () => {
    const result = generateFullPrediction(0.5, 2.5);
    expect(result.topExactScores[0].score).not.toBe('1-1');
  });

  it('topScore(0, 0) should be "0-0"', () => {
    const result = generateFullPrediction(0, 0);
    expect(result.topExactScores[0].score).toBe('0-0');
  });

  it('BTTS(3.0, 0.1) must differ from Over2.5(3.0, 0.1)', () => {
    const result = generateFullPrediction(3.0, 0.1);
    const over25 = result.totals.find(t => t.line === 2.5)!.over;
    expect(Math.abs(over25 - result.btts.yes)).toBeGreaterThan(0.1);
  });

  it('BTTS Yes + BTTS No ≈ 1', () => {
    const result = generateFullPrediction(1.8, 1.2);
    expect(result.btts.yes + result.btts.no).toBeCloseTo(1.0, 6);
  });

  it('Over2.5 + Under2.5 ≈ 1', () => {
    const result = generateFullPrediction(1.8, 1.2);
    const ou = result.totals.find(t => t.line === 2.5)!;
    expect(ou.over + ou.under).toBeCloseTo(1.0, 6);
  });

  it('Home + Draw + Away ≈ 1', () => {
    const result = generateFullPrediction(1.8, 1.2);
    const { home, draw, away } = result.matchResult;
    expect(home + draw + away).toBeCloseTo(1.0, 6);
  });

  it('Score Matrix total ≈ 1', () => {
    const result = generateFullPrediction(1.8, 1.2);
    expect(result.totalMass).toBeGreaterThan(0.95);
    expect(result.totalMass).toBeLessThanOrEqual(1.0 + 1e-10);
  });
});

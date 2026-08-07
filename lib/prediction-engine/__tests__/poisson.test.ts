import { describe, it, expect } from 'vitest';
import { factorial, poissonPmf, generateGoalDistribution } from '../poisson';

describe('factorial', () => {
  it('should return 1 for factorial(0)', () => {
    expect(factorial(0)).toBe(1);
  });

  it('should return 1 for factorial(1)', () => {
    expect(factorial(1)).toBe(1);
  });

  it('should return correct values for small numbers', () => {
    expect(factorial(2)).toBe(2);
    expect(factorial(3)).toBe(6);
    expect(factorial(4)).toBe(24);
    expect(factorial(5)).toBe(120);
    expect(factorial(6)).toBe(720);
    expect(factorial(10)).toBe(3628800);
  });

  it('should throw for negative input', () => {
    expect(() => factorial(-1)).toThrow();
    expect(() => factorial(-5)).toThrow();
  });

  it('should throw for non-integer input', () => {
    expect(() => factorial(2.5)).toThrow();
    expect(() => factorial(0.1)).toThrow();
  });

  it('should throw for NaN', () => {
    expect(() => factorial(NaN)).toThrow();
  });

  it('should throw for Infinity', () => {
    expect(() => factorial(Infinity)).toThrow();
    expect(() => factorial(-Infinity)).toThrow();
  });

  it('should handle large factorials via cache', () => {
    const f20 = factorial(20);
    expect(f20).toBe(2432902008176640000);
    // Call again to test cache hit
    expect(factorial(20)).toBe(f20);
  });
});

describe('poissonPmf', () => {
  it('should return 1 for P(X=0) when lambda=0', () => {
    expect(poissonPmf(0, 0)).toBe(1.0);
  });

  it('should return 0 for P(X>0) when lambda=0', () => {
    expect(poissonPmf(0, 1)).toBe(0.0);
    expect(poissonPmf(0, 5)).toBe(0.0);
  });

  it('should compute correct values for lambda=1', () => {
    // P(X=0) = e^-1 ≈ 0.3679
    expect(poissonPmf(1, 0)).toBeCloseTo(Math.exp(-1), 10);
    // P(X=1) = e^-1 * 1 / 1 ≈ 0.3679
    expect(poissonPmf(1, 1)).toBeCloseTo(Math.exp(-1), 10);
    // P(X=2) = e^-1 * 1 / 2 ≈ 0.1839
    expect(poissonPmf(1, 2)).toBeCloseTo(Math.exp(-1) / 2, 10);
  });

  it('should compute correct values for lambda=1.5 (typical football)', () => {
    // P(X=0) = e^-1.5 ≈ 0.2231
    expect(poissonPmf(1.5, 0)).toBeCloseTo(0.22313, 4);
    // P(X=1) = e^-1.5 * 1.5 ≈ 0.3347
    expect(poissonPmf(1.5, 1)).toBeCloseTo(0.33470, 4);
    // P(X=2) = e^-1.5 * 1.5^2 / 2 ≈ 0.2510
    expect(poissonPmf(1.5, 2)).toBeCloseTo(0.25102, 4);
  });

  it('should handle very small lambda', () => {
    const p0 = poissonPmf(0.01, 0);
    expect(p0).toBeCloseTo(Math.exp(-0.01), 10);
    expect(p0).toBeGreaterThan(0.99);
  });

  it('should handle large lambda (high-scoring expectation)', () => {
    // lambda=4 → P(X=0) = e^-4 ≈ 0.0183
    expect(poissonPmf(4, 0)).toBeCloseTo(0.01832, 4);
    // P(X=4) = e^-4 * 256 / 24 ≈ 0.1954
    expect(poissonPmf(4, 4)).toBeCloseTo(0.19537, 4);
  });

  it('should never return negative values', () => {
    for (let lambda = 0; lambda <= 5; lambda += 0.5) {
      for (let k = 0; k <= 10; k++) {
        expect(poissonPmf(lambda, k)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should never return values > 1', () => {
    for (let lambda = 0; lambda <= 5; lambda += 0.5) {
      for (let k = 0; k <= 10; k++) {
        expect(poissonPmf(lambda, k)).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('should throw for negative lambda', () => {
    expect(() => poissonPmf(-1, 0)).toThrow();
    expect(() => poissonPmf(-0.5, 2)).toThrow();
  });

  it('should throw for NaN lambda', () => {
    expect(() => poissonPmf(NaN, 0)).toThrow();
  });

  it('should throw for Infinity lambda', () => {
    expect(() => poissonPmf(Infinity, 0)).toThrow();
  });

  it('should throw for negative k', () => {
    expect(() => poissonPmf(1.5, -1)).toThrow();
  });

  it('should throw for non-integer k', () => {
    expect(() => poissonPmf(1.5, 1.5)).toThrow();
  });

  it('should handle k > 20 (log-space computation)', () => {
    // lambda=5, k=25 — should still be valid
    const p = poissonPmf(5, 25);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.01); // Very unlikely
    expect(Number.isFinite(p)).toBe(true);
  });
});

describe('generateGoalDistribution', () => {
  it('should generate array of correct length', () => {
    const dist = generateGoalDistribution(1.5, 6);
    expect(dist).toHaveLength(7); // 0 to 6 inclusive
  });

  it('should sum close to 1 for maxGoals=6 and typical lambda', () => {
    const dist = generateGoalDistribution(1.5, 6);
    const sum = dist.reduce((a, b) => a + b, 0);
    // For lambda=1.5, maxGoals=6 should capture >99% of probability
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThanOrEqual(1.0);
  });

  it('should sum to exactly 1 when lambda=0', () => {
    const dist = generateGoalDistribution(0, 6);
    expect(dist[0]).toBe(1.0);
    for (let i = 1; i <= 6; i++) {
      expect(dist[i]).toBe(0.0);
    }
  });

  it('should have all non-negative values', () => {
    const dist = generateGoalDistribution(2.5, 6);
    dist.forEach(p => expect(p).toBeGreaterThanOrEqual(0));
  });

  it('should throw for negative lambda', () => {
    expect(() => generateGoalDistribution(-1, 6)).toThrow();
  });

  it('should throw for invalid maxGoals', () => {
    expect(() => generateGoalDistribution(1.5, -1)).toThrow();
    expect(() => generateGoalDistribution(1.5, 2.5)).toThrow();
  });

  it('should produce decreasing tail probabilities for moderate lambda', () => {
    const dist = generateGoalDistribution(1.5, 6);
    // After the mode (around 1), probabilities should generally decrease
    // P(4) < P(3) and P(5) < P(4) and P(6) < P(5)
    expect(dist[6]).toBeLessThan(dist[5]);
    expect(dist[5]).toBeLessThan(dist[4]);
  });

  it('should handle large lambda capturing enough mass', () => {
    const dist = generateGoalDistribution(4, 6);
    const sum = dist.reduce((a, b) => a + b, 0);
    // lambda=4, maxGoals=6 captures ~89% — less ideal but acceptable
    expect(sum).toBeGreaterThan(0.88);
  });
});

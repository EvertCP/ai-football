# DEBUG: Prediction Engine Investigation

## Date: 2026-08-13

---

## PROBLEM 1: "1-1 siempre es Top 1"

### Root Cause: **NOT a bug** — it's mathematically correct behavior for compressed lambdas

#### Evidence:

The Poisson engine, Score Matrix, sorting, and BTTS/Over2.5 calculations are all **mathematically correct** (verified with 32 controlled tests).

When both lambdas are in the range 1.0-1.7 (typical for most matches), **1-1 IS the correct Poisson prediction** because:

- P(1-1) = P(Home=1) × P(Away=1) = λ_h × e^(-λ_h) × λ_a × e^(-λ_a)
- For λ_h=1.5, λ_a=1.5: P(1-1) ≈ 11.2% (highest single outcome)
- For λ_h=1.65, λ_a=1.10: P(1-1) ≈ 11.6% (still highest)

This is a **well-known property** of Poisson distributions — for lambdas in [0.8, 2.0], 1-1 or 1-0 will nearly always be top score because individual scorelines each have low probability, and draws benefit from the "double peak" at P(k=1) for both teams.

#### Why users perceive it as wrong:

The V1 engine's `estimatedXG` formula produces values in a narrow band (~0.8-2.0) for most teams because:
1. The xG formula `shots_on_target*0.10 + shots_inside_box*0.08 + big_chances*0.35` yields averages of ~1.0-1.8 per game for typical teams
2. Lambda formula `xgFor*0.6 + xgAgainst_opponent*0.4` blends them, further compressing the range
3. Result: nearly all lambdas fall in the "1-1 zone"

For the V2 engine, the compression is even WORSE because:
1. `buildTeamHistory()` creates N identical observations from averages (no variance)
2. The 50/50 home/away split assigns only 5 matches per venue
3. With 5 matches, `getShrinkageWeight(5) = 5` (lowSample prior)
4. Shrinkage formula: `(5 × observed + 5 × 1.0) / 10` → halves the deviation from 1.0
5. This compounds: homeAttackStrength is pulled heavily toward 1.0

#### Key numbers (V2 with typical teams: 1.8 xG scored, 1.0 conceded):
```
homeAttackStrength = 1.1207 (should be ~1.72 without excessive shrinkage)
awayDefenseWeakness = 1.0172 (barely above average!)
→ lambdaHome = 1.45 × 1.12 × 1.02 = 1.65
→ lambdaAway = 1.15 × 1.02 × 0.93 = 1.10
→ Top score: 1-1 (11.6%)
```

### Fix needed:
1. **V2**: Reduce shrinkage for home/away split (the synthetic 50/50 split is the real culprit — it artificially reduces N per venue, triggering heavy priors)
2. **V1**: No fix needed in the engine — but the lambda range problem is intrinsic to the estimatedXG formula producing narrow-band values

---

## PROBLEM 2: "BTTS ≈ Over 2.5"

### Root Cause: **NOT a bug** — they are numerically close for typical lambdas

#### Evidence:

```
λH=1.5 λA=1.5 → Over2.5=57.6% BTTS=60.3% diff=2.7pp
λH=2.5 λA=1.5 → Over2.5=75.8% BTTS=71.2% diff=4.6pp
```

After `Math.round(x * 100)` or `(x * 100 | 0)` (which the frontend uses for O/U), both values display identically.

#### Key insight:
- When both teams score around 1 goal each, most scorelines involve both teams scoring AND having 2+ total goals
- The events "both score at least 1" and "total goals ≥ 3" overlap heavily for symmetric lambdas
- They only diverge significantly when one lambda is very high and the other very low (e.g., 3.0/0.1: Over2.5=58.5%, BTTS=9.0%)

#### Frontend display issue:
The frontend uses `(value * 100 | 0)` (bitwise OR truncation) for Over/Under, but `Math.round(value * 100)` for BTTS. Both produce integers, hiding small differences.

### Fix: Display with 1 decimal place to show differences clearly.

---

## SUMMARY OF FINDINGS

| Component | Status | Issue Found |
|-----------|--------|-------------|
| `poisson.ts` | ✅ CORRECT | No bugs |
| `score-matrix.ts` | ✅ CORRECT | No bugs |
| `extractExactScores()` sort | ✅ CORRECT | Numeric sort, not string |
| `deriveOverUnder()` | ✅ CORRECT | Sums cells with i+j >= threshold |
| `deriveBTTS()` | ✅ CORRECT | Sums cells with i>=1 AND j>=1 |
| `predictExactScores()` response | ✅ CORRECT | Separate totals/btts objects |
| API response mapping | ✅ CORRECT | No shared variables |
| Frontend prop usage | ✅ CORRECT | Uses correct fields |
| **V2 buildTeamHistory** | ⚠️ DESIGN ISSUE | Identical observations + fake 50/50 split |
| **V2 shrinkage on small splits** | ⚠️ OVER-COMPRESSION | priorWeight=5 with 5 matches → halves deviation |
| **Frontend display precision** | ⚠️ UX ISSUE | Integer % hides small differences |

---

## BUGS TO FIX

### Bug 1: `buildTeamHistory` over-compression
**File:** `app/api/prediction/route.ts:409-431`
**Issue:** Creates N identical observations from averages, then splits 50/50 home/away. With 10 matches → 5 home + 5 away → priorWeight=5 → `(5*observed + 5*1.0)/10` = halves deviation.
**Fix:** Use overall match count for shrinkage weight instead of per-venue count, OR reduce priorWeight for home/away splits when using synthetic data.

### Bug 2: Frontend display precision
**File:** `components/PredictionPanel.tsx:217,223`
**Issue:** Over/Under uses `(value * 100 | 0)` (truncation to integer). BTTS uses `Math.round(value * 100)`. Both hide real 2-5pp differences.
**Fix:** Use 1 decimal place: `(value * 100).toFixed(1)` for both.

---

## TESTS CREATED

1. `lib/prediction-engine/__tests__/debug-problems.test.ts` — 32 tests
   - Controlled score matrix tests (TEST A-F)
   - Poisson formula validation
   - Matrix cell verification
   - Sort validation
   - Symmetry tests
   - BTTS independence from Over/Under
   - Critical divergence test (λ=3.0/0.1)
   - Regression tests (permanent)

2. `lib/prediction-engine/__tests__/debug-lambda-compression.test.ts` — 7 tests
   - Production simulation with identical observations
   - Shrinkage analysis by sample size
   - Home/away split compression diagnosis
   - Full V2 cascade breakdown
   - Real-world typical teams simulation
   - V1 vs V2 lambda comparison

---

## ACTIONS TAKEN

1. ✅ Verified Poisson math is correct
2. ✅ Verified Score Matrix construction is correct
3. ✅ Verified sort is numeric (not string)
4. ✅ Verified BTTS and Over/Under use different formulas on different cells
5. ✅ Verified API returns separate objects for both
6. ✅ Verified frontend reads correct fields
7. ✅ Identified V2 shrinkage over-compression as root cause of "1-1 always top"
8. ✅ Identified display precision as root cause of "BTTS ≈ Over2.5" 
9. ✅ Fixed shrinkage: use overall prior for home/away splits (team-strength.ts)
10. ✅ Fixed frontend: use 1 decimal place for O/U and BTTS (PredictionPanel.tsx)
11. ✅ Added structured JSON logging to API (route.ts)
12. ✅ All 724 tests pass, TypeScript clean, Build clean

---

## BEFORE / AFTER COMPARISON

### V2 Lambda Separation (Strong Home 2.5 xG vs Weak Away 0.5 xG)

| Metric | BEFORE | AFTER |
|--------|--------|-------|
| homeAttackStrength | 1.362 | 1.603 |
| awayDefenseWeakness | 1.362 | 1.603 |
| lambdaHome | 2.690 | 3.728 |
| lambdaAway | 0.592 | 0.322 |
| diff | 2.098 | **3.406** |
| Top Score | 2-0 (reasonable) | 3-0 / 4-0 (more correct) |

### V2 Lambda Separation (Typical: Good 1.8/1.0 vs Mediocre 1.2/1.5)

| Metric | BEFORE | AFTER |
|--------|--------|-------|
| homeAttackStrength | 1.121 | 1.201 |
| lambdaHome | 1.653 | 1.792 |
| lambdaAway | 1.098 | 1.062 |
| diff | 0.555 | **0.730** |
| Top Score | 1-1 (11.6%) | 1-1 (11.0%) → 1-0 (10.4%) much closer |

**Note:** For typical team differences (~0.6 xG gap), 1-1 will sometimes STILL be top score. This is **mathematically correct** Poisson behavior. The fix reduces the frequency and margin.

### Frontend Display (Problem 2)

| Metric | BEFORE | AFTER |
|--------|--------|-------|
| Over 2.5 display | `57%` (truncated int) | `57.6%` (1 decimal) |
| BTTS display | `60%` (rounded int) | `60.3%` (1 decimal) |
| Visible difference | 3pp → sometimes 0 | **2.7pp always visible** |

---

## REMAINING STATISTICAL NOTES

1. **1-1 as top score for moderate lambdas is mathematically correct.** When both lambdas are in [1.0, 2.0], P(1-1) ≈ P(Home=1) × P(Away=1) = λ_h×e^-λ_h × λ_a×e^-λ_a. The mode of Poisson(λ) is floor(λ), so for λ≈1.5, P(1) is near-maximum for both teams. The only way to avoid 1-1 as top is to have lambdas differ by >0.8.

2. **V1 also produces 1-1 frequently** because the estimatedXG formula yields narrow-band values (1.0-1.8) for most teams.

3. **BTTS ≈ Over2.5 for symmetric lambdas is also correct.** When both teams score ~1.3 goals, the events "both score" and "3+ total" overlap heavily. They diverge when one lambda is much higher than the other.

---

## RECOMMENDATIONS FOR FUTURE IMPROVEMENT

1. **Use per-match xG data** instead of averages in `buildTeamHistory` — this would give real variance and more accurate time-weighted means.
2. **Fetch real xG from Sportmonks** (type_id 321) instead of the heuristic formula.
3. **Consider Dixon-Coles correction** for low-scoring outcomes (deflates 0-0, 1-0, 0-1 slightly, inflates 1-1 correction) — this would actually INCREASE 1-1 but would be more accurate.
4. **Show top 5 scores with close probabilities** as "equally likely" in the UI to set correct expectations.
5. **Add a "confidence band" indicator** when top scores are within 1pp of each other.

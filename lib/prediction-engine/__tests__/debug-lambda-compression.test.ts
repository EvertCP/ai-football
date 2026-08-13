/**
 * DEBUG: Lambda Compression Investigation
 *
 * Tests whether the V2 engine is over-compressing lambdas
 * due to shrinkage + buildTeamHistory creating identical observations.
 */
import { describe, it, expect } from 'vitest';
import { calculateTeamStrength, TeamMatchHistory } from '../team-strength';
import { calculateLambdasV2 } from '../lambda-v2';
import { getDefaultLeagueBaseline } from '../league-baseline';
import { shrinkage } from '../weighted-xg';
import { getShrinkageWeight, PREDICTION_CONFIG } from '../config';
import { generateFullPrediction } from '../score-matrix';

const LEAGUE_BASELINE = getDefaultLeagueBaseline();

describe('PHASE 15: Lambda V2 Compression Analysis', () => {
  
  it('CRITICAL: Simulates buildTeamHistory (identical observations from averages)', () => {
    // This is EXACTLY what buildTeamHistory does in production:
    // It creates N identical observations from the team's AVERAGE xG
    // e.g., a team with xgFor=2.5, xgAgainst=0.5, 10 matches → 10 identical entries
    
    const strongHome: TeamMatchHistory[] = Array.from({ length: 10 }, (_, i) => ({
      xgFor: 2.5,
      xgAgainst: 0.5,
      daysSince: i * 7,
      isHome: i % 2 === 0, // 5 home, 5 away
    }));
    
    const weakAway: TeamMatchHistory[] = Array.from({ length: 10 }, (_, i) => ({
      xgFor: 0.5,
      xgAgainst: 2.5,
      daysSince: i * 7,
      isHome: i % 2 === 0,
    }));
    
    const homeStrength = calculateTeamStrength(strongHome, LEAGUE_BASELINE);
    const awayStrength = calculateTeamStrength(weakAway, LEAGUE_BASELINE);
    
    console.log('\n=== PRODUCTION SIMULATION (identical obs from averages) ===');
    console.log('Strong Home team (xgFor=2.5, xgAgainst=0.5, 10 matches):');
    console.log(`  attackStrength: ${homeStrength.attackStrength.toFixed(4)}`);
    console.log(`  defenseWeakness: ${homeStrength.defenseWeakness.toFixed(4)}`);
    console.log(`  homeAttackStrength: ${homeStrength.homeAttackStrength.toFixed(4)}`);
    console.log(`  homeDefenseWeakness: ${homeStrength.homeDefenseWeakness.toFixed(4)}`);
    
    console.log('Weak Away team (xgFor=0.5, xgAgainst=2.5, 10 matches):');
    console.log(`  attackStrength: ${awayStrength.attackStrength.toFixed(4)}`);
    console.log(`  defenseWeakness: ${awayStrength.defenseWeakness.toFixed(4)}`);
    console.log(`  awayAttackStrength: ${awayStrength.awayAttackStrength.toFixed(4)}`);
    console.log(`  awayDefenseWeakness: ${awayStrength.awayDefenseWeakness.toFixed(4)}`);
    
    const v2Result = calculateLambdasV2({
      homeStrength,
      awayStrength,
      leagueBaseline: LEAGUE_BASELINE,
      isNeutralVenue: false,
    });
    
    console.log(`\nV2 Lambda Result:`);
    console.log(`  lambdaHome: ${v2Result.lambdaHome.toFixed(4)}`);
    console.log(`  lambdaAway: ${v2Result.lambdaAway.toFixed(4)}`);
    console.log(`  diff: ${Math.abs(v2Result.lambdaHome - v2Result.lambdaAway).toFixed(4)}`);
    console.log(`  Diagnostics:`, JSON.stringify(v2Result.diagnostics, null, 2));
    
    // ASSERTION: With such extreme xG difference, lambdas MUST differ significantly
    expect(v2Result.lambdaHome).toBeGreaterThan(2.0);
    expect(v2Result.lambdaAway).toBeLessThan(1.0);
    expect(Math.abs(v2Result.lambdaHome - v2Result.lambdaAway)).toBeGreaterThan(1.0);
  });

  it('DIAGNOSIS: shrinkage effect on team ratings with typical match counts', () => {
    console.log('\n=== SHRINKAGE ANALYSIS ===');
    
    // A team with xG=2.5 against league avg of 1.3 → raw ratio = 1.923
    const rawStrong = 2.5 / ((1.45 + 1.15) / 2); // 2.5 / 1.3 = 1.923
    const rawWeak = 0.5 / ((1.45 + 1.15) / 2);   // 0.5 / 1.3 = 0.385
    
    console.log(`Raw strong attack: ${rawStrong.toFixed(4)}`);
    console.log(`Raw weak attack: ${rawWeak.toFixed(4)}`);
    
    for (const n of [3, 5, 8, 10, 15, 20]) {
      const prior = getShrinkageWeight(n);
      const shrunk_strong = shrinkage(rawStrong, 1.0, n, prior);
      const shrunk_weak = shrinkage(rawWeak, 1.0, n, prior);
      console.log(`  N=${n.toString().padStart(2)} prior=${prior}: strong=${shrunk_strong.toFixed(4)} weak=${shrunk_weak.toFixed(4)} diff=${(shrunk_strong - shrunk_weak).toFixed(4)}`);
    }
    
    // With 10 matches, prior=3 (medium sample)
    // shrinkage(1.923, 1.0, 10, 3) = (10*1.923 + 3*1.0) / 13 = 22.23/13 = 1.71
    // shrinkage(0.385, 1.0, 10, 3) = (10*0.385 + 3*1.0) / 13 = 6.85/13 = 0.527
    // This is reasonable — still maintains separation
  });

  it('DIAGNOSIS: Home/Away split with 50/50 allocation (5 home, 5 away)', () => {
    // This is the REAL problem — with 5 home and 5 away matches:
    // homePrior = getShrinkageWeight(5) = 5 (lowSample)
    // shrinkage(raw, 1.0, 5, 5) = (5*raw + 5*1.0) / 10 = (raw + 1) / 2
    // This HALVES the deviation from 1.0!
    
    const rawHomeAttack = 2.5 / 1.45; // 1.724 (xgFor / avgHomeXG)
    const prior5 = getShrinkageWeight(5); // 5
    const shrunk = shrinkage(rawHomeAttack, 1.0, 5, prior5);
    
    console.log('\n=== HOME/AWAY SPLIT SHRINKAGE (5 matches per venue) ===');
    console.log(`Raw home attack: ${rawHomeAttack.toFixed(4)}`);
    console.log(`Prior weight (N=5): ${prior5}`);
    console.log(`After shrinkage: ${shrunk.toFixed(4)}`);
    console.log(`Expected formula: (5*${rawHomeAttack.toFixed(4)} + 5*1.0) / 10 = ${((5*rawHomeAttack + 5*1.0) / 10).toFixed(4)}`);
    
    // With only 5 matches, shrinkage pulls it from 1.724 to ~1.362
    // This is MASSIVE compression for a team scoring 2.5 xG at home
    expect(shrunk).toBeCloseTo((5 * rawHomeAttack + 5 * 1.0) / 10, 6);
  });

  it('DIAGNOSIS: Full V2 calculation shows the compression cascade', () => {
    console.log('\n=== FULL V2 COMPRESSION CASCADE ===');
    
    // Team A: scores 2.5 xG per game, concedes 0.5
    // Team B: scores 0.5 xG per game, concedes 2.5
    // With 10 matches each, split 50/50 home/away
    
    // Step 1: Weighted mean = 2.5 (since all observations are identical, decay is irrelevant)
    // Step 2: Overall strength: 2.5 / 1.3 = 1.923
    // Step 3: Overall shrinkage (N=10, prior=3): (10*1.923 + 3*1.0)/13 = 1.710
    // Step 4: Home split xgFor = 2.5 (from 5 home matches)
    // Step 5: Home attack = 2.5 / 1.45 = 1.724
    // Step 6: Home shrinkage (N=5, prior=5): (5*1.724 + 5*1.0)/10 = 1.362
    
    // Lambda formula: leagueAvgHome * homeAttack * awayDefense
    // Team B's away defense weakness = Team B's away xGA / league home avg
    //   = 2.5 / 1.45 = 1.724
    //   After shrinkage (N=5, prior=5): (5*1.724 + 5*1.0)/10 = 1.362
    
    // lambdaHome = 1.45 * 1.362 * 1.362 = 2.688 — STILL REASONABLE!
    // lambdaAway = 1.15 * ? * ?
    
    const strongHome: TeamMatchHistory[] = Array.from({ length: 10 }, (_, i) => ({
      xgFor: 2.5, xgAgainst: 0.5, daysSince: i * 7, isHome: i % 2 === 0,
    }));
    const weakAway: TeamMatchHistory[] = Array.from({ length: 10 }, (_, i) => ({
      xgFor: 0.5, xgAgainst: 2.5, daysSince: i * 7, isHome: i % 2 === 0,
    }));
    
    const homeS = calculateTeamStrength(strongHome, LEAGUE_BASELINE);
    const awayS = calculateTeamStrength(weakAway, LEAGUE_BASELINE);
    const v2 = calculateLambdasV2({ homeStrength: homeS, awayStrength: awayS, leagueBaseline: LEAGUE_BASELINE });
    
    console.log(`lambdaHome = ${LEAGUE_BASELINE.avgHomeXG} * ${homeS.homeAttackStrength.toFixed(4)} * ${awayS.awayDefenseWeakness.toFixed(4)} = ${v2.lambdaHome.toFixed(4)}`);
    console.log(`lambdaAway = ${LEAGUE_BASELINE.avgAwayXG} * ${awayS.awayAttackStrength.toFixed(4)} * ${homeS.homeDefenseWeakness.toFixed(4)} = ${v2.lambdaAway.toFixed(4)}`);
    
    // If both end up near 1.3-1.5, the problem is confirmed
  });
  
  it('DIAGNOSIS: What happens with REAL-WORLD typical teams (not extreme)', () => {
    // Typical "good" team: scores 1.8 xG, concedes 1.0
    // Typical "mediocre" team: scores 1.2 xG, concedes 1.5
    const goodTeam: TeamMatchHistory[] = Array.from({ length: 10 }, (_, i) => ({
      xgFor: 1.8, xgAgainst: 1.0, daysSince: i * 7, isHome: i % 2 === 0,
    }));
    const mediocreTeam: TeamMatchHistory[] = Array.from({ length: 10 }, (_, i) => ({
      xgFor: 1.2, xgAgainst: 1.5, daysSince: i * 7, isHome: i % 2 === 0,
    }));
    
    const goodS = calculateTeamStrength(goodTeam, LEAGUE_BASELINE);
    const medS = calculateTeamStrength(mediocreTeam, LEAGUE_BASELINE);
    const v2 = calculateLambdasV2({ homeStrength: goodS, awayStrength: medS, leagueBaseline: LEAGUE_BASELINE });
    
    console.log('\n=== REAL-WORLD TYPICAL TEAMS ===');
    console.log(`Good team (1.8/1.0) homeAttack=${goodS.homeAttackStrength.toFixed(4)} homeDefense=${goodS.homeDefenseWeakness.toFixed(4)}`);
    console.log(`Mediocre team (1.2/1.5) awayAttack=${medS.awayAttackStrength.toFixed(4)} awayDefense=${medS.awayDefenseWeakness.toFixed(4)}`);
    console.log(`V2: lambdaHome=${v2.lambdaHome.toFixed(4)} lambdaAway=${v2.lambdaAway.toFixed(4)} diff=${(v2.lambdaHome - v2.lambdaAway).toFixed(4)}`);
    
    // The TOP SCORE for these values:
    const pred = generateFullPrediction(v2.lambdaHome, v2.lambdaAway);
    console.log(`Top scores:`, pred.topExactScores.map((s: any) => `${s.score}=${(s.probability*100).toFixed(2)}%`));
    
    // If lambdas are both around 1.3-1.5 → 1-1 WILL be top score (that's math)
    // The problem is NOT in Poisson — it's that V2 doesn't produce enough separation
  });
});

describe('PHASE 16: V1 vs V2 Lambda Comparison', () => {
  it('V1 lambdas for strong home vs weak away', () => {
    // V1 formula: lambdaHome = xgFor_home * 0.6 + xgAgainst_away * 0.4
    // Strong home: xgFor=2.5, xgAgainst=0.5
    // Weak away: xgFor=0.5, xgAgainst=2.5
    
    const lambdaHomeV1 = 2.5 * 0.6 + 2.5 * 0.4; // 1.5 + 1.0 = 2.5
    const lambdaAwayV1 = 0.5 * 0.6 + 0.5 * 0.4; // 0.3 + 0.2 = 0.5
    
    console.log('\n=== V1 vs V2 COMPARISON ===');
    console.log(`V1: lambdaHome=${lambdaHomeV1.toFixed(2)} lambdaAway=${lambdaAwayV1.toFixed(2)} diff=${(lambdaHomeV1-lambdaAwayV1).toFixed(2)}`);
    
    // V1 preserves the full xG difference! diff = 2.0
    expect(Math.abs(lambdaHomeV1 - lambdaAwayV1)).toBeGreaterThan(1.5);
  });
  
  it('V1 lambdas for typical good vs mediocre', () => {
    // Good home: xgFor=1.8, xgAgainst=1.0
    // Mediocre away: xgFor=1.2, xgAgainst=1.5
    
    const lambdaHomeV1 = 1.8 * 0.6 + 1.5 * 0.4; // 1.08 + 0.6 = 1.68
    const lambdaAwayV1 = 1.2 * 0.6 + 1.0 * 0.4; // 0.72 + 0.4 = 1.12
    
    console.log(`V1 (good vs med): lambdaHome=${lambdaHomeV1.toFixed(2)} lambdaAway=${lambdaAwayV1.toFixed(2)} diff=${(lambdaHomeV1-lambdaAwayV1).toFixed(2)}`);
    
    // V1 diff = 0.56 — meaningful
    expect(lambdaHomeV1 - lambdaAwayV1).toBeGreaterThan(0.4);
  });
});

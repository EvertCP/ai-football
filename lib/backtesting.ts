/**
 * Backtesting Service V2
 *
 * Evaluates prediction model performance against actual match results.
 * Provides comprehensive metrics: accuracy, MAE, Brier Score, segmentation.
 *
 * DATA LEAKAGE PROTECTION:
 * - Only uses actual results that were available AFTER the prediction was made.
 * - Evaluation only fills in post-match data.
 * - Pre-match predictions are IMMUTABLE once saved.
 */

import { prisma } from './prisma';
import { evaluatePrediction } from './prediction-store';

/** Full backtesting report structure */
export interface BacktestReport {
  model: string;
  totalMatches: number;
  exactScore: {
    top1Accuracy: number;
    top3Accuracy: number;
    top5Accuracy: number;
  };
  matchResultAccuracy: number;
  goals: {
    homeMAE: number;
    awayMAE: number;
    totalMAE: number;
    avgPredictedHome: number;
    avgPredictedAway: number;
    avgActualHome: number;
    avgActualAway: number;
  };
  brierScore: number;
  benchmark: {
    randomBrier: number;
    description: string;
  };
}

/** Segmented report by league/competition */
export interface SegmentedReport {
  overall: BacktestReport;
  byLeague: Record<string, BacktestReport>;
  comparison?: {
    modelA: BacktestReport;
    modelB: BacktestReport;
    winner: string;
    improvements: string[];
  };
}

/**
 * Evaluate all unevaluated predictions for finished matches.
 *
 * @param getActualScore - Function to fetch actual score for a fixtureId.
 *   In production, this calls the Sportmonks API.
 *   In tests, this can be mocked.
 * @returns Number of predictions evaluated
 */
export async function evaluatePendingPredictions(
  getActualScore: (fixtureId: number) => Promise<{ homeGoals: number; awayGoals: number } | null>
): Promise<number> {
  const pending = await prisma.matchPrediction.findMany({
    where: { evaluatedAt: null },
    select: { fixtureId: true, model: true },
  });

  let evaluated = 0;

  for (const pred of pending) {
    try {
      const actual = await getActualScore(pred.fixtureId);
      if (actual) {
        await evaluatePrediction(
          pred.fixtureId,
          pred.model,
          actual.homeGoals,
          actual.awayGoals
        );
        evaluated++;
      }
    } catch (err) {
      console.error(
        `[Backtesting] Failed to evaluate fixtureId=${pred.fixtureId} model=${pred.model}:`,
        err
      );
    }
  }

  return evaluated;
}

/**
 * Generate a comprehensive backtesting report for a model.
 * Includes all metrics: accuracy, MAE, Brier Score.
 */
export async function generateBacktestReport(model?: string): Promise<BacktestReport> {
  const where = {
    evaluatedAt: { not: null as unknown as undefined },
    actualHomeGoals: { not: null as unknown as undefined },
    ...(model ? { model } : {}),
  };

  const predictions = await prisma.matchPrediction.findMany({
    where,
    select: {
      lambdaHome: true,
      lambdaAway: true,
      probHome: true,
      probDraw: true,
      probAway: true,
      actualHomeGoals: true,
      actualAwayGoals: true,
      exactScoreHit: true,
      top3Hit: true,
      top5Hit: true,
      resultHit: true,
    },
  });

  const total = predictions.length;
  if (total === 0) {
    return emptyReport(model || 'ALL');
  }

  let exactHits = 0, top3Hits = 0, top5Hits = 0, resultHits = 0;
  let totalHomeError = 0, totalAwayError = 0;
  let totalPredHome = 0, totalPredAway = 0;
  let totalActualHome = 0, totalActualAway = 0;
  let totalBrier = 0;

  for (const pred of predictions) {
    const aHome = pred.actualHomeGoals!;
    const aAway = pred.actualAwayGoals!;

    // Accuracy
    if (pred.exactScoreHit) exactHits++;
    if (pred.top3Hit) top3Hits++;
    if (pred.top5Hit) top5Hits++;
    if (pred.resultHit) resultHits++;

    // MAE: |predicted lambda - actual goals|
    totalHomeError += Math.abs(pred.lambdaHome - aHome);
    totalAwayError += Math.abs(pred.lambdaAway - aAway);

    // Averages
    totalPredHome += pred.lambdaHome;
    totalPredAway += pred.lambdaAway;
    totalActualHome += aHome;
    totalActualAway += aAway;

    // Brier Score
    const isHome = aHome > aAway ? 1 : 0;
    const isDraw = aHome === aAway ? 1 : 0;
    const isAway = aHome < aAway ? 1 : 0;
    totalBrier +=
      Math.pow(pred.probHome - isHome, 2) +
      Math.pow(pred.probDraw - isDraw, 2) +
      Math.pow(pred.probAway - isAway, 2);
  }

  return {
    model: model || 'ALL',
    totalMatches: total,
    exactScore: {
      top1Accuracy: exactHits / total,
      top3Accuracy: top3Hits / total,
      top5Accuracy: top5Hits / total,
    },
    matchResultAccuracy: resultHits / total,
    goals: {
      homeMAE: totalHomeError / total,
      awayMAE: totalAwayError / total,
      totalMAE: (totalHomeError + totalAwayError) / total,
      avgPredictedHome: totalPredHome / total,
      avgPredictedAway: totalPredAway / total,
      avgActualHome: totalActualHome / total,
      avgActualAway: totalActualAway / total,
    },
    brierScore: totalBrier / total,
    benchmark: {
      randomBrier: 0.667,
      description: 'Brier Score: 0 = perfect, 0.667 = random, 2 = worst',
    },
  };
}

/**
 * Generate a segmented report by league.
 */
export async function generateSegmentedReport(model?: string): Promise<SegmentedReport> {
  const overall = await generateBacktestReport(model);

  // Get distinct leagues
  const leagues = await prisma.matchPrediction.findMany({
    where: {
      evaluatedAt: { not: null as unknown as undefined },
      leagueName: { not: null as unknown as undefined },
      ...(model ? { model } : {}),
    },
    select: { leagueName: true },
    distinct: ['leagueName'],
  });

  const byLeague: Record<string, BacktestReport> = {};

  for (const league of leagues) {
    if (!league.leagueName) continue;

    const preds = await prisma.matchPrediction.findMany({
      where: {
        evaluatedAt: { not: null as unknown as undefined },
        leagueName: league.leagueName,
        ...(model ? { model } : {}),
      },
      select: {
        lambdaHome: true,
        lambdaAway: true,
        probHome: true,
        probDraw: true,
        probAway: true,
        actualHomeGoals: true,
        actualAwayGoals: true,
        exactScoreHit: true,
        top3Hit: true,
        top5Hit: true,
        resultHit: true,
      },
    });

    if (preds.length === 0) continue;

    byLeague[league.leagueName] = computeMetrics(preds, league.leagueName);
  }

  return { overall, byLeague };
}

/**
 * Compare two models side by side.
 */
export async function compareModels(modelA: string, modelB: string): Promise<SegmentedReport['comparison']> {
  const reportA = await generateBacktestReport(modelA);
  const reportB = await generateBacktestReport(modelB);

  if (reportA.totalMatches === 0 || reportB.totalMatches === 0) return undefined;

  const improvements: string[] = [];
  let winner = 'TIE';

  if (reportB.brierScore < reportA.brierScore) {
    improvements.push(`Brier Score: ${reportA.brierScore.toFixed(4)} → ${reportB.brierScore.toFixed(4)}`);
    winner = modelB;
  } else if (reportA.brierScore < reportB.brierScore) {
    winner = modelA;
  }

  if (reportB.matchResultAccuracy > reportA.matchResultAccuracy) {
    improvements.push(`1X2 Accuracy: ${(reportA.matchResultAccuracy * 100).toFixed(1)}% → ${(reportB.matchResultAccuracy * 100).toFixed(1)}%`);
    if (winner === 'TIE') winner = modelB;
  }

  if (reportB.goals.totalMAE < reportA.goals.totalMAE) {
    improvements.push(`Total Goals MAE: ${reportA.goals.totalMAE.toFixed(3)} → ${reportB.goals.totalMAE.toFixed(3)}`);
    if (winner === 'TIE') winner = modelB;
  }

  if (reportB.exactScore.top1Accuracy > reportA.exactScore.top1Accuracy) {
    improvements.push(`Exact Score Top1: ${(reportA.exactScore.top1Accuracy * 100).toFixed(1)}% → ${(reportB.exactScore.top1Accuracy * 100).toFixed(1)}%`);
  }

  return {
    modelA: reportA,
    modelB: reportB,
    winner,
    improvements,
  };
}

// ============ Helpers ============

function emptyReport(model: string): BacktestReport {
  return {
    model,
    totalMatches: 0,
    exactScore: { top1Accuracy: 0, top3Accuracy: 0, top5Accuracy: 0 },
    matchResultAccuracy: 0,
    goals: {
      homeMAE: 0, awayMAE: 0, totalMAE: 0,
      avgPredictedHome: 0, avgPredictedAway: 0,
      avgActualHome: 0, avgActualAway: 0,
    },
    brierScore: 0,
    benchmark: { randomBrier: 0.667, description: 'Brier Score: 0 = perfect, 0.667 = random, 2 = worst' },
  };
}

function computeMetrics(
  predictions: Array<{
    lambdaHome: number; lambdaAway: number;
    probHome: number; probDraw: number; probAway: number;
    actualHomeGoals: number | null; actualAwayGoals: number | null;
    exactScoreHit: boolean | null; top3Hit: boolean | null;
    top5Hit: boolean | null; resultHit: boolean | null;
  }>,
  label: string
): BacktestReport {
  const total = predictions.length;
  let exactHits = 0, top3Hits = 0, top5Hits = 0, resultHits = 0;
  let totalHomeError = 0, totalAwayError = 0;
  let totalPredHome = 0, totalPredAway = 0;
  let totalActualHome = 0, totalActualAway = 0;
  let totalBrier = 0;

  for (const pred of predictions) {
    const aHome = pred.actualHomeGoals!;
    const aAway = pred.actualAwayGoals!;

    if (pred.exactScoreHit) exactHits++;
    if (pred.top3Hit) top3Hits++;
    if (pred.top5Hit) top5Hits++;
    if (pred.resultHit) resultHits++;

    totalHomeError += Math.abs(pred.lambdaHome - aHome);
    totalAwayError += Math.abs(pred.lambdaAway - aAway);
    totalPredHome += pred.lambdaHome;
    totalPredAway += pred.lambdaAway;
    totalActualHome += aHome;
    totalActualAway += aAway;

    const isHome = aHome > aAway ? 1 : 0;
    const isDraw = aHome === aAway ? 1 : 0;
    const isAway = aHome < aAway ? 1 : 0;
    totalBrier +=
      Math.pow(pred.probHome - isHome, 2) +
      Math.pow(pred.probDraw - isDraw, 2) +
      Math.pow(pred.probAway - isAway, 2);
  }

  return {
    model: label,
    totalMatches: total,
    exactScore: {
      top1Accuracy: exactHits / total,
      top3Accuracy: top3Hits / total,
      top5Accuracy: top5Hits / total,
    },
    matchResultAccuracy: resultHits / total,
    goals: {
      homeMAE: totalHomeError / total,
      awayMAE: totalAwayError / total,
      totalMAE: (totalHomeError + totalAwayError) / total,
      avgPredictedHome: totalPredHome / total,
      avgPredictedAway: totalPredAway / total,
      avgActualHome: totalActualHome / total,
      avgActualAway: totalActualAway / total,
    },
    brierScore: totalBrier / total,
    benchmark: { randomBrier: 0.667, description: 'Brier Score: 0 = perfect, 0.667 = random, 2 = worst' },
  };
}

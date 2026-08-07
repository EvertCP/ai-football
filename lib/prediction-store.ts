/**
 * Prediction Store — Persistence layer for match predictions.
 *
 * Handles saving pre-match prediction snapshots and post-match evaluation.
 * Predictions are immutable once saved; evaluation fills in actual results.
 */

import { prisma } from './prisma';
import type { ExactScorePrediction } from './prediction-engine';

interface SavePredictionInput {
  fixtureId: number;
  fixtureName: string;
  fixtureDate: string;
  leagueId?: number;
  leagueName?: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  prediction: ExactScorePrediction;
  lambdaSource: string;
}

/**
 * Save a pre-match prediction snapshot.
 * Uses upsert to avoid duplicates (unique on fixtureId + model).
 */
export async function savePrediction(input: SavePredictionInput) {
  const { prediction } = input;

  const ou25 = prediction.totals.find(t => t.line === 2.5);

  return prisma.matchPrediction.upsert({
    where: {
      fixtureId_model: {
        fixtureId: input.fixtureId,
        model: prediction.model,
      },
    },
    create: {
      fixtureId: input.fixtureId,
      fixtureName: input.fixtureName,
      fixtureDate: input.fixtureDate,
      leagueId: input.leagueId ?? null,
      leagueName: input.leagueName ?? null,
      homeTeamId: input.homeTeamId,
      homeTeamName: input.homeTeamName,
      awayTeamId: input.awayTeamId,
      awayTeamName: input.awayTeamName,
      model: prediction.model,
      lambdaHome: prediction.expectedGoals.home,
      lambdaAway: prediction.expectedGoals.away,
      lambdaSource: input.lambdaSource,
      probHome: prediction.matchResult.home,
      probDraw: prediction.matchResult.draw,
      probAway: prediction.matchResult.away,
      topExactScores: JSON.stringify(
        prediction.topExactScores.map(s => ({
          score: s.score,
          probability: s.probability,
        }))
      ),
      over25: ou25?.over ?? 0,
      under25: ou25?.under ?? 0,
      bttsYes: prediction.btts.yes,
      bttsNo: prediction.btts.no,
      maxGoals: prediction.metadata.maxGoals,
      totalProbabilityMass: prediction.metadata.totalProbabilityMass,
    },
    update: {
      // Predictions are immutable — no update fields
      // This effectively makes it a "create if not exists"
    },
  });
}

/**
 * Evaluate a prediction against actual match results.
 * Called after the match has finished.
 */
export async function evaluatePrediction(
  fixtureId: number,
  model: string,
  actualHomeGoals: number,
  actualAwayGoals: number
) {
  const prediction = await prisma.matchPrediction.findUnique({
    where: {
      fixtureId_model: { fixtureId, model },
    },
  });

  if (!prediction) return null;

  const actualScore = `${actualHomeGoals}-${actualAwayGoals}`;
  const topScores: { score: string; probability: number }[] = JSON.parse(
    prediction.topExactScores
  );

  // Check if the actual result matches the predicted 1X2
  let predictedResult: 'home' | 'draw' | 'away';
  if (prediction.probHome >= prediction.probDraw && prediction.probHome >= prediction.probAway) {
    predictedResult = 'home';
  } else if (prediction.probAway >= prediction.probDraw) {
    predictedResult = 'away';
  } else {
    predictedResult = 'draw';
  }

  let actualResult: 'home' | 'draw' | 'away';
  if (actualHomeGoals > actualAwayGoals) actualResult = 'home';
  else if (actualHomeGoals < actualAwayGoals) actualResult = 'away';
  else actualResult = 'draw';

  return prisma.matchPrediction.update({
    where: {
      fixtureId_model: { fixtureId, model },
    },
    data: {
      actualHomeGoals,
      actualAwayGoals,
      actualScore,
      exactScoreHit: topScores.length > 0 && topScores[0].score === actualScore,
      top3Hit: topScores.slice(0, 3).some(s => s.score === actualScore),
      top5Hit: topScores.slice(0, 5).some(s => s.score === actualScore),
      resultHit: predictedResult === actualResult,
      evaluatedAt: new Date(),
    },
  });
}

/**
 * Get all predictions for a fixture.
 */
export async function getPredictionsByFixture(fixtureId: number) {
  return prisma.matchPrediction.findMany({
    where: { fixtureId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get aggregated accuracy stats for backtesting.
 */
export async function getAccuracyStats(model?: string) {
  const where = {
    evaluatedAt: { not: null as unknown as undefined },
    ...(model ? { model } : {}),
  };

  const total = await prisma.matchPrediction.count({ where });
  if (total === 0) return null;

  const exactHits = await prisma.matchPrediction.count({
    where: { ...where, exactScoreHit: true },
  });
  const top3Hits = await prisma.matchPrediction.count({
    where: { ...where, top3Hit: true },
  });
  const top5Hits = await prisma.matchPrediction.count({
    where: { ...where, top5Hit: true },
  });
  const resultHits = await prisma.matchPrediction.count({
    where: { ...where, resultHit: true },
  });

  return {
    totalEvaluated: total,
    exactScoreAccuracy: exactHits / total,
    top3Accuracy: top3Hits / total,
    top5Accuracy: top5Hits / total,
    resultAccuracy: resultHits / total,
    exactHits,
    top3Hits,
    top5Hits,
    resultHits,
  };
}

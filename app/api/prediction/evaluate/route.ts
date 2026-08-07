import { NextRequest, NextResponse } from 'next/server';
import { evaluatePendingPredictions, generateBacktestReport, generateSegmentedReport, compareModels } from '@/lib/backtesting';
import { getFixtureById } from '@/lib/sportmonks';

export const dynamic = 'force-dynamic';

/**
 * POST /api/prediction/evaluate
 *
 * Evaluates all pending predictions against actual match results.
 * Fetches actual scores from Sportmonks for finished matches.
 */
export async function POST() {
  try {
    const evaluated = await evaluatePendingPredictions(async (fixtureId) => {
      try {
        const response = await getFixtureById(fixtureId);
        const fixture = response.data;

        if (!fixture?.scores || fixture.scores.length === 0) return null;

        // Only evaluate finished matches
        const state = fixture.state?.developer_name;
        if (state !== 'FT' && state !== 'AET' && state !== 'FT_PEN') return null;

        const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
        let homeGoals = 0;
        let awayGoals = 0;

        fixture.scores.forEach(s => {
          if (s.description === 'CURRENT') {
            if (s.participant_id === homeTeam?.id) {
              homeGoals = s.score.goals;
            } else {
              awayGoals = s.score.goals;
            }
          }
        });

        return { homeGoals, awayGoals };
      } catch {
        return null;
      }
    });

    return NextResponse.json({
      data: {
        evaluated,
        message: `${evaluated} prediction(s) evaluated successfully.`,
      },
    });
  } catch (error) {
    console.error('[API/prediction/evaluate] Error:', error);
    return NextResponse.json(
      { error: 'Error al evaluar predicciones' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prediction/evaluate?model=POISSON_V1&compare=POISSON_V2&segmented=true
 *
 * Returns the backtesting report.
 * - model: filter by specific model
 * - compare: compare two models (requires model param as modelA)
 * - segmented: include per-league breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') || undefined;
    const compareWith = searchParams.get('compare') || undefined;
    const segmented = searchParams.get('segmented') === 'true';

    // Model comparison mode
    if (model && compareWith) {
      const comparison = await compareModels(model, compareWith);
      return NextResponse.json({ data: { comparison } });
    }

    // Segmented report mode
    if (segmented) {
      const report = await generateSegmentedReport(model);
      return NextResponse.json({ data: report });
    }

    // Standard report
    const report = await generateBacktestReport(model);
    return NextResponse.json({ data: report });
  } catch (error) {
    console.error('[API/prediction/evaluate] Error:', error);
    return NextResponse.json(
      { error: 'Error al generar reporte' },
      { status: 500 }
    );
  }
}

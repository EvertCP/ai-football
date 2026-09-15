import { NextRequest, NextResponse } from 'next/server';
import { getPlayerPicksForFixture, getPlayerPicksForDate } from '@/lib/player-picks';
import { ApiRateLimitError } from '@/lib/api-football';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fixtureId = searchParams.get('fixtureId');
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const matchWindow = Math.min(Math.max(Number(searchParams.get('matches') || 5), 3), 10);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 50);

  try {
    if (fixtureId) {
      const picks = await getPlayerPicksForFixture(Number(fixtureId), matchWindow, limit);
      return NextResponse.json({
        data: picks,
        meta: {
          fixtureId: Number(fixtureId),
          matchWindow,
          totalPicks: picks.length,
          message: 'Player Picks calculado para el partido seleccionado',
        },
      });
    }

    const { picks, fixtureId: firstFixtureId } = await getPlayerPicksForDate(
      date,
      matchWindow,
      limit,
      2
    );

    return NextResponse.json({
      data: picks,
      meta: {
        date,
        fixtureId: firstFixtureId,
        matchWindow,
        totalPicks: picks.length,
        message: 'Player Picks calculado para los primeros partidos del día',
      },
    });
  } catch (error) {
    if (error instanceof ApiRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

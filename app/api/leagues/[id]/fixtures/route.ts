import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSeason, getFixturesByLeague } from '@/lib/api-football';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leagues/[id]/fixtures
 * Returns fixtures for a specific league's current (latest) season.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leagueId = parseInt(params.id, 10);

    // Get current season for this league
    const season = await getCurrentSeason(leagueId);
    if (!season) {
      return NextResponse.json({
        data: [],
        pagination: null,
      });
    }

    const fixtures = await getFixturesByLeague(leagueId, season);

    return NextResponse.json({
      data: fixtures,
      pagination: null,
    });
  } catch (error) {
    console.error(`[API/leagues/${params.id}/fixtures] Error:`, error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al obtener partidos de la competencia', details: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}

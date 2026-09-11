import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSeason, getStandings } from '@/lib/api-football';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leagues/[id]/standings
 * Returns standings/table for a specific league's current season
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leagueId = parseInt(params.id, 10);

    const season = await getCurrentSeason(leagueId);
    if (!season) {
      return NextResponse.json({ data: [] });
    }

    const standingsGroups = await getStandings(leagueId, season);

    // Flatten groups and map to frontend-compatible format
    const standings = standingsGroups.flat().map(s => ({
      position: s.rank,
      participant: s.team,
      group: { name: s.group },
      points: s.points,
      overall: {
        games_played: s.all.played,
        won: s.all.win,
        draw: s.all.draw,
        lost: s.all.lose,
        goals_scored: s.all.goals.for,
        goals_against: s.all.goals.against,
        goal_difference: s.goalsDiff,
        points: s.points,
      },
      home: {
        games_played: s.home.played,
        won: s.home.win,
        draw: s.home.draw,
        lost: s.home.lose,
        goals_scored: s.home.goals.for,
        goals_against: s.home.goals.against,
        points: 0, // API-Football doesn't split points by venue
      },
      away: {
        games_played: s.away.played,
        won: s.away.win,
        draw: s.away.draw,
        lost: s.away.lose,
        goals_scored: s.away.goals.for,
        goals_against: s.away.goals.against,
        points: 0,
      },
      form: s.form,
      description: s.description,
    }));

    return NextResponse.json({
      data: standings,
    });
  } catch (error) {
    console.error(`[API/leagues/${params.id}/standings] Error:`, error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al obtener la tabla de posiciones', details: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}

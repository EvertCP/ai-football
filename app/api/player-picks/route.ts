import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/player-picks?date=YYYY-MM-DD&limit=20
 * 
 * NOTE: Player Picks is temporarily disabled during API migration.
 * It requires detailed lineup statistics which need to be re-implemented with API-Football.
 * 
 * Returns top player picks for upcoming matches on the given date.
 * 
 * Flow:
 * 1. Get fixtures for the date (all states - upcoming, live, finished)
 * 2. For each team playing, get their schedule to find recent completed fixture IDs
 * 3. Fetch those fixtures with lineup details (player stats)
 * 4. For each player in the upcoming match, calculate pick percentages
 * 5. Rank and return top N picks
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  return NextResponse.json({
    data: [],
    meta: {
      date,
      message: 'Player Picks está temporalmente deshabilitado durante la migración a API-Football. Próximamente.',
    },
  });
}

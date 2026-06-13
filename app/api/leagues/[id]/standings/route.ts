import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
const SPORTMONKS_BASE_URL = process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/football';

/**
 * GET /api/leagues/[id]/standings
 * Returns standings/table for a specific league's current season
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leagueId = params.id;

    const url = new URL(`${SPORTMONKS_BASE_URL}/standings/live/leagues/${leagueId}`);
    url.searchParams.set('api_token', SPORTMONKS_API_TOKEN || '');
    url.searchParams.set('include', 'participant;group;details');

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Sportmonks API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();

    // Map details array into a structured object per standing
    // Type IDs: 129=MP, 130=W, 131=D, 132=L, 133=GF, 134=GC, 179=GD, 187=PTS
    // Home: 135=MP, 136=W, 137=D, 138=L, 139=GF, 140=GC, 185=PTS
    // Away: 141=MP, 142=W, 143=D, 144=L, 145=GF, 146=GC, 186=PTS
    const standings = (data.data || []).map((s: Record<string, unknown>) => {
      const details = (s.details || []) as Array<{ type_id: number; value: number }>;
      const detailMap: Record<number, number> = {};
      details.forEach(d => { detailMap[d.type_id] = d.value; });

      return {
        ...s,
        overall: {
          games_played: detailMap[129] ?? 0,
          won: detailMap[130] ?? 0,
          draw: detailMap[131] ?? 0,
          lost: detailMap[132] ?? 0,
          goals_scored: detailMap[133] ?? 0,
          goals_against: detailMap[134] ?? 0,
          goal_difference: detailMap[179] ?? 0,
          points: detailMap[187] ?? (s as Record<string, unknown>).points ?? 0,
        },
        home: {
          games_played: detailMap[135] ?? 0,
          won: detailMap[136] ?? 0,
          draw: detailMap[137] ?? 0,
          lost: detailMap[138] ?? 0,
          goals_scored: detailMap[139] ?? 0,
          goals_against: detailMap[140] ?? 0,
          points: detailMap[185] ?? 0,
        },
        away: {
          games_played: detailMap[141] ?? 0,
          won: detailMap[142] ?? 0,
          draw: detailMap[143] ?? 0,
          lost: detailMap[144] ?? 0,
          goals_scored: detailMap[145] ?? 0,
          goals_against: detailMap[146] ?? 0,
          points: detailMap[186] ?? 0,
        },
      };
    });

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

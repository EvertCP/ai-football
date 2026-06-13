import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
const SPORTMONKS_BASE_URL = process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/football';

/**
 * GET /api/leagues/[id]/fixtures?page=1
 * Returns fixtures for a specific league's current (latest) season.
 * First fetches the league to determine the latest season, then queries fixtures.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leagueId = params.id;
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';

    // Step 1: Get the latest season for this league
    const leagueUrl = new URL(`${SPORTMONKS_BASE_URL}/leagues/${leagueId}`);
    leagueUrl.searchParams.set('api_token', SPORTMONKS_API_TOKEN || '');
    leagueUrl.searchParams.set('include', 'seasons');

    const leagueRes = await fetch(leagueUrl.toString(), {
      headers: { Accept: 'application/json' },
    });

    let seasonFilter = '';
    if (leagueRes.ok) {
      const leagueData = await leagueRes.json();
      const seasons = leagueData.data?.seasons || [];
      if (seasons.length > 0) {
        // Get the most recent season (highest ID = latest)
        const latestSeason = seasons.sort((a: { id: number }, b: { id: number }) => b.id - a.id)[0];
        seasonFilter = `;fixtureSeasons:${latestSeason.id}`;
      }
    }

    // Step 2: Fetch fixtures filtered by league and current season
    const url = new URL(`${SPORTMONKS_BASE_URL}/fixtures`);
    url.searchParams.set('api_token', SPORTMONKS_API_TOKEN || '');
    url.searchParams.set('include', 'participants;league;state;scores;venue');
    url.searchParams.set('filters', `fixtureLeagues:${leagueId}${seasonFilter}`);
    url.searchParams.set('sortBy', 'starting_at');
    url.searchParams.set('order', 'asc');
    url.searchParams.set('per_page', '50');
    url.searchParams.set('page', page);

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Sportmonks API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();

    return NextResponse.json({
      data: data.data || [],
      pagination: data.pagination || null,
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

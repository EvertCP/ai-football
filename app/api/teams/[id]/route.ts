import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
const SPORTMONKS_BASE_URL = process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/football';

/**
 * GET /api/teams/[id]
 * Returns full team information including:
 * - Team details & venue
 * - Squad (players with positions)
 * - Coaches
 * - Seasons/leagues
 * - Upcoming fixtures
 * - Latest results
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teamId = params.id;

    const url = new URL(`${SPORTMONKS_BASE_URL}/teams/${teamId}`);
    url.searchParams.set('api_token', SPORTMONKS_API_TOKEN || '');
    url.searchParams.set('include', [
      'venue',
      'coaches',
      'players.player.position',
      'seasons.league',
      'upcoming.participants',
      'upcoming.league',
      'upcoming.state',
      'upcoming.venue',
      'latest.participants',
      'latest.scores',
      'latest.state',
      'latest.league',
    ].join(';'));

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Sportmonks API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    const team = data.data;

    if (!team) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    // Process players: sort by position
    // Note: For national teams, all players may have past end dates (per tournament squad)
    // so we show all players without filtering by end date
    const players = (team.players || [])
      .sort((a: { position_id: number; jersey_number: number }, b: { position_id: number; jersey_number: number }) => {
        // Sort: GK(24) -> Def(25) -> Mid(26) -> Att(27)
        if (a.position_id !== b.position_id) return a.position_id - b.position_id;
        return (a.jersey_number || 99) - (b.jersey_number || 99);
      })
      .map((sq: {
        player_id: number;
        position_id: number;
        jersey_number: number | null;
        captain: boolean;
        start: string | null;
        end: string | null;
        player?: {
          id: number;
          common_name: string;
          firstname: string;
          lastname: string;
          display_name: string;
          image_path: string;
          date_of_birth: string;
          nationality_id: number;
          height: number;
          weight: number;
          position?: { id: number; name: string };
        };
      }) => ({
        id: sq.player_id,
        name: sq.player?.common_name || sq.player?.display_name || `${sq.player?.firstname} ${sq.player?.lastname}`,
        image: sq.player?.image_path || '',
        position: sq.player?.position?.name || positionName(sq.position_id),
        positionId: sq.position_id,
        jerseyNumber: sq.jersey_number,
        captain: sq.captain,
        dateOfBirth: sq.player?.date_of_birth || null,
        height: sq.player?.height || null,
        weight: sq.player?.weight || null,
      }));

    // Process coaches
    const coaches = (team.coaches || []).map((c: {
      coach_id: number;
      firstname: string;
      lastname: string;
      common_name: string;
      image_path: string;
      date_of_birth: string;
      nationality_id: number;
    }) => ({
      id: c.coach_id,
      name: c.common_name || `${c.firstname} ${c.lastname}`,
      image: c.image_path || '',
      dateOfBirth: c.date_of_birth || null,
    }));

    // Process seasons (deduplicate by league)
    const seasonsMap = new Map<number, { leagueId: number; leagueName: string; leagueImage: string; seasonName: string }>();
    (team.seasons || []).forEach((s: {
      league_id: number;
      name: string;
      league?: { id: number; name: string; image_path: string };
    }) => {
      if (s.league && !seasonsMap.has(s.league_id)) {
        seasonsMap.set(s.league_id, {
          leagueId: s.league_id,
          leagueName: s.league.name,
          leagueImage: s.league.image_path || '',
          seasonName: s.name,
        });
      }
    });
    const leagues = Array.from(seasonsMap.values());

    // Process latest results (last 10)
    const latest = (team.latest || []).slice(0, 10);

    // Process upcoming fixtures
    const upcoming = team.upcoming || [];

    return NextResponse.json({
      data: {
        id: team.id,
        name: team.name,
        shortCode: team.short_code,
        image: team.image_path,
        founded: team.founded,
        type: team.type,
        venue: team.venue ? {
          name: team.venue.name,
          city: team.venue.city_name,
          capacity: team.venue.capacity,
          image: team.venue.image_path,
          surface: team.venue.surface,
          address: team.venue.address,
        } : null,
        coaches,
        players,
        leagues,
        upcoming,
        latest,
      },
    });
  } catch (error) {
    console.error(`[API/teams/${params.id}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al obtener datos del equipo', details: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}

function positionName(positionId: number): string {
  switch (positionId) {
    case 24: return 'Goalkeeper';
    case 25: return 'Defender';
    case 26: return 'Midfielder';
    case 27: return 'Attacker';
    default: return 'Unknown';
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getTeamById, getTeamSquad, getTeamFixtures, getTeamNextFixtures } from '@/lib/api-football';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teams/[id]
 * Returns full team information including:
 * - Team details & venue
 * - Squad (players with positions)
 * - Upcoming fixtures
 * - Latest results
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const teamId = parseInt(params.id, 10);

    // Fetch team info, squad, latest results, and upcoming in parallel
    const [teamInfo, squad, latest, upcoming] = await Promise.all([
      getTeamById(teamId),
      getTeamSquad(teamId),
      getTeamFixtures(teamId, 10),
      getTeamNextFixtures(teamId, 5),
    ]);

    if (!teamInfo) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    const t = teamInfo.team;
    const v = teamInfo.venue;

    // Map squad to frontend format
    const posOrder: Record<string, number> = { Goalkeeper: 1, Defender: 2, Midfielder: 3, Attacker: 4 };
    const players = (squad?.players || [])
      .sort((a, b) => (posOrder[a.position] || 5) - (posOrder[b.position] || 5) || (a.number || 99) - (b.number || 99))
      .map(p => ({
        id: p.id,
        name: p.name,
        image: p.photo,
        position: p.position,
        positionId: posOrder[p.position] ? posOrder[p.position] + 23 : 0, // 24=GK, 25=Def, 26=Mid, 27=Att
        jerseyNumber: p.number,
        captain: false,
        dateOfBirth: null,
        height: null,
        weight: null,
      }));

    return NextResponse.json({
      data: {
        id: t.id,
        name: t.name,
        shortCode: t.code || t.name.substring(0, 3).toUpperCase(),
        image: t.logo,
        founded: t.founded,
        type: t.national ? 'national' : 'domestic',
        venue: v ? {
          name: v.name,
          city: v.city,
          capacity: v.capacity,
          image: v.image,
          surface: v.surface,
          address: v.address,
        } : null,
        coaches: [],
        players,
        leagues: [],
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

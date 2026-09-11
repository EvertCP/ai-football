import { NextResponse } from 'next/server';
import { getLeagues } from '@/lib/api-football';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leagues
 * Returns all leagues available in the current subscription
 */
export async function GET() {
  try {
    const leagues = await getLeagues();

    // Map to normalized format for frontend compatibility
    const mapped = leagues.map(l => ({
      id: l.league.id,
      name: l.league.name,
      type: l.league.type,
      image_path: l.league.logo,
      country: l.country,
      currentSeason: l.seasons.find(s => s.current) || null,
    }));

    return NextResponse.json({
      data: mapped,
    });
  } catch (error) {
    console.error('[API/leagues] Error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al obtener las competencias', details: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}

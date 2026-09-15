import { NextRequest, NextResponse } from 'next/server';
import { getLeaguesByDate, ApiRateLimitError } from '@/lib/api-football';
import { NormalizedFixture } from '@/types/football';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fixtures/by-date?date=YYYY-MM-DD&tz=-6
 * Uses API-Football to get all fixtures for a specific LOCAL date.
 * The `tz` param is the timezone offset in hours (e.g., -6 for Mexico City).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const tzOffset = parseInt(searchParams.get('tz') || '0', 10);

    if (!date) {
      return NextResponse.json(
        { error: 'El parámetro "date" es requerido (formato: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Calculate which UTC dates to query based on user's timezone
    const dates = [date];
    if (tzOffset < 0) {
      const nextDay = new Date(date + 'T12:00:00Z');
      nextDay.setDate(nextDay.getDate() + 1);
      dates.push(nextDay.toISOString().split('T')[0]);
    } else if (tzOffset > 0) {
      const prevDay = new Date(date + 'T12:00:00Z');
      prevDay.setDate(prevDay.getDate() - 1);
      dates.push(prevDay.toISOString().split('T')[0]);
    }

    // Fetch fixtures for all needed UTC dates
    const allLeagues: Record<number, {
      id: number;
      name: string;
      image_path: string;
      today: NormalizedFixture[];
    }> = {};

    for (const d of dates) {
      const leagues = await getLeaguesByDate(d);
      for (const league of leagues) {
        if (!allLeagues[league.id]) {
          allLeagues[league.id] = {
            id: league.id,
            name: league.name,
            image_path: league.image_path,
            today: [],
          };
        }
        allLeagues[league.id].today.push(...league.fixtures);
      }
    }

    // Filter fixtures to only those that match the user's LOCAL date
    const startUTC = new Date(date + 'T00:00:00Z');
    startUTC.setUTCHours(startUTC.getUTCHours() - tzOffset);
    const endUTC = new Date(date + 'T23:59:59Z');
    endUTC.setUTCHours(endUTC.getUTCHours() - tzOffset);

    const filteredLeagues = Object.values(allLeagues).map(league => ({
      ...league,
      today: league.today.filter(fixture => {
        const fixtureTime = new Date(fixture.starting_at);
        return fixtureTime >= startUTC && fixtureTime <= endUTC;
      }),
    })).filter(league => league.today.length > 0);

    return NextResponse.json({
      data: filteredLeagues,
    });
  } catch (error) {
    if (error instanceof ApiRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    console.error('[API/fixtures/by-date] Error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al obtener partidos por fecha', details: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}

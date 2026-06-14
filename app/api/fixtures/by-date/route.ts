import { NextRequest, NextResponse } from 'next/server';
import { Fixture } from '@/types/sportmonks';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
const SPORTMONKS_BASE_URL = process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/football';

/**
 * GET /api/fixtures/by-date?date=YYYY-MM-DD&tz=-6
 * Uses the leagues/date endpoint to get all fixtures for a specific LOCAL date.
 * Since Sportmonks uses UTC dates, we fetch the selected date AND the next day,
 * then filter fixtures that actually fall on the user's local date.
 * 
 * The `tz` param is the timezone offset in hours (e.g., -6 for Mexico City).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const tzOffset = parseInt(searchParams.get('tz') || '0', 10); // hours from UTC

    if (!date) {
      return NextResponse.json(
        { error: 'El parámetro "date" es requerido (formato: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Calculate which UTC dates to query based on user's timezone
    // For negative offsets (west of UTC), late local time = next UTC day
    // For positive offsets (east of UTC), early local time = previous UTC day
    const dates = [date];
    if (tzOffset < 0) {
      // User is behind UTC: need next UTC day (e.g., 19:00 local = 01:00 UTC next day)
      const nextDay = new Date(date + 'T12:00:00Z');
      nextDay.setDate(nextDay.getDate() + 1);
      dates.push(nextDay.toISOString().split('T')[0]);
    } else if (tzOffset > 0) {
      // User is ahead of UTC: need previous UTC day
      const prevDay = new Date(date + 'T12:00:00Z');
      prevDay.setDate(prevDay.getDate() - 1);
      dates.push(prevDay.toISOString().split('T')[0]);
    }

    // Fetch fixtures for all needed UTC dates
    const allLeagues: Record<number, { id: number; name: string; image_path: string; today: Fixture[] }> = {};

    for (const d of dates) {
      const url = new URL(`${SPORTMONKS_BASE_URL}/leagues/date/${d}`);
      url.searchParams.set('api_token', SPORTMONKS_API_TOKEN || '');
      url.searchParams.set('include', 'today.scores;today.participants;today.state;today.stage;today.group;today.round');

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        const leagues = data.data || [];
        for (const league of leagues) {
          if (!allLeagues[league.id]) {
            allLeagues[league.id] = { id: league.id, name: league.name, image_path: league.image_path, today: [] };
          }
          if (league.today) {
            allLeagues[league.id].today.push(...league.today);
          }
        }
      }
    }

    // Filter fixtures to only those that match the user's LOCAL date
    const localDateStart = new Date(date + 'T00:00:00');
    localDateStart.setHours(localDateStart.getHours() - tzOffset); // Convert to UTC
    const localDateEnd = new Date(date + 'T23:59:59');
    localDateEnd.setHours(localDateEnd.getHours() - tzOffset); // Convert to UTC

    const filteredLeagues = Object.values(allLeagues).map(league => ({
      ...league,
      today: league.today.filter(fixture => {
        const fixtureTime = new Date(fixture.starting_at?.replace(' ', 'T') + 'Z');
        return fixtureTime >= localDateStart && fixtureTime <= localDateEnd;
      }),
    })).filter(league => league.today.length > 0);

    return NextResponse.json({
      data: filteredLeagues,
    });
  } catch (error) {
    console.error('[API/fixtures/by-date] Error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al obtener partidos por fecha', details: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}

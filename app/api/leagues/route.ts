import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
const SPORTMONKS_BASE_URL = process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/football';

/**
 * GET /api/leagues
 * Returns all leagues available in the current subscription
 */
export async function GET() {
  try {
    const url = new URL(`${SPORTMONKS_BASE_URL}/leagues`);
    url.searchParams.set('api_token', SPORTMONKS_API_TOKEN || '');
    url.searchParams.set('include', 'currentSeason');
    url.searchParams.set('per_page', '50');

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

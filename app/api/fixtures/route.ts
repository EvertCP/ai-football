import { NextRequest, NextResponse } from 'next/server';
import { getFixturesByDate, getLatestFixtures } from '@/lib/sportmonks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fixtures?date=YYYY-MM-DD
 * 
 * Internal API route that proxies requests to Sportmonks.
 * This keeps the API token secure on the server side.
 * 
 * If date filter returns empty (Free plan limitation), falls back
 * to the general /fixtures endpoint which returns available data.
 * 
 * TODO: Future enhancements:
 * - Add response caching (Redis)
 * - Add rate limiting per user
 * - Add authentication middleware
 * - Add league/country filters
 * - Add pagination support
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'El parámetro "date" es requerido (formato: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Try date-based endpoint first
    const response = await getFixturesByDate(date);

    // If date endpoint returns data, use it
    if (response.data && response.data.length > 0) {
      return NextResponse.json({
        data: response.data,
        pagination: response.pagination || null,
      });
    }

    // Fallback: Free plan may not support /fixtures/date/
    // Use general endpoint with latest fixtures
    const fallback = await getLatestFixtures(1, 25);

    return NextResponse.json({
      data: fallback.data || [],
      pagination: fallback.pagination || null,
      fallback: true, // Indicates we used the fallback endpoint
    });
  } catch (error) {
    console.error('[API/fixtures] Error:', error);

    const message = error instanceof Error ? error.message : 'Error desconocido';

    // Don't expose internal error details in production
    return NextResponse.json(
      {
        error: 'Error al obtener los partidos',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getFixturesByDate } from '@/lib/api-football';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fixtures?date=YYYY-MM-DD
 * 
 * Internal API route that proxies requests to API-Football.
 * This keeps the API key secure on the server side.
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

    const fixtures = await getFixturesByDate(date);

    return NextResponse.json({
      data: fixtures,
      pagination: null,
    });
  } catch (error) {
    console.error('[API/fixtures] Error:', error);

    const message = error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json(
      {
        error: 'Error al obtener los partidos',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getLatestFixtures } from '@/lib/sportmonks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fixtures/latest?page=1&perPage=25
 * 
 * Returns the latest available fixtures sorted by date (most recent first).
 * Works with the Free plan since it uses the general /fixtures endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '25', 10);

    const response = await getLatestFixtures(page, perPage);

    return NextResponse.json({
      data: response.data || [],
      pagination: response.pagination || null,
    });
  } catch (error) {
    console.error('[API/fixtures/latest] Error:', error);

    const message = error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json(
      {
        error: 'Error al obtener los últimos partidos',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    );
  }
}

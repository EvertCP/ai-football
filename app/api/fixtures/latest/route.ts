import { NextRequest, NextResponse } from 'next/server';
import { getLatestFixtures } from '@/lib/api-football';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fixtures/latest?perPage=25
 * 
 * Returns the latest available fixtures sorted by date (most recent first).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const perPage = parseInt(searchParams.get('perPage') || '25', 10);

    const fixtures = await getLatestFixtures(perPage);

    return NextResponse.json({
      data: fixtures,
      pagination: null,
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

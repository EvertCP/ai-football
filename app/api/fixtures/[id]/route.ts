import { NextRequest, NextResponse } from 'next/server';
import { getFixtureById } from '@/lib/api-football';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fixtures/[id]
 * 
 * Get detailed information about a specific fixture.
 * Includes statistics, scores, venue, and all available data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fixtureId = parseInt(params.id, 10);

    if (isNaN(fixtureId)) {
      return NextResponse.json(
        { error: 'ID de partido inválido' },
        { status: 400 }
      );
    }

    const fixture = await getFixtureById(fixtureId);

    return NextResponse.json({
      data: fixture || null,
    });
  } catch (error) {
    console.error(`[API/fixtures/${params.id}] Error:`, error);

    const message = error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json(
      {
        error: 'Error al obtener el detalle del partido',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    );
  }
}

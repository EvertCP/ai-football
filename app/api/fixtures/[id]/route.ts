import { NextRequest, NextResponse } from 'next/server';
import { getFixtureById } from '@/lib/sportmonks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fixtures/[id]
 * 
 * Get detailed information about a specific fixture.
 * Includes statistics, scores, venue, and all available data.
 * 
 * TODO: Future enhancements:
 * - Cache individual fixture data
 * - Add head-to-head data
 * - Add team form (last 5 matches)
 * - Add player statistics
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

    const response = await getFixtureById(fixtureId);

    return NextResponse.json({
      data: response.data || null,
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

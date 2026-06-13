import { NextRequest, NextResponse } from 'next/server';
import { getFixtureById } from '@/lib/sportmonks';
import { generatePrediction, TeamForm, H2HRecord } from '@/lib/predictor';
import { Fixture } from '@/types/sportmonks';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
const SPORTMONKS_BASE_URL = process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/football';

/**
 * GET /api/prediction?fixtureId=123
 * 
 * Generates a prediction for a specific fixture.
 * Fetches fixture data, team form (last matches) and H2H from Sportmonks.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixtureId');

    if (!fixtureId) {
      return NextResponse.json(
        { error: 'El parámetro "fixtureId" es requerido' },
        { status: 400 }
      );
    }

    const id = parseInt(fixtureId, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID de partido inválido' },
        { status: 400 }
      );
    }

    // Fetch fixture data from Sportmonks
    const fixtureResponse = await getFixtureById(id);
    const fixture = fixtureResponse.data;

    if (!fixture) {
      return NextResponse.json(
        { error: 'Partido no encontrado' },
        { status: 404 }
      );
    }

    const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
    const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');

    // Fetch team form (with stats), H2H in parallel
    const [homeForm, awayForm, h2h] = await Promise.all([
      homeTeam ? fetchTeamForm(homeTeam.id) : Promise.resolve(null),
      awayTeam ? fetchTeamForm(awayTeam.id) : Promise.resolve(null),
      homeTeam && awayTeam ? fetchH2H(homeTeam.id, awayTeam.id) : Promise.resolve(null),
    ]);

    // Generate prediction using real data
    const prediction = generatePrediction(fixture, homeForm, awayForm, h2h);


    return NextResponse.json({
      data: {
        fixture: {
          id: fixture.id,
          name: fixture.name,
          starting_at: fixture.starting_at,
          participants: fixture.participants,
          league: fixture.league,
        },
        prediction,
        homeForm: homeForm ? {
          matches: homeForm.matches,
          wins: homeForm.wins,
          draws: homeForm.draws,
          losses: homeForm.losses,
          avgGoalsFor: homeForm.avgGoalsFor,
          avgGoalsAgainst: homeForm.avgGoalsAgainst,
          winRate: homeForm.winRate,
          form: homeForm.form,
          estimatedXG: homeForm.estimatedXG,
        } : null,
        awayForm: awayForm ? {
          matches: awayForm.matches,
          wins: awayForm.wins,
          draws: awayForm.draws,
          losses: awayForm.losses,
          avgGoalsFor: awayForm.avgGoalsFor,
          avgGoalsAgainst: awayForm.avgGoalsAgainst,
          winRate: awayForm.winRate,
          form: awayForm.form,
          estimatedXG: awayForm.estimatedXG,
        } : null,
        h2h: h2h || null,
      },
    });
  } catch (error) {
    console.error('[API/prediction] Error:', error);

    const message = error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json(
      {
        error: 'Error al generar la predicción',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch last matches for a team and compute form stats
 */
async function fetchTeamForm(teamId: number): Promise<TeamForm | null> {
  try {
    const url = `${SPORTMONKS_BASE_URL}/teams/${teamId}?api_token=${SPORTMONKS_API_TOKEN}&include=latest.scores;latest.participants;latest.state;latest.statistics`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const matches: Fixture[] = data.data?.latest || [];

    // Take last 10 finished matches
    const finished = matches
      .filter((m: Fixture) => m.state?.developer_name === 'FT' || m.state?.developer_name === 'AET')
      .slice(0, 10);

    if (finished.length === 0) return null;

    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;

    // xG estimation accumulators
    // Uses: shots on target (86), shots inside box (49), big chances created (580)
    // Formula: xG ≈ (shots_on_target * 0.10) + (shots_inside_box * 0.08) + (big_chances * 0.35)
    let totalXGFor = 0, totalXGAgainst = 0, matchesWithStats = 0;

    finished.forEach((match: Fixture) => {
      const isHome = match.participants?.find(p => p.meta?.location === 'home')?.id === teamId;
      let homeGoals = 0, awayGoals = 0;
      match.scores?.forEach(s => {
        if (s.description === 'CURRENT') {
          const isHomeScore = s.participant_id === match.participants?.find(p => p.meta?.location === 'home')?.id;
          if (isHomeScore) homeGoals = s.score.goals;
          else awayGoals = s.score.goals;
        }
      });

      const teamGoals = isHome ? homeGoals : awayGoals;
      const oppGoals = isHome ? awayGoals : homeGoals;
      goalsFor += teamGoals;
      goalsAgainst += oppGoals;

      if (teamGoals > oppGoals) wins++;
      else if (teamGoals === oppGoals) draws++;
      else losses++;

      // Compute estimated xG from statistics
      const stats = (match as Fixture & { statistics?: Array<{ type_id: number; participant_id: number; data: { value: number } }> }).statistics;
      if (stats && stats.length > 0) {
        matchesWithStats++;
        const teamStats: Record<number, number> = {};
        const oppStats: Record<number, number> = {};
        stats.forEach(s => {
          const val = typeof s.data?.value === 'number' ? s.data.value : Number(s.data?.value) || 0;
          if (s.participant_id === teamId) teamStats[s.type_id] = val;
          else oppStats[s.type_id] = val;
        });
        // xG formula based on available stats
        const teamShotsOnTarget = teamStats[86] || 0;
        const teamShotsInBox = teamStats[49] || 0;
        const teamBigChances = teamStats[580] || 0;
        const oppShotsOnTarget = oppStats[86] || 0;
        const oppShotsInBox = oppStats[49] || 0;
        const oppBigChances = oppStats[580] || 0;

        totalXGFor += (teamShotsOnTarget * 0.10) + (teamShotsInBox * 0.08) + (teamBigChances * 0.35);
        totalXGAgainst += (oppShotsOnTarget * 0.10) + (oppShotsInBox * 0.08) + (oppBigChances * 0.35);
      }
    });

    // Compute estimated xG per match
    const estimatedXG = matchesWithStats > 0 ? {
      xgFor: totalXGFor / matchesWithStats,
      xgAgainst: totalXGAgainst / matchesWithStats,
    } : undefined;

    return {
      teamId,
      matches: finished.length,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      avgGoalsFor: goalsFor / finished.length,
      avgGoalsAgainst: goalsAgainst / finished.length,
      winRate: wins / finished.length,
      estimatedXG,
      form: finished.slice(0, 5).map((match: Fixture) => {
        const isHome = match.participants?.find(p => p.meta?.location === 'home')?.id === teamId;
        let homeGoals = 0, awayGoals = 0;
        match.scores?.forEach(s => {
          if (s.description === 'CURRENT') {
            const isHomeScore = s.participant_id === match.participants?.find(p => p.meta?.location === 'home')?.id;
            if (isHomeScore) homeGoals = s.score.goals;
            else awayGoals = s.score.goals;
          }
        });
        const teamGoals = isHome ? homeGoals : awayGoals;
        const oppGoals = isHome ? awayGoals : homeGoals;
        if (teamGoals > oppGoals) return 'W';
        if (teamGoals === oppGoals) return 'D';
        return 'L';
      }),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch head-to-head record between two teams
 */
async function fetchH2H(team1Id: number, team2Id: number): Promise<H2HRecord | null> {
  try {
    const url = `${SPORTMONKS_BASE_URL}/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${SPORTMONKS_API_TOKEN}&per_page=20&include=scores;participants;state`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const matches: Fixture[] = data.data || [];

    if (matches.length === 0) return null;

    let team1Wins = 0, team2Wins = 0, drawCount = 0;

    matches.forEach((match: Fixture) => {
      let homeGoals = 0, awayGoals = 0;
      const homeP = match.participants?.find(p => p.meta?.location === 'home');
      match.scores?.forEach(s => {
        if (s.description === 'CURRENT') {
          if (s.participant_id === homeP?.id) homeGoals = s.score.goals;
          else awayGoals = s.score.goals;
        }
      });

      const isTeam1Home = homeP?.id === team1Id;
      const t1Goals = isTeam1Home ? homeGoals : awayGoals;
      const t2Goals = isTeam1Home ? awayGoals : homeGoals;

      if (t1Goals > t2Goals) team1Wins++;
      else if (t2Goals > t1Goals) team2Wins++;
      else drawCount++;
    });

    return {
      totalMatches: matches.length,
      team1Wins,
      team2Wins,
      draws: drawCount,
    };
  } catch {
    return null;
  }
}

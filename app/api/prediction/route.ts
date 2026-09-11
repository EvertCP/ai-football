import { NextRequest, NextResponse } from 'next/server';
import { getFixtureById, getTeamFixtures, getHeadToHead, getFixtureStatistics } from '@/lib/api-football';
import { generatePrediction, TeamForm, H2HRecord } from '@/lib/predictor';
import { NormalizedFixture } from '@/types/football';
import { predictExactScores, predictExactScoresV2, calculateLambdas, calculateLambdasFromGoals, calculateLambdasV2, calculateTeamStrength, getDefaultLeagueBaseline } from '@/lib/prediction-engine';
import type { ExactScorePrediction, LambdaV2Result, TeamMatchHistory } from '@/lib/prediction-engine';
import { savePrediction } from '@/lib/prediction-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/prediction?fixtureId=123
 * 
 * Generates a prediction for a specific fixture.
 * Fetches fixture data, team form (last matches) and H2H from API-Football.
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

    // Fetch fixture data from API-Football
    const fixture = await getFixtureById(id);

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
      homeTeam && awayTeam ? fetchH2HRecord(homeTeam.id, awayTeam.id) : Promise.resolve(null),
    ]);

    // Generate heuristic prediction (existing model — preserved for comparison)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prediction = generatePrediction(fixture as any, homeForm, awayForm, h2h);

    // ========== V1 ENGINE (existing) ==========
    let exactScorePrediction: ExactScorePrediction | null = null;
    let lambdaInfo: { lambdaHome: number; lambdaAway: number; source: string } | null = null;

    try {
      if (homeForm?.estimatedXG && awayForm?.estimatedXG) {
        const lambdaResult = calculateLambdas(
          homeForm.estimatedXG,
          awayForm.estimatedXG
        );
        if (lambdaResult.lambdaHome > 0 || lambdaResult.lambdaAway > 0) {
          exactScorePrediction = predictExactScores({
            lambdaHome: lambdaResult.lambdaHome,
            lambdaAway: lambdaResult.lambdaAway,
          });
          lambdaInfo = {
            lambdaHome: lambdaResult.lambdaHome,
            lambdaAway: lambdaResult.lambdaAway,
            source: 'estimatedXG',
          };
          if (lambdaResult.warnings.length > 0) {
            console.warn('[API/prediction] Lambda V1 warnings:', lambdaResult.warnings);
          }
        }
      } else if (homeForm && awayForm && homeForm.matches >= 3 && awayForm.matches >= 3) {
        const lambdaResult = calculateLambdasFromGoals(
          homeForm.avgGoalsFor,
          homeForm.avgGoalsAgainst,
          awayForm.avgGoalsFor,
          awayForm.avgGoalsAgainst
        );
        if (lambdaResult.lambdaHome > 0 || lambdaResult.lambdaAway > 0) {
          exactScorePrediction = predictExactScores({
            lambdaHome: lambdaResult.lambdaHome,
            lambdaAway: lambdaResult.lambdaAway,
          });
          lambdaInfo = {
            lambdaHome: lambdaResult.lambdaHome,
            lambdaAway: lambdaResult.lambdaAway,
            source: 'goalAverages',
          };
        }
      }
    } catch (err) {
      console.error('[API/prediction] V1 engine error:', err);
    }

    // ========== V2 ENGINE (new — team strength based) ==========
    let exactScorePredictionV2: ExactScorePrediction | null = null;
    let lambdaV2Info: LambdaV2Result | null = null;

    try {
      if (homeForm && awayForm && homeForm.matches >= 3 && awayForm.matches >= 3) {
        // Build team match history from available form data
        const homeHistory = buildTeamHistory(homeForm);
        const awayHistory = buildTeamHistory(awayForm);

        // Use default league baseline (TODO: compute from league data when available)
        const leagueBaseline = getDefaultLeagueBaseline();

        // Calculate team strengths
        const homeStrength = calculateTeamStrength(homeHistory, leagueBaseline);
        const awayStrength = calculateTeamStrength(awayHistory, leagueBaseline);

        // Calculate V2 lambdas
        const v2Result = calculateLambdasV2({
          homeStrength,
          awayStrength,
          leagueBaseline,
          isNeutralVenue: !isHomeTeamAtHome(fixture),
        });

        lambdaV2Info = v2Result;

        if (v2Result.valid) {
          exactScorePredictionV2 = predictExactScoresV2({
            lambdaHome: v2Result.lambdaHome,
            lambdaAway: v2Result.lambdaAway,
          });
        }

        if (v2Result.warnings.length > 0) {
          console.warn('[API/prediction] Lambda V2 warnings:', v2Result.warnings);
        }
      }
    } catch (err) {
      console.error('[API/prediction] V2 engine error:', err);
    }

    // Structured logging for prediction diagnostics
    if (lambdaInfo && exactScorePrediction) {
      const ou25 = exactScorePrediction.totals.find(t => t.line === 2.5);
      console.log(JSON.stringify({
        _tag: 'PREDICTION_V1',
        fixtureId: Number(id),
        lambdaHome: lambdaInfo.lambdaHome,
        lambdaAway: lambdaInfo.lambdaAway,
        topScore: exactScorePrediction.topExactScores[0]?.score,
        topScoreProb: exactScorePrediction.topExactScores[0]?.probability,
        over25: ou25?.over,
        bttsYes: exactScorePrediction.btts.yes,
        source: lambdaInfo.source,
      }));
    }
    if (lambdaV2Info && exactScorePredictionV2) {
      const ou25v2 = exactScorePredictionV2.totals.find(t => t.line === 2.5);
      console.log(JSON.stringify({
        _tag: 'PREDICTION_V2',
        fixtureId: Number(id),
        lambdaHome: lambdaV2Info.lambdaHome,
        lambdaAway: lambdaV2Info.lambdaAway,
        topScore: exactScorePredictionV2.topExactScores[0]?.score,
        topScoreProb: exactScorePredictionV2.topExactScores[0]?.probability,
        over25: ou25v2?.over,
        bttsYes: exactScorePredictionV2.btts.yes,
        homeAttack: lambdaV2Info.diagnostics.homeAttack,
        awayDefense: lambdaV2Info.diagnostics.awayDefense,
        awayAttack: lambdaV2Info.diagnostics.awayAttack,
        homeDefense: lambdaV2Info.diagnostics.homeDefense,
      }));
    }

    // Persist prediction snapshots (non-blocking, non-fatal)
    if (exactScorePrediction && homeTeam && awayTeam && lambdaInfo) {
      savePrediction({
        fixtureId: fixture.id,
        fixtureName: fixture.name,
        fixtureDate: fixture.starting_at,
        leagueId: fixture.league?.id,
        leagueName: fixture.league?.name,
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        prediction: exactScorePrediction,
        lambdaSource: lambdaInfo.source,
      }).catch(err => {
        console.error('[API/prediction] Failed to save V1 prediction:', err);
      });
    }
    if (exactScorePredictionV2 && homeTeam && awayTeam && lambdaV2Info) {
      savePrediction({
        fixtureId: fixture.id,
        fixtureName: fixture.name,
        fixtureDate: fixture.starting_at,
        leagueId: fixture.league?.id,
        leagueName: fixture.league?.name,
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        prediction: exactScorePredictionV2,
        lambdaSource: 'teamStrengthV2',
      }).catch(err => {
        console.error('[API/prediction] Failed to save V2 prediction:', err);
      });
    }

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
        exactScorePrediction,
        exactScorePredictionV2,
        lambdaV2Diagnostics: lambdaV2Info?.diagnostics ?? null,
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
 * Fetch last matches for a team and compute form stats using API-Football.
 * Fetches per-match statistics to get xG data when available.
 */
async function fetchTeamForm(teamId: number): Promise<TeamForm | null> {
  try {
    // Get last 10 finished matches for this team
    const matches = await getTeamFixtures(teamId, 10);

    // Filter only finished matches
    const finished = matches.filter(m =>
      m.state.developer_name === 'FT' || m.state.developer_name === 'AET'
    );

    if (finished.length === 0) return null;

    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;

    // xG accumulators — API-Football may provide expected_goals directly
    let totalXGFor = 0, totalXGAgainst = 0, matchesWithXG = 0;

    // Fetch statistics for each match in parallel (to get xG)
    const statsPromises = finished.map(m => getFixtureStatistics(m.id).catch(() => []));
    const allStats = await Promise.all(statsPromises);

    finished.forEach((match, idx) => {
      const homeP = match.participants?.find(p => p.meta.location === 'home');
      const awayP = match.participants?.find(p => p.meta.location === 'away');
      const isHome = homeP?.id === teamId;

      // Extract goals from scores
      let homeGoals = 0, awayGoals = 0;
      match.scores?.forEach(s => {
        if (s.description === 'CURRENT') {
          if (homeP && s.participant_id === homeP.id) homeGoals = s.score.goals;
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

      // Extract xG from statistics (type_id 321 = expected_goals)
      const matchStats = allStats[idx];
      if (matchStats && matchStats.length > 0) {
        const teamXgStat = matchStats.find(s => s.type_id === 321 && s.participant_id === teamId);
        const oppId = isHome ? awayP?.id : homeP?.id;
        const oppXgStat = matchStats.find(s => s.type_id === 321 && s.participant_id === oppId);

        if (teamXgStat || oppXgStat) {
          matchesWithXG++;
          totalXGFor += Number(teamXgStat?.data.value ?? teamGoals);
          totalXGAgainst += Number(oppXgStat?.data.value ?? oppGoals);
        } else {
          // Fallback: estimate from shots on target (86) and shots inside box (49)
          const teamSOT = matchStats.find(s => s.type_id === 86 && s.participant_id === teamId);
          const teamSIB = matchStats.find(s => s.type_id === 49 && s.participant_id === teamId);
          const oppSOT = matchStats.find(s => s.type_id === 86 && s.participant_id === oppId);
          const oppSIB = matchStats.find(s => s.type_id === 49 && s.participant_id === oppId);

          if (teamSOT || teamSIB) {
            matchesWithXG++;
            totalXGFor += (Number(teamSOT?.data.value ?? 0) * 0.10) + (Number(teamSIB?.data.value ?? 0) * 0.08);
            totalXGAgainst += (Number(oppSOT?.data.value ?? 0) * 0.10) + (Number(oppSIB?.data.value ?? 0) * 0.08);
          }
        }
      }
    });

    const estimatedXG = matchesWithXG > 0 ? {
      xgFor: totalXGFor / matchesWithXG,
      xgAgainst: totalXGAgainst / matchesWithXG,
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
      form: finished.slice(0, 5).map(match => {
        const homeP = match.participants?.find(p => p.meta.location === 'home');
        const isHome = homeP?.id === teamId;
        let homeGoals = 0, awayGoals = 0;
        match.scores?.forEach(s => {
          if (s.description === 'CURRENT') {
            if (homeP && s.participant_id === homeP.id) homeGoals = s.score.goals;
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
  } catch (err) {
    console.error(`[fetchTeamForm] Error for team ${teamId}:`, err);
    return null;
  }
}

/**
 * Fetch head-to-head record between two teams using API-Football
 */
async function fetchH2HRecord(team1Id: number, team2Id: number): Promise<H2HRecord | null> {
  try {
    const matches = await getHeadToHead(team1Id, team2Id, 20);

    if (matches.length === 0) return null;

    let team1Wins = 0, team2Wins = 0, drawCount = 0;

    for (const match of matches) {
      const homeP = match.participants?.find(p => p.meta.location === 'home');
      let homeGoals = 0, awayGoals = 0;

      match.scores?.forEach(s => {
        if (s.description === 'CURRENT') {
          if (homeP && s.participant_id === homeP.id) homeGoals = s.score.goals;
          else awayGoals = s.score.goals;
        }
      });

      const isTeam1Home = homeP?.id === team1Id;
      const t1Goals = isTeam1Home ? homeGoals : awayGoals;
      const t2Goals = isTeam1Home ? awayGoals : homeGoals;

      if (t1Goals > t2Goals) team1Wins++;
      else if (t2Goals > t1Goals) team2Wins++;
      else drawCount++;
    }

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

/**
 * Build TeamMatchHistory from TeamForm for V2 engine.
 * Uses estimated xG or goal averages as proxy.
 * NOTE: This is a simplified adapter — in production, we'd fetch per-match data.
 */
function buildTeamHistory(form: TeamForm): TeamMatchHistory[] {
  const history: TeamMatchHistory[] = [];
  const matchCount = form.matches;

  if (matchCount === 0) return history;

  const xgFor = form.estimatedXG?.xgFor ?? form.avgGoalsFor;
  const xgAgainst = form.estimatedXG?.xgAgainst ?? form.avgGoalsAgainst;

  for (let i = 0; i < matchCount; i++) {
    history.push({
      xgFor,
      xgAgainst,
      daysSince: i * 7,
      isHome: i % 2 === 0,
    });
  }

  return history;
}

/**
 * Determine if the home team is actually playing at home (not neutral venue).
 */
function isHomeTeamAtHome(fixture: NormalizedFixture): boolean {
  if (fixture.league) {
    return true;
  }
  return false;
}

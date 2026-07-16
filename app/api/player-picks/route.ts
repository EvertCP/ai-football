import { NextRequest, NextResponse } from 'next/server';
import { getFixturesByDate, getTeamSchedule, getFixturesWithLineupStats, getFixturesByLeagueAndDateRange } from '@/lib/sportmonks';
import { extractPlayerStats, calculatePlayerPicks, rankAndFilterPicks } from '@/lib/player-picks';
import { Fixture, PlayerMatchStats, PlayerPick } from '@/types/sportmonks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/player-picks?date=YYYY-MM-DD&limit=20
 * 
 * Returns top player picks for upcoming matches on the given date.
 * 
 * Flow:
 * 1. Get fixtures for the date (all states - upcoming, live, finished)
 * 2. For each team playing, get their schedule to find recent completed fixture IDs
 * 3. Fetch those fixtures with lineup details (player stats)
 * 4. For each player in the upcoming match, calculate pick percentages
 * 5. Rank and return top N picks
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const matchCount = parseInt(searchParams.get('matches') || '10', 10); // last N matches

    // Step 1: Get fixtures for the date
    const fixturesResponse = await getFixturesByDate(date);
    const fixtures = fixturesResponse.data || [];

    if (fixtures.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { date, message: 'No hay partidos para esta fecha' },
      });
    }

    // Step 2: Get unique team IDs from fixtures + track league per team
    const teamIds = new Set<number>();
    const teamInfo: Record<number, { name: string; image: string }> = {};
    const teamLeague: Record<number, number> = {}; // teamId → leagueId
    
    for (const fixture of fixtures) {
      if (fixture.participants) {
        for (const team of fixture.participants) {
          teamIds.add(team.id);
          teamInfo[team.id] = { name: team.name, image: team.image_path };
          teamLeague[team.id] = fixture.league_id;
        }
      }
    }

    // Step 3: For each team, get completed fixture IDs
    // Primary: team schedule (current competition)
    // Fallback: fixtures/between with league filter (previous tournaments)
    const FINISHED_STATES = [5, 7, 8, 9];
    const teamFixtureIds: Record<number, number[]> = {};

    const schedulePromises = Array.from(teamIds).map(async (teamId) => {
      try {
        // Try current competition schedule first
        const scheduleResponse = await getTeamSchedule(teamId);
        const rounds = scheduleResponse.data || [];
        
        const completedIds: number[] = [];
        for (const round of rounds) {
          if (round.fixtures) {
            for (const f of round.fixtures) {
              if (f.state_id && FINISHED_STATES.includes(f.state_id)) {
                completedIds.push(f.id);
              }
            }
          }
        }

        // If we have enough fixtures from current competition, use them
        if (completedIds.length >= matchCount) {
          teamFixtureIds[teamId] = completedIds.slice(-matchCount);
          return;
        }

        // Fallback: search previous fixtures by league + date range
        const leagueId = teamLeague[teamId];
        if (leagueId) {
          const endDate = date; // up to the selected date
          // Go back ~55 days at a time (API limit), try up to 2 windows
          const startD = new Date(date + 'T12:00:00');
          startD.setDate(startD.getDate() - 55); // ~55 days to stay within API limit
          const startDate = startD.toISOString().split('T')[0];

          try {
            let teamRangeIds: number[] = [];

            // First window: last ~55 days
            const rangeResponse = await getFixturesByLeagueAndDateRange(leagueId, startDate, endDate, 50);
            const rangeFixtures = rangeResponse.data || [];
            teamRangeIds = rangeFixtures
              .filter(f => 
                f.state_id && FINISHED_STATES.includes(f.state_id) &&
                f.participants?.some(p => p.id === teamId)
              )
              .map(f => f.id);

            // If still not enough, try a second window (~55 days further back)
            if (teamRangeIds.length + completedIds.length < matchCount) {
              const startD2 = new Date(startDate + 'T12:00:00');
              startD2.setDate(startD2.getDate() - 55);
              const startDate2 = startD2.toISOString().split('T')[0];
              // endDate for second window = startDate of first window
              try {
                const range2 = await getFixturesByLeagueAndDateRange(leagueId, startDate2, startDate, 50);
                const range2Fixtures = range2.data || [];
                const moreIds = range2Fixtures
                  .filter(f => 
                    f.state_id && FINISHED_STATES.includes(f.state_id) &&
                    f.participants?.some(p => p.id === teamId)
                  )
                  .map(f => f.id);
                teamRangeIds = [...teamRangeIds, ...moreIds];
              } catch { /* ignore second window failure */ }
            }

            // Combine: current schedule + previous season (deduplicate)
            const allIds = Array.from(new Set([...completedIds, ...teamRangeIds]));
            teamFixtureIds[teamId] = allIds.slice(0, matchCount);
          } catch {
            // If fallback also fails, use whatever we have
            teamFixtureIds[teamId] = completedIds.slice(-matchCount);
          }
        } else {
          teamFixtureIds[teamId] = completedIds.slice(-matchCount);
        }
      } catch (err) {
        console.warn(`[PlayerPicks] Failed to get schedule for team ${teamId}:`, err);
        teamFixtureIds[teamId] = [];
      }
    });

    await Promise.all(schedulePromises);

    // Step 4: Collect all unique fixture IDs we need to fetch
    const allFixtureIds = new Set<number>();
    for (const ids of Object.values(teamFixtureIds)) {
      for (const id of ids) {
        allFixtureIds.add(id);
      }
    }

    if (allFixtureIds.size === 0) {
      return NextResponse.json({
        data: [],
        meta: { date, message: 'No hay partidos anteriores para analizar' },
      });
    }

    // Step 5: Fetch fixtures with lineup stats (batch in groups of 20 max)
    const fixtureIdArray = Array.from(allFixtureIds);
    const batchSize = 20;
    const fixtureMap: Record<number, Fixture> = {};

    for (let i = 0; i < fixtureIdArray.length; i += batchSize) {
      const batch = fixtureIdArray.slice(i, i + batchSize);
      try {
        const response = await getFixturesWithLineupStats(batch);
        const fetchedFixtures = response.data || [];
        for (const f of fetchedFixtures) {
          fixtureMap[f.id] = f;
        }
      } catch (err) {
        console.warn(`[PlayerPicks] Failed to fetch fixture batch:`, err);
      }
    }

    // Step 6: For each upcoming fixture, analyze players
    const allPicks: PlayerPick[] = [];

    for (const fixture of fixtures) {
      if (!fixture.participants || fixture.participants.length < 2) continue;

      const homeTeam = fixture.participants.find(p => p.meta?.location === 'home');
      const awayTeam = fixture.participants.find(p => p.meta?.location === 'away');
      if (!homeTeam || !awayTeam) continue;

      // Process both teams
      for (const team of [homeTeam, awayTeam]) {
        const recentFixtureIds = teamFixtureIds[team.id] || [];
        if (recentFixtureIds.length === 0) continue;

        // Get all players who appeared in recent fixtures for this team
        const playerStatsMap: Record<number, PlayerMatchStats[]> = {};
        const playerNames: Record<number, string> = {};
        const playerImages: Record<number, string> = {};

        for (const fId of recentFixtureIds) {
          const f = fixtureMap[fId];
          if (!f || !f.lineups) continue;

          // Get players from this team in this fixture
          const teamLineups = f.lineups.filter(
            l => l.team_id === team.id && l.details && l.details.length > 0
          );

          for (const lineup of teamLineups) {
            const stats = extractPlayerStats(f, lineup.player_id);
            if (!stats) continue;

            if (!playerStatsMap[lineup.player_id]) {
              playerStatsMap[lineup.player_id] = [];
              playerNames[lineup.player_id] = lineup.player_name;
              playerImages[lineup.player_id] = lineup.player?.image_path || '';
            }
            playerStatsMap[lineup.player_id].push(stats);
          }
        }

        // Calculate picks for each player
        for (const [playerIdStr, matchStats] of Object.entries(playerStatsMap)) {
          const playerId = parseInt(playerIdStr, 10);
          const pick = calculatePlayerPicks(matchStats, {
            playerId,
            playerName: playerNames[playerId],
            playerImage: playerImages[playerId],
            teamId: team.id,
            teamName: team.name,
            teamImage: team.image_path,
            upcomingFixtureId: fixture.id,
            upcomingFixtureName: fixture.name,
            upcomingFixtureDate: fixture.starting_at,
          });

          if (pick) {
            allPicks.push(pick);
          }
        }
      }
    }

    // Step 7: Rank and return top picks
    const topPicks = rankAndFilterPicks(allPicks, limit);

    return NextResponse.json({
      data: topPicks,
      meta: {
        date,
        totalFixtures: fixtures.length,
        teamsAnalyzed: teamIds.size,
        totalPicks: allPicks.length,
        matchesAnalyzed: matchCount,
      },
    });
  } catch (error) {
    console.error('[PlayerPicks] Error:', error);
    return NextResponse.json(
      { error: 'Error al generar player picks', details: String(error) },
      { status: 500 }
    );
  }
}

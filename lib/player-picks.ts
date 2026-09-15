import {
  FixturePlayerStats,
  NormalizedFixture,
  PlayerMatchStats,
  PlayerPick,
  PickItem,
} from '@/types/football';
import apiFootball from '@/lib/api-football';

const PICK_DEFINITIONS = [
  { stat: 'GOALS', label: 'Anotar gol', thresholds: [1] },
  { stat: 'SHOTS_ON_TARGET', label: 'Tiro a puerta', thresholds: [1, 2] },
  { stat: 'YELLOWCARDS', label: 'Tarjeta amarilla', thresholds: [1] },
];

function getStatFromMatchStats(ms: PlayerMatchStats, stat: string): number {
  switch (stat) {
    case 'GOALS': return ms.goals;
    case 'SHOTS_ON_TARGET': return ms.shotsOnTarget;
    case 'YELLOWCARDS': return ms.yellowCards;
    default: return 0;
  }
}

function calculatePlayerPicks(
  matchStats: PlayerMatchStats[],
  playerInfo: {
    playerId: number;
    playerName: string;
    playerImage?: string;
    teamId: number;
    teamName: string;
    teamImage?: string;
    upcomingFixtureId: number;
    upcomingFixtureName: string;
    upcomingFixtureDate: string;
  }
): PlayerPick | null {
  if (matchStats.length < 3) return null;

  const totalMatches = matchStats.length;
  const picks: PickItem[] = [];

  for (const def of PICK_DEFINITIONS) {
    for (const threshold of def.thresholds) {
      const hitCount = matchStats.filter(ms => {
        const value = getStatFromMatchStats(ms, def.stat);
        return value >= threshold;
      }).length;

      const percentage = Math.round((hitCount / totalMatches) * 100);

      if (percentage >= 60) {
        const confidence: 'high' | 'medium' = percentage >= 80 ? 'high' : 'medium';
        const label = threshold > 1 ? `${def.label} (${threshold}+)` : def.label;
        const matchValues = matchStats.map(ms => getStatFromMatchStats(ms, def.stat));

        picks.push({
          stat: def.stat,
          label,
          threshold,
          hitCount,
          totalMatches,
          percentage,
          confidence,
          matchValues,
        });
      }
    }
  }

  if (picks.length === 0) return null;

  picks.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === 'high' ? -1 : 1;
    }
    return b.percentage - a.percentage;
  });

  const matchHistory = matchStats.map(ms => ({
    fixtureId: ms.fixtureId,
    fixtureName: ms.fixtureName,
    fixtureDate: ms.fixtureDate,
    stats: {
      GOALS: ms.goals,
      SHOTS_ON_TARGET: ms.shotsOnTarget,
      YELLOWCARDS: ms.yellowCards,
    },
  }));

  return {
    ...playerInfo,
    picks,
    matchHistory,
  };
}

function rankAndFilterPicks(allPicks: PlayerPick[], topN: number = 20): PlayerPick[] {
  const scored = allPicks.map(pp => {
    const score = pp.picks.reduce((acc, pick) => {
      const weight = pick.confidence === 'high' ? 1.5 : 1;
      return acc + (pick.percentage * weight);
    }, 0);
    return { pick: pp, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map(s => s.pick);
}

function extractPlayerMatchStats(
  fixture: NormalizedFixture,
  fixturePlayerStats: FixturePlayerStats[],
  playerIds: Set<number>
): PlayerMatchStats[] {
  const stats: PlayerMatchStats[] = [];

  for (const teamStats of fixturePlayerStats) {
    for (const p of teamStats.players) {
      if (!playerIds.has(p.player.id)) continue;
      const s = p.statistics[0];
      if (!s) continue;

      stats.push({
        fixtureId: fixture.id,
        fixtureName: fixture.name,
        fixtureDate: fixture.starting_at,
        playerId: p.player.id,
        playerName: p.player.name,
        teamId: teamStats.team.id,
        minutesPlayed: s.games.minutes ?? 0,
        goals: s.goals.total ?? 0,
        assists: s.goals.assists ?? 0,
        shotsTotal: s.shots.total ?? 0,
        shotsOnTarget: s.shots.on ?? 0,
        keyPasses: s.passes.key ?? 0,
        tackles: s.tackles.total ?? 0,
        fouls: s.fouls.committed ?? 0,
        yellowCards: s.cards.yellow ?? 0,
        rating: s.games.rating ? Number(s.games.rating) : 0,
      });
    }
  }

  return stats;
}

export async function getPlayerPicksForFixture(
  fixtureId: number,
  matchWindow: number = 5,
  topN: number = 20
): Promise<PlayerPick[]> {
  const fixture = await apiFootball.getFixtureById(fixtureId);
  if (!fixture) throw new Error('Partido no encontrado');
  if (!fixture.lineups || fixture.lineups.length === 0) {
    throw new Error('Alineaciones no disponibles para este partido');
  }

  const upcomingPlayers: { id: number; name: string; teamId: number }[] = [];
  for (const lineup of fixture.lineups) {
    for (const entry of lineup.startXI) {
      upcomingPlayers.push({
        id: entry.player.id,
        name: entry.player.name,
        teamId: lineup.team.id,
      });
    }
  }

  if (upcomingPlayers.length === 0) return [];

  const playerIds = new Set(upcomingPlayers.map(p => p.id));
  const teamNames = new Map<number, string>();
  for (const p of fixture.participants || []) {
    teamNames.set(p.id, p.name);
  }

  const matchStatsByPlayer = new Map<number, PlayerMatchStats[]>();

  for (const player of upcomingPlayers) {
    const teamId = player.teamId;
    const history = await apiFootball.getTeamFixtures(teamId, matchWindow * 2);
    const finished = history.filter(f => f.state?.short === 'FT').slice(0, matchWindow);

    for (const f of finished) {
      const playerStats = await apiFootball.getFixturePlayerStats(f.id);
      const stats = extractPlayerMatchStats(f, playerStats, playerIds);
      for (const s of stats) {
        if (!matchStatsByPlayer.has(s.playerId)) {
          matchStatsByPlayer.set(s.playerId, []);
        }
        matchStatsByPlayer.get(s.playerId)!.push(s);
      }
    }
  }

  const allPicks: PlayerPick[] = [];
  for (const player of upcomingPlayers) {
    const matchStats = matchStatsByPlayer.get(player.id) || [];
    const pick = calculatePlayerPicks(matchStats, {
      playerId: player.id,
      playerName: player.name,
      teamId: player.teamId,
      teamName: teamNames.get(player.teamId) || '',
      upcomingFixtureId: fixture.id,
      upcomingFixtureName: fixture.name,
      upcomingFixtureDate: fixture.starting_at,
    });
    if (pick) allPicks.push(pick);
  }

  return rankAndFilterPicks(allPicks, topN);
}

export async function getPlayerPicksForDate(
  date: string,
  matchWindow: number = 5,
  topN: number = 20,
  maxFixtures: number = 3
): Promise<{ picks: PlayerPick[]; fixtureId?: number }> {
  const fixtures = await apiFootball.getFixturesByDate(date);
  const upcoming = fixtures
    .filter(f => f.state?.short === 'NS')
    .sort((a, b) => (a.starting_at_timestamp || 0) - (b.starting_at_timestamp || 0))
    .slice(0, maxFixtures);

  if (upcoming.length === 0) return { picks: [] };

  const allPicks: PlayerPick[] = [];
  for (const f of upcoming) {
    try {
      const picks = await getPlayerPicksForFixture(f.id, matchWindow, topN);
      allPicks.push(...picks);
    } catch {
      // skip fixtures that fail
    }
  }

  return {
    picks: rankAndFilterPicks(allPicks, topN),
    fixtureId: upcoming[0]?.id,
  };
}

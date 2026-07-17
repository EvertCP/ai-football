import { Fixture, LineupPlayer, MatchHistoryEntry, PlayerMatchStats, PlayerPick, PickItem } from '@/types/sportmonks';

/**
 * Pick definitions: which stats to analyze and at what thresholds
 */
const PICK_DEFINITIONS = [
  { stat: 'GOALS', label: 'Anotar gol', thresholds: [1] },
  { stat: 'ASSISTS', label: 'Dar asistencia', thresholds: [1] },
  { stat: 'SHOTS_ON_TARGET', label: 'Tiro a puerta', thresholds: [1, 2] },
  { stat: 'SHOTS_TOTAL', label: 'Tiros totales', thresholds: [1, 2, 3] },
  { stat: 'KEY_PASSES', label: 'Pase clave', thresholds: [1, 2] },
  { stat: 'TACKLES', label: 'Entrada exitosa', thresholds: [1, 2] },
  { stat: 'FOULS', label: 'Falta cometida', thresholds: [1, 2] },
  { stat: 'YELLOWCARDS', label: 'Tarjeta amarilla', thresholds: [1] },
  { stat: 'FOULS_DRAWN', label: 'Falta recibida', thresholds: [1, 2] },
  { stat: 'TOTAL_CROSSES', label: 'Centros', thresholds: [1, 2] },
  { stat: 'SUCCESSFUL_DRIBBLES', label: 'Regate exitoso', thresholds: [1] },
];

/**
 * Extract a numeric stat value from a lineup player's details array
 */
function getStatValue(player: LineupPlayer, statName: string): number {
  if (!player.details || player.details.length === 0) return 0;
  const detail = player.details.find(
    d => d.type?.developer_name === statName
  );
  if (!detail) return 0;
  const val = detail.data?.value;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return 0;
}

/**
 * Extract per-match stats for a specific player from a fixture's lineups
 */
export function extractPlayerStats(
  fixture: Fixture,
  playerId: number
): PlayerMatchStats | null {
  if (!fixture.lineups) return null;

  const playerLineup = fixture.lineups.find(
    l => l.player_id === playerId && l.details && l.details.length > 0
  );
  if (!playerLineup) return null;

  const minutesPlayed = getStatValue(playerLineup, 'MINUTES_PLAYED');
  // Skip if player didn't actually play (sub who wasn't used)
  if (minutesPlayed === 0) return null;

  return {
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    fixtureDate: fixture.starting_at,
    playerId: playerLineup.player_id,
    playerName: playerLineup.player_name,
    teamId: playerLineup.team_id,
    minutesPlayed,
    goals: getStatValue(playerLineup, 'GOALS'),
    assists: getStatValue(playerLineup, 'ASSISTS'),
    shotsTotal: getStatValue(playerLineup, 'SHOTS_TOTAL'),
    shotsOnTarget: getStatValue(playerLineup, 'SHOTS_ON_TARGET'),
    keyPasses: getStatValue(playerLineup, 'KEY_PASSES'),
    tackles: getStatValue(playerLineup, 'TACKLES'),
    fouls: getStatValue(playerLineup, 'FOULS'),
    yellowCards: getStatValue(playerLineup, 'YELLOWCARDS'),
    rating: getStatValue(playerLineup, 'RATING'),
  };
}

/**
 * Calculate picks for a player based on their recent match stats
 * Returns only picks with ≥60% hit rate
 */
export function calculatePlayerPicks(
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
  if (matchStats.length < 3) return null; // Need minimum 3 matches for meaningful picks

  const totalMatches = matchStats.length;
  const picks: PickItem[] = [];

  for (const def of PICK_DEFINITIONS) {
    for (const threshold of def.thresholds) {
      // Count how many matches the player hit this threshold
      const hitCount = matchStats.filter(ms => {
        const value = getStatFromMatchStats(ms, def.stat);
        return value >= threshold;
      }).length;

      const percentage = Math.round((hitCount / totalMatches) * 100);

      // Only include picks with ≥60% hit rate
      if (percentage >= 60) {
        const confidence: 'high' | 'medium' = percentage >= 80 ? 'high' : 'medium';
        const label = threshold > 1 ? `${def.label} (${threshold}+)` : def.label;

        // Per-match values for bar chart (ordered oldest → newest)
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

  // Sort: high confidence first, then by percentage desc
  picks.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === 'high' ? -1 : 1;
    }
    return b.percentage - a.percentage;
  });

  // Build match history
  const matchHistory: MatchHistoryEntry[] = matchStats.map(ms => ({
    fixtureId: ms.fixtureId,
    fixtureName: ms.fixtureName,
    fixtureDate: ms.fixtureDate,
    stats: {
      GOALS: ms.goals,
      ASSISTS: ms.assists,
      SHOTS_TOTAL: ms.shotsTotal,
      SHOTS_ON_TARGET: ms.shotsOnTarget,
      KEY_PASSES: ms.keyPasses,
      TACKLES: ms.tackles,
      FOULS: ms.fouls,
      YELLOWCARDS: ms.yellowCards,
    },
  }));

  return {
    ...playerInfo,
    picks,
    matchHistory,
  };
}

/**
 * Map stat developer_name to the corresponding field in PlayerMatchStats
 */
function getStatFromMatchStats(ms: PlayerMatchStats, stat: string): number {
  switch (stat) {
    case 'GOALS': return ms.goals;
    case 'ASSISTS': return ms.assists;
    case 'SHOTS_TOTAL': return ms.shotsTotal;
    case 'SHOTS_ON_TARGET': return ms.shotsOnTarget;
    case 'KEY_PASSES': return ms.keyPasses;
    case 'TACKLES': return ms.tackles;
    case 'FOULS': return ms.fouls;
    case 'YELLOWCARDS': return ms.yellowCards;
    case 'FOULS_DRAWN': return ms.fouls; // approximation - TODO: add separate field
    case 'TOTAL_CROSSES': return 0; // TODO: add to PlayerMatchStats
    case 'SUCCESSFUL_DRIBBLES': return 0; // TODO: add to PlayerMatchStats
    default: return 0;
  }
}

/**
 * Rank all player picks and return top N
 */
export function rankAndFilterPicks(
  allPicks: PlayerPick[],
  topN: number = 20
): PlayerPick[] {
  // Score each player's picks: sum of (percentage * confidence_weight)
  const scored = allPicks.map(pp => {
    const score = pp.picks.reduce((acc, pick) => {
      const weight = pick.confidence === 'high' ? 1.5 : 1;
      return acc + (pick.percentage * weight);
    }, 0);
    return { pick: pp, score };
  });

  // Sort by score descending and take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map(s => s.pick);
}

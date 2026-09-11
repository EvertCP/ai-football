/**
 * API-Football v3 Client (api-sports.io)
 *
 * All communication with the API-Football service goes through this module.
 * The API key is never exposed to the frontend.
 *
 * Auth: x-apisports-key header
 * Base URL: https://v3.football.api-sports.io
 */

import type {
  ApiFootballResponse,
  Fixture,
  LeagueInfo,
  TeamInfo,
  StandingEntry,
  SquadResponse,
  NormalizedFixture,
  NormalizedTeam,
  NormalizedScore,
  NormalizedStatistic,
} from '@/types/football';

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const API_FOOTBALL_BASE_URL = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

if (!API_FOOTBALL_KEY) {
  console.warn('[API-Football] API key not found. Set API_FOOTBALL_KEY in .env.local');
}

// ─── In-memory Cache ───

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const pendingRequests = new Map<string, Promise<ApiFootballResponse<unknown>>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttlMs: number = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  // Evict old entries periodically (keep cache bounded)
  if (cache.size > 200) {
    const now = Date.now();
    cache.forEach((value, cacheKey) => {
      if (now > value.expiresAt) cache.delete(cacheKey);
    });
  }
}

// ─── Rate-limit aware sleep ───

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Generic Fetcher ───

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 7000; // 7s between retries (10 req/min ≈ 1 req per 6s)

async function apiFetch<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<ApiFootballResponse<T>> {
  const url = new URL(`${API_FOOTBALL_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const cacheKey = url.toString();

  // Check cache first
  const cached = getCached<ApiFootballResponse<T>>(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending as Promise<ApiFootballResponse<T>>;
  }

  const request = (async (): Promise<ApiFootballResponse<T>> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        console.warn(`[API-Football] Rate limited, retrying in ${RETRY_DELAY_MS / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
        await sleep(RETRY_DELAY_MS);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-apisports-key': API_FOOTBALL_KEY || '',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`API-Football error: ${response.status} ${response.statusText} - ${errorBody}`);
        if (response.status === 429) {
          lastError = error;
          continue;
        }
        throw error;
      }

      const data: ApiFootballResponse<T> = await response.json();

      // API-Football returns errors as object or array
      if (data.errors && Object.keys(data.errors).length > 0) {
        const errMsg = typeof data.errors === 'object'
          ? Object.values(data.errors).join('; ')
          : String(data.errors);

        // Detect rate limit error and retry
        if (errMsg.toLowerCase().includes('too many requests') || errMsg.toLowerCase().includes('rate limit')) {
          lastError = new Error(`API-Football API error: ${errMsg}`);
          continue;
        }

        throw new Error(`API-Football API error: ${errMsg}`);
      }

      // Success — cache and return
      setCache(cacheKey, data);
      return data;
    }

    // All retries exhausted
    throw lastError || new Error('API-Football: max retries exceeded');
  })();

  pendingRequests.set(cacheKey, request as Promise<ApiFootballResponse<unknown>>);
  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

// ─── Status Mapping ───

/** Map API-Football short status to developer-friendly names (Sportmonks-compatible) */
function mapStatus(short: string): string {
  const map: Record<string, string> = {
    'TBD': 'TBA',
    'NS': 'NS',
    '1H': 'INPLAY_1ST_HALF',
    'HT': 'HT',
    '2H': 'INPLAY_2ND_HALF',
    'ET': 'INPLAY_ET',
    'BT': 'BREAK',
    'P': 'INPLAY_PENALTIES',
    'SUSP': 'SUSPENDED',
    'INT': 'INTERRUPTED',
    'FT': 'FT',
    'AET': 'AET',
    'PEN': 'FT_PEN',
    'PST': 'POSTPONED',
    'CANC': 'CANCELLED',
    'ABD': 'ABANDONED',
    'AWD': 'AWARDED',
    'WO': 'WO',
    'LIVE': 'INPLAY_1ST_HALF',
  };
  return map[short] || short;
}

/** Map API-Football stat type string to Sportmonks-compatible type_id */
function mapStatTypeId(type: string): number {
  const map: Record<string, number> = {
    'Shots on Goal': 86,
    'Shots off Goal': 87,
    'Total Shots': 85,
    'Blocked Shots': 88,
    'Shots insidebox': 49,
    'Shots outsidebox': 50,
    'Fouls': 56,
    'Corner Kicks': 34,
    'Offsides': 37,
    'Ball Possession': 45,
    'Yellow Cards': 41,
    'Red Cards': 42,
    'Goalkeeper Saves': 57,
    'Total passes': 80,
    'Passes accurate': 81,
    'Passes %': 82,
    'expected_goals': 321,
  };
  return map[type] || 0;
}

// ─── Normalizers ───

/** Convert API-Football fixture to our internal NormalizedFixture format */
export function normalizeFixture(raw: Fixture): NormalizedFixture {
  const homeTeam = raw.teams.home;
  const awayTeam = raw.teams.away;

  const participants: NormalizedTeam[] = [
    {
      id: homeTeam.id,
      name: homeTeam.name,
      short_code: homeTeam.name.substring(0, 3).toUpperCase(),
      image_path: homeTeam.logo,
      meta: { location: 'home', winner: homeTeam.winner },
    },
    {
      id: awayTeam.id,
      name: awayTeam.name,
      short_code: awayTeam.name.substring(0, 3).toUpperCase(),
      image_path: awayTeam.logo,
      meta: { location: 'away', winner: awayTeam.winner },
    },
  ];

  const scores: NormalizedScore[] = [];

  // Current score
  if (raw.goals.home !== null) {
    scores.push({
      participant_id: homeTeam.id,
      description: 'CURRENT',
      score: { goals: raw.goals.home },
    });
  }
  if (raw.goals.away !== null) {
    scores.push({
      participant_id: awayTeam.id,
      description: 'CURRENT',
      score: { goals: raw.goals.away },
    });
  }

  // Halftime scores
  if (raw.score.halftime.home !== null) {
    scores.push({
      participant_id: homeTeam.id,
      description: 'HALFTIME',
      score: { goals: raw.score.halftime.home },
    });
    scores.push({
      participant_id: awayTeam.id,
      description: 'HALFTIME',
      score: { goals: raw.score.halftime.away ?? 0 },
    });
  }

  // Normalize statistics if present
  const statistics: NormalizedStatistic[] = [];
  if (raw.statistics) {
    for (const teamStats of raw.statistics) {
      for (const stat of teamStats.statistics) {
        const typeId = mapStatTypeId(stat.type);
        if (typeId > 0 && stat.value !== null) {
          const numVal = typeof stat.value === 'string'
            ? parseFloat(stat.value.replace('%', ''))
            : stat.value;
          statistics.push({
            type_id: typeId,
            participant_id: teamStats.team.id,
            data: { value: numVal },
          });
        }
      }
    }
  }

  return {
    id: raw.fixture.id,
    name: `${homeTeam.name} vs ${awayTeam.name}`,
    starting_at: raw.fixture.date,
    starting_at_timestamp: raw.fixture.timestamp,
    league_id: raw.league.id,
    season_id: raw.league.season,
    state: {
      short: raw.fixture.status.short,
      long: raw.fixture.status.long,
      developer_name: mapStatus(raw.fixture.status.short),
      elapsed: raw.fixture.status.elapsed,
    },
    league: {
      id: raw.league.id,
      name: raw.league.name,
      image_path: raw.league.logo,
      country: raw.league.country,
      flag: raw.league.flag,
      round: raw.league.round,
    },
    participants,
    scores,
    venue: raw.fixture.venue,
    statistics: statistics.length > 0 ? statistics : undefined,
    events: raw.events,
    lineups: raw.lineups,
    _raw: raw,
  };
}

// ─── Public API Functions ───

/**
 * Get fixtures by date
 */
export async function getFixturesByDate(date: string): Promise<NormalizedFixture[]> {
  const res = await apiFetch<Fixture[]>('/fixtures', { date });
  return (res.response || []).map(normalizeFixture);
}

/**
 * Get a single fixture by ID with full details
 */
export async function getFixtureById(id: number): Promise<NormalizedFixture | null> {
  const res = await apiFetch<Fixture[]>('/fixtures', { id });
  if (!res.response || res.response.length === 0) return null;

  const raw = res.response[0];

  // Fetch statistics, events, and lineups in parallel
  const [statsRes, eventsRes, lineupsRes] = await Promise.all([
    apiFetch<Fixture['statistics'][]>('/fixtures/statistics', { fixture: id }).catch(() => null),
    apiFetch<Fixture['events']>('/fixtures/events', { fixture: id }).catch(() => null),
    apiFetch<Fixture['lineups']>('/fixtures/lineups', { fixture: id }).catch(() => null),
  ]);

  if (statsRes?.response) {
    // statistics endpoint returns [{team, statistics}] — same as Fixture.statistics
    raw.statistics = statsRes.response as unknown as Fixture['statistics'];
  }
  if (eventsRes?.response) {
    raw.events = eventsRes.response as unknown as Fixture['events'];
  }
  if (lineupsRes?.response) {
    raw.lineups = lineupsRes.response as unknown as Fixture['lineups'];
  }

  return normalizeFixture(raw);
}

/**
 * Get head-to-head fixtures between two teams
 */
export async function getHeadToHead(
  teamId1: number,
  teamId2: number,
  last: number = 10
): Promise<NormalizedFixture[]> {
  const res = await apiFetch<Fixture[]>('/fixtures/headtohead', {
    h2h: `${teamId1}-${teamId2}`,
    last,
  });
  return (res.response || []).map(normalizeFixture);
}

/**
 * Get all available leagues
 */
export async function getLeagues(): Promise<LeagueInfo[]> {
  const res = await apiFetch<LeagueInfo[]>('/leagues');
  return res.response || [];
}

/**
 * Get a single league info
 */
export async function getLeagueById(id: number): Promise<LeagueInfo | null> {
  const res = await apiFetch<LeagueInfo[]>('/leagues', { id });
  return res.response?.[0] || null;
}

/**
 * Get fixtures for a league and season
 */
export async function getFixturesByLeague(
  leagueId: number,
  season: number,
  round?: string
): Promise<NormalizedFixture[]> {
  const params: Record<string, string | number> = { league: leagueId, season };
  if (round) params.round = round;
  const res = await apiFetch<Fixture[]>('/fixtures', params);
  return (res.response || []).map(normalizeFixture);
}

/**
 * Get standings for a league and season
 */
export async function getStandings(
  leagueId: number,
  season: number
): Promise<StandingEntry[][]> {
  const res = await apiFetch<{ league: { standings: StandingEntry[][] } }[]>('/standings', {
    league: leagueId,
    season,
  });
  if (!res.response || res.response.length === 0) return [];
  return res.response[0].league.standings || [];
}

/**
 * Get team info
 */
export async function getTeamById(id: number): Promise<TeamInfo | null> {
  const res = await apiFetch<TeamInfo[]>('/teams', { id });
  return res.response?.[0] || null;
}

/**
 * Get team squad
 */
export async function getTeamSquad(teamId: number): Promise<SquadResponse | null> {
  const res = await apiFetch<SquadResponse[]>('/players/squads', { team: teamId });
  return res.response?.[0] || null;
}

/**
 * Get last N fixtures for a team
 */
export async function getTeamFixtures(
  teamId: number,
  last: number = 10,
  season?: number
): Promise<NormalizedFixture[]> {
  const params: Record<string, string | number> = { team: teamId, last };
  if (season) params.season = season;
  const res = await apiFetch<Fixture[]>('/fixtures', params);
  return (res.response || []).map(normalizeFixture);
}

/**
 * Get next N upcoming fixtures for a team
 */
export async function getTeamNextFixtures(
  teamId: number,
  next: number = 5
): Promise<NormalizedFixture[]> {
  const res = await apiFetch<Fixture[]>('/fixtures', { team: teamId, next });
  return (res.response || []).map(normalizeFixture);
}

/**
 * Get latest finished fixtures (global)
 */
export async function getLatestFixtures(
  last: number = 25
): Promise<NormalizedFixture[]> {
  // Use today's date fixtures as "latest"
  const today = new Date().toISOString().split('T')[0];
  const res = await apiFetch<Fixture[]>('/fixtures', { date: today });
  return (res.response || []).slice(0, last).map(normalizeFixture);
}

/**
 * Get leagues by date (which leagues have matches on this date)
 */
export async function getLeaguesByDate(date: string): Promise<{
  id: number;
  name: string;
  image_path: string;
  country: string;
  flag: string | null;
  fixtures: NormalizedFixture[];
}[]> {
  const fixtures = await getFixturesByDate(date);

  // Group fixtures by league
  const leagueMap: Record<number, {
    id: number;
    name: string;
    image_path: string;
    country: string;
    flag: string | null;
    fixtures: NormalizedFixture[];
  }> = {};

  for (const f of fixtures) {
    if (f.league) {
      if (!leagueMap[f.league.id]) {
        leagueMap[f.league.id] = {
          id: f.league.id,
          name: f.league.name,
          image_path: f.league.image_path,
          country: f.league.country,
          flag: f.league.flag,
          fixtures: [],
        };
      }
      leagueMap[f.league.id].fixtures.push(f);
    }
  }

  return Object.values(leagueMap);
}

/**
 * Get current season for a league
 */
export async function getCurrentSeason(leagueId: number): Promise<number | null> {
  const league = await getLeagueById(leagueId);
  if (!league) return null;
  const current = league.seasons.find(s => s.current);
  return current?.year || null;
}

/**
 * Get fixture statistics
 */
export async function getFixtureStatistics(fixtureId: number): Promise<NormalizedStatistic[]> {
  const res = await apiFetch<{ team: { id: number }; statistics: { type: string; value: string | number | null }[] }[]>(
    '/fixtures/statistics',
    { fixture: fixtureId }
  );

  const stats: NormalizedStatistic[] = [];
  for (const teamStats of (res.response || [])) {
    for (const stat of teamStats.statistics) {
      const typeId = mapStatTypeId(stat.type);
      if (typeId > 0 && stat.value !== null) {
        const numVal = typeof stat.value === 'string'
          ? parseFloat(stat.value.replace('%', ''))
          : stat.value;
        stats.push({
          type_id: typeId,
          participant_id: teamStats.team.id,
          data: { value: numVal },
        });
      }
    }
  }

  return stats;
}

const apiFootball = {
  getFixturesByDate,
  getFixtureById,
  getHeadToHead,
  getLeagues,
  getLeagueById,
  getFixturesByLeague,
  getStandings,
  getTeamById,
  getTeamSquad,
  getTeamFixtures,
  getTeamNextFixtures,
  getLatestFixtures,
  getLeaguesByDate,
  getCurrentSeason,
  getFixtureStatistics,
  normalizeFixture,
};

export default apiFootball;

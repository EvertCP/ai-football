import { Fixture, SportmonksResponse } from '@/types/sportmonks';

/**
 * Sportmonks Football API 3.0 Client
 * 
 * This client handles all communication with the Sportmonks API.
 * The token is never exposed to the frontend - all requests go through
 * internal API routes.
 * 
 * TODO: Future enhancements:
 * - Add caching layer (Redis/in-memory) to reduce API calls
 * - Add rate limiting management
 * - Add retry logic with exponential backoff
 * - Add request queuing for batch operations
 */

const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
const SPORTMONKS_BASE_URL = process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/football';

if (!SPORTMONKS_API_TOKEN) {
  console.warn(
    '[Sportmonks] API token not found. Set SPORTMONKS_API_TOKEN in .env.local'
  );
}

interface RequestOptions {
  includes?: string[];
  filters?: Record<string, string>;
  page?: number;
  perPage?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

/**
 * Base fetch function for Sportmonks API
 * Handles authentication, includes, and error management
 */
async function sportmonksFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<SportmonksResponse<T>> {
  const { includes = [], filters = {}, page, perPage } = options;

  const url = new URL(`${SPORTMONKS_BASE_URL}${endpoint}`);

  // Auth token
  url.searchParams.set('api_token', SPORTMONKS_API_TOKEN || '');

  // Includes (related data to embed in response)
  if (includes.length > 0) {
    url.searchParams.set('include', includes.join(';'));
  }

  // Filters (Sportmonks v3 uses format: filters=key:value;key2:value2)
  const filterEntries = Object.entries(filters);
  if (filterEntries.length > 0) {
    const filterString = filterEntries.map(([key, value]) => `${key}:${value}`).join(';');
    url.searchParams.set('filters', filterString);
  }

  // Pagination
  if (page) url.searchParams.set('page', page.toString());
  if (perPage) url.searchParams.set('per_page', perPage.toString());

  // Sorting
  if (options.sortBy) url.searchParams.set('sortBy', options.sortBy);
  if (options.order) url.searchParams.set('order', options.order);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Sportmonks API error: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  return response.json();
}

/**
 * Get fixtures (matches) by date
 * Includes: participants (teams), league, state, scores, venue
 */
export async function getFixturesByDate(
  date: string
): Promise<SportmonksResponse<Fixture[]>> {
  return sportmonksFetch<Fixture[]>('/fixtures/date/' + date, {
    includes: ['participants', 'league', 'state', 'scores', 'venue'],
    // TODO: Add more includes as the platform grows:
    // - 'odds' for betting data
    // - 'statistics' for match stats
    // - 'events' for goals, cards, substitutions
    // - 'lineups' for team formations
  });
}

/**
 * Get a single fixture by ID with detailed information
 * Tries full includes first; if predictions.type fails (plan limitation),
 * retries without premium includes.
 */
export async function getFixtureById(
  id: number
): Promise<SportmonksResponse<Fixture>> {
  try {
    // Try with all includes (including predictions for premium plans)
    return await sportmonksFetch<Fixture>(`/fixtures/${id}`, {
      includes: [
        'participants',
        'league',
        'venue',
        'state',
        'scores',
        'statistics',
        'events.type',
        'events.period',
        'events.player',
        'predictions.type',
      ],
    });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // If it fails (likely due to predictions.type not being in plan),
    // retry without premium includes
    console.warn('[Sportmonks] Retrying without predictions include');
    return sportmonksFetch<Fixture>(`/fixtures/${id}`, {
      includes: [
        'participants',
        'league',
        'venue',
        'state',
        'scores',
        'statistics',
        'events.type',
        'events.period',
        'events.player',
      ],
    });
  }
}

/**
 * Get head-to-head fixtures between two teams
 * Useful for prediction model
 * 
 * TODO: Implement when adding advanced predictions
 * This will feed the ML model with historical matchup data
 */
export async function getHeadToHead(
  teamId1: number,
  teamId2: number
): Promise<SportmonksResponse<Fixture[]>> {
  return sportmonksFetch<Fixture[]>(
    `/fixtures/head-to-head/${teamId1}/${teamId2}`,
    {
      includes: ['participants', 'scores', 'statistics'],
      perPage: 10,
    }
  );
}

/**
 * Get team statistics for a season
 * 
 * TODO: Implement for advanced team analysis
 * - Win/Draw/Loss record
 * - Goals scored/conceded
 * - Home vs Away performance
 * - Form (last 5 matches)
 */
export async function getTeamSeasonStats(
  teamId: number,
  seasonId: number
): Promise<SportmonksResponse<unknown>> {
  return sportmonksFetch<unknown>(
    `/statistics/seasons/teams/${seasonId}`,
    {
      filters: { teamId: teamId.toString() },
    }
  );
}

/**
 * Get the latest available fixtures (already played)
 * Works with Free plan - uses general /fixtures endpoint
 * Sorted by starting_at descending to get most recent first
 * Filters by state_id 5 (FT = Full Time) to only show finished matches
 */
export async function getLatestFixtures(
  page: number = 1,
  perPage: number = 25
): Promise<SportmonksResponse<Fixture[]>> {
  return sportmonksFetch<Fixture[]>('/fixtures', {
    includes: ['participants', 'league', 'state', 'scores'],
    filters: {
      fixtureStates: '5',
    },
    sortBy: 'starting_at',
    order: 'desc',
    page,
    perPage,
  });
}

/**
 * Get fixtures by league ID
 * Useful when the Free plan only gives access to specific leagues
 */
export async function getFixturesByLeague(
  leagueId: number,
  page: number = 1,
  perPage: number = 25
): Promise<SportmonksResponse<Fixture[]>> {
  return sportmonksFetch<Fixture[]>(`/fixtures`, {
    includes: ['participants', 'league', 'state', 'scores'],
    filters: { fixtureLeagues: leagueId.toString() },
    sortBy: 'starting_at',
    order: 'desc',
    page,
    perPage,
  });
}

export default {
  getFixturesByDate,
  getFixtureById,
  getLatestFixtures,
  getFixturesByLeague,
  getHeadToHead,
  getTeamSeasonStats,
};

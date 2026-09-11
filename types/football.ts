// Types for API-Football v3 (api-sports.io)
// Reference: https://www.api-football.com/documentation-v3

// ─── Generic Response Wrapper ───

export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | string[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T;
}

// ─── Fixture ───

export interface Fixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string; // ISO 8601
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: FixtureStatus;
  };
  league: League;
  teams: {
    home: FixtureTeam;
    away: FixtureTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
  // Populated only when fetching single fixture with statistics/events/lineups
  events?: MatchEvent[];
  lineups?: TeamLineup[];
  statistics?: TeamStatistics[];
  players?: FixturePlayerStats[];
}

export interface FixtureStatus {
  long: string;    // "Match Finished", "Not Started", "First Half", etc.
  short: string;   // "FT", "NS", "1H", "HT", "2H", "ET", "P", "AET", "PEN", "BT", "SUSP", "INT", "PST", "CANC", "ABD", "AWD", "WO", "LIVE", "TBD"
  elapsed: number | null;
}

export interface FixtureTeam {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

// ─── League ───

export interface League {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
  round: string | null;
}

export interface LeagueInfo {
  league: {
    id: number;
    name: string;
    type: string;  // "League" | "Cup"
    logo: string;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
  seasons: LeagueSeason[];
}

export interface LeagueSeason {
  year: number;
  start: string;
  end: string;
  current: boolean;
  coverage: Record<string, unknown>;
}

// ─── Team ───

export interface TeamInfo {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    national: boolean;
    logo: string;
  };
  venue: {
    id: number | null;
    name: string;
    address: string | null;
    city: string;
    capacity: number | null;
    surface: string | null;
    image: string | null;
  } | null;
}

// ─── Standings ───

export interface StandingEntry {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  status: string;
  description: string | null;
  all: StandingRecord;
  home: StandingRecord;
  away: StandingRecord;
  update: string;
}

export interface StandingRecord {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: {
    for: number;
    against: number;
  };
}

// ─── Statistics ───

export interface TeamStatistics {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  statistics: StatisticItem[];
}

export interface StatisticItem {
  type: string;   // "Shots on Goal", "Total Shots", "Ball Possession", "expected_goals", etc.
  value: number | string | null;
}

// ─── Events ───

export interface MatchEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number | null;
    name: string | null;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string;       // "Goal", "Card", "subst", "Var"
  detail: string;     // "Normal Goal", "Penalty", "Yellow Card", "Red Card", "Substitution 1", etc.
  comments: string | null;
}

// ─── Lineups ───

export interface TeamLineup {
  team: {
    id: number;
    name: string;
    logo: string;
    colors: Record<string, unknown> | null;
  };
  coach: {
    id: number | null;
    name: string | null;
    photo: string | null;
  };
  formation: string | null;  // "4-3-3"
  startXI: LineupEntry[];
  substitutes: LineupEntry[];
}

export interface LineupEntry {
  player: {
    id: number;
    name: string;
    number: number;
    pos: string | null; // "G", "D", "M", "F"
    grid: string | null; // "1:1", "2:3"
  };
}

// ─── Player Stats per Fixture ───

export interface FixturePlayerStats {
  team: {
    id: number;
    name: string;
    logo: string;
    update: string;
  };
  players: PlayerStat[];
}

export interface PlayerStat {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  statistics: PlayerStatDetail[];
}

export interface PlayerStatDetail {
  games: {
    minutes: number | null;
    number: number;
    position: string;
    rating: string | null;
    captain: boolean;
    substitute: boolean;
  };
  offsides: number | null;
  shots: { total: number | null; on: number | null };
  goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
  passes: { total: number | null; key: number | null; accuracy: string | null };
  tackles: { total: number | null; blocks: number | null; interceptions: number | null };
  duels: { total: number | null; won: number | null };
  dribbles: { attempts: number | null; success: number | null; past: number | null };
  fouls: { drawn: number | null; committed: number | null };
  cards: { yellow: number; red: number };
  penalty: { won: number | null; commited: number | null; scored: number | null; missed: number | null; saved: number | null };
}

// ─── Squads ───

export interface SquadResponse {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  players: SquadPlayer[];
}

export interface SquadPlayer {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string; // "Goalkeeper", "Defender", "Midfielder", "Attacker"
  photo: string;
}

// ─── Head to Head ───
// Same as Fixture[] — reuses the Fixture type

// ─── App-level types (unchanged from previous, used by frontend) ───

export interface Prediction {
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  recommendation: string;
  confidence: 'low' | 'medium' | 'high';
  factors: PredictionFactor[];
  source: 'api-football' | 'heuristic';
}

export interface PredictionFactor {
  name: string;
  description: string;
  impact: 'positive_home' | 'positive_away' | 'neutral';
}

// ─── Mapped types for internal use (normalized from API-Football) ───

/** Normalized fixture for internal use — maps API-Football structure to our app shape */
export interface NormalizedFixture {
  id: number;
  name: string;
  starting_at: string;
  starting_at_timestamp: number;
  league_id: number;
  season_id: number;
  state: {
    short: string;       // "FT", "NS", "1H", etc.
    long: string;
    developer_name: string; // mapped to match Sportmonks-style status names
    elapsed: number | null;
  };
  league?: {
    id: number;
    name: string;
    image_path: string;
    country: string;
    flag: string | null;
    round: string | null;
  };
  participants?: NormalizedTeam[];
  scores?: NormalizedScore[];
  venue?: {
    id: number | null;
    name: string | null;
    city: string | null;
  };
  statistics?: NormalizedStatistic[];
  events?: MatchEvent[];
  lineups?: TeamLineup[];
  // Raw API-Football fixture data
  _raw?: Fixture;
}

export interface NormalizedTeam {
  id: number;
  name: string;
  short_code: string;
  image_path: string;
  meta: {
    location: 'home' | 'away';
    winner: boolean | null;
  };
}

export interface NormalizedScore {
  participant_id: number;
  description: string;  // "CURRENT", "HALFTIME"
  score: {
    goals: number;
  };
}

export interface NormalizedStatistic {
  type_id: number;
  participant_id: number;
  data: { value: number | string };
}

// ─── Schedule types ───

export interface ScheduleRound {
  id: number;
  name: string;
  fixtures?: NormalizedFixture[];
}

// ─── Legacy-compatible types (for components that used Sportmonks types) ───

/** Team reference used by components (matches both old and new shape) */
export interface Team {
  id: number;
  name: string;
  short_code?: string;
  image_path?: string;
  logo?: string;
  meta?: {
    location: 'home' | 'away';
    winner?: boolean | null;
  };
}

/** Fixture statistic used by StatsTable component */
export interface FixtureStatistic {
  id?: number;
  fixture_id?: number;
  type_id: number;
  participant_id: number;
  data: {
    value: number | string;
  };
}

/** Lineup player used by MatchLineups component */
export interface LineupPlayer {
  id: number;
  fixture_id?: number;
  team_id: number;
  player_id: number;
  player_name: string;
  jersey_number: number | null;
  type_id?: number;         // 11 = starter, 12 = bench
  formation_field?: string | null;
  position?: string | null;
  player?: {
    id: number;
    common_name?: string;
    display_name?: string;
    image_path?: string;
    position_id?: number;
  };
  details?: Array<{
    type_id: number;
    type?: { developer_name?: string };
    data?: { value?: number | string | boolean };
    value?: Record<string, unknown>;
  }>;
}

/** Formation data */
export interface Formation {
  id?: number;
  fixture_id?: number;
  participant_id: number;
  formation: string; // e.g. "4-3-3"
  location?: string; // "home" | "away"
}

/** Fixture metadata (coaches etc.) */
export interface FixtureMetadata {
  id?: number;
  fixture_id?: number;
  type_id: number;
  type?: { developer_name?: string };
  values?: Record<string, unknown>;
}

// ─── Player Picks types (preserved from original) ───

export interface PlayerMatchStats {
  fixtureId: number;
  fixtureName: string;
  fixtureDate: string;
  playerId: number;
  playerName: string;
  teamId: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  shotsTotal: number;
  shotsOnTarget: number;
  keyPasses: number;
  tackles: number;
  fouls: number;
  yellowCards: number;
  rating: number;
}

export interface PlayerPick {
  playerId: number;
  playerName: string;
  playerImage?: string;
  teamId: number;
  teamName: string;
  teamImage?: string;
  upcomingFixtureId: number;
  upcomingFixtureName: string;
  upcomingFixtureDate: string;
  picks: PickItem[];
  matchHistory?: MatchHistoryEntry[];
}

export interface MatchHistoryEntry {
  fixtureId: number;
  fixtureName: string;
  fixtureDate: string;
  stats: Record<string, number>;
}

export interface PickItem {
  stat: string;
  label: string;
  threshold: number;
  hitCount: number;
  totalMatches: number;
  percentage: number;
  confidence: 'high' | 'medium';
  matchValues?: number[];
}

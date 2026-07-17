// Types for Sportmonks Football API 3.0
// Reference: https://docs.sportmonks.com/football

export interface SportmonksResponse<T> {
  data: T;
  pagination?: Pagination;
  subscription?: Subscription[];
  rate_limit?: RateLimit;
}

export interface Pagination {
  count: number;
  per_page: number;
  current_page: number;
  next_page?: string;
  has_more: boolean;
}

export interface Subscription {
  meta: Record<string, unknown>;
  plans: Record<string, unknown>[];
}

export interface RateLimit {
  resets_in_seconds: number;
  remaining: number;
  requested_entity: string;
}

export interface Fixture {
  id: number;
  sport_id: number;
  league_id: number;
  season_id: number;
  stage_id: number;
  round_id: number | null;
  group_id: number | null;
  aggregate_id: number | null;
  venue_id: number | null;
  referee_id: number | null;
  local_team_id: number;
  visitor_team_id: number;
  name: string;
  starting_at: string;
  result_info: string | null;
  leg: string | null;
  details: string | null;
  length: number;
  placeholder: boolean;
  has_odds: boolean;
  starting_at_timestamp: number;
  state_id?: number; // 1=NS, 5=FT, etc.
  // Includes (populated via API includes)
  participants?: Team[];
  league?: League;
  scores?: Score[];
  statistics?: FixtureStatistic[];
  state?: FixtureState;
  venue?: Venue;
  events?: MatchEvent[];
  lineups?: LineupPlayer[];
  formations?: Formation[];
  metadata?: FixtureMetadata[];
  predictions?: SportmonksPrediction[];
  // Internal fields added by our API routes
  _leagueId?: number;
  _leagueName?: string;
  _leagueImage?: string;
  group?: { name: string };
  // TODO: Add more includes as needed:
  // - odds: for betting market data
  // - lineups: for team lineups
  // - coaches: for team coaches
  // - tvstations: for broadcast info
}

export interface Team {
  id: number;
  sport_id: number;
  country_id: number;
  name: string;
  short_code: string;
  image_path: string;
  founded: number;
  type: string;
  placeholder: boolean;
  last_played_at: string;
  meta?: {
    location: 'home' | 'away';
    winner: boolean;
    position: number;
  };
}

export interface League {
  id: number;
  sport_id: number;
  country_id: number;
  name: string;
  active: boolean;
  short_code: string;
  image_path: string;
  type: string;
  sub_type: string;
  last_played_at: string;
  category: number;
  has_jerseys: boolean;
}

export interface Score {
  id: number;
  fixture_id: number;
  type_id: number;
  participant_id: number;
  score: {
    goals: number;
    participant: string;
  };
  description: string;
}

export interface FixtureStatistic {
  id: number;
  fixture_id: number;
  type_id: number;
  participant_id: number;
  data: {
    value: number | string;
  };
  location: string;
  // TODO: Map type_id to statistic names:
  // - Ball Possession, Shots Total, Shots On Target
  // - Corners, Fouls, Offsides, Yellow Cards, Red Cards
  // - Saves, Passes Total, Passes Accurate
  // - xG (Expected Goals) when available
}

export interface FixtureState {
  id: number;
  state: string;
  name: string;
  short_name: string;
  developer_name: FixtureStatus;
}

export type FixtureStatus =
  | 'NS' // Not Started
  | 'INPLAY_1ST_HALF' // 1st Half
  | 'HT' // Half Time
  | 'INPLAY_2ND_HALF' // 2nd Half
  | 'INPLAY_ET' // Extra Time
  | 'INPLAY_ET_2ND_HALF' // Extra Time 2nd Half
  | 'EXTRA_TIME_BREAK' // Extra Time Break
  | 'INPLAY_PENALTIES' // Penalties
  | 'PEN_BREAK' // Penalties Break
  | 'FT' // Full Time
  | 'AET' // After Extra Time
  | 'FT_PEN' // After Penalties
  | 'BREAK' // Break
  | 'SUSPENDED' // Suspended
  | 'INTERRUPTED' // Interrupted
  | 'ABANDONED' // Abandoned
  | 'CANCELLED' // Cancelled
  | 'POSTPONED' // Postponed
  | 'TBA' // To Be Announced
  | 'WO' // Walkover
  | 'AWAITING_UPDATES' // Awaiting Updates
  | 'DELAYED' // Delayed
  | 'DELETED' // Deleted
  | 'PENDING' // Pending
  | 'AWARDED'; // Awarded

export interface Venue {
  id: number;
  country_id: number;
  city_id: number;
  name: string;
  address: string;
  zipcode: string | null;
  latitude: string;
  longitude: string;
  capacity: number;
  image_path: string;
  city_name: string;
  surface: string;
}

// Sportmonks Prediction (from predictions.type include)
export interface SportmonksPrediction {
  id: number;
  fixture_id: number;
  type_id: number;
  predictions: {
    yes: number;
    no: number;
  } | {
    home: number;
    away: number;
    draw?: number;
  } | string;
  type?: {
    id: number;
    name: string;
    code: string;
    developer_name: string;
  };
}

// Lineup player from fixture lineups include
export interface LineupPlayer {
  id: number;
  sport_id: number;
  fixture_id: number;
  player_id: number;
  team_id: number;
  formation_field: string | null; // e.g., "1:1", "2:3" — null for bench
  type_id: number; // 11 = starting XI, 12 = bench
  position: string; // "G", "D", "M", "A"
  detail_type_id: number | null;
  player_name: string;
  jersey_number: number;
  player?: {
    id: number;
    sport_id: number;
    country_id: number;
    nationality_id: number;
    name: string;
    common_name: string;
    display_name: string;
    firstname: string;
    lastname: string;
    image_path: string;
    position_id: number;
    detailed_position_id: number | null;
  };
  details?: LineupDetail[];
}

// Formation data from fixture formations include
export interface Formation {
  id: number;
  fixture_id: number;
  participant_id: number;
  formation: string; // e.g., "4-3-3"
  location: string; // "home" | "away"
}

// Fixture metadata (coaches, formations, etc.)
export interface FixtureMetadata {
  id: number;
  fixture_id: number;
  type_id: number;
  value_id: number | null;
  values: Record<string, unknown>;
  type?: {
    id: number;
    name: string;
    developer_name: string;
  };
}

// Match Events (from events.type include)
export interface MatchEvent {
  id: number;
  fixture_id: number;
  type_id: number;
  participant_id: number;
  player_id: number | null;
  player_name: string | null;
  related_player_id: number | null;
  related_player_name: string | null;
  result: string | null;
  info: string | null;
  addition: string | null;
  minute: number;
  extra_minute: number | null;
  injured: boolean;
  section: string;
  type?: {
    id: number;
    name: string;
    code: string;
    developer_name: string;
  };
  period?: {
    id: number;
    name: string;
    started: number | null;
    ended: number | null;
  };
}

// Prediction types (unified output for UI)
export interface Prediction {
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  recommendation: string;
  confidence: 'low' | 'medium' | 'high';
  factors: PredictionFactor[];
  source: 'sportmonks' | 'heuristic';
}

export interface PredictionFactor {
  name: string;
  description: string;
  impact: 'positive_home' | 'positive_away' | 'neutral';
}

// Player Picks / Betting Analytics types
export interface LineupDetail {
  id: number;
  player_statistic_id?: number;
  type_id: number;
  data: { value: number | string | boolean };
  type?: {
    id: number;
    name: string;
    developer_name: string;
    code?: string;
  };
}

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
  stats: Record<string, number>; // stat developer_name → value
}

export interface PickItem {
  stat: string;           // e.g., "SHOTS_ON_TARGET"
  label: string;          // e.g., "Tiro a puerta"
  threshold: number;      // e.g., 1 (≥1)
  hitCount: number;       // e.g., 8 (out of 10)
  totalMatches: number;   // e.g., 10
  percentage: number;     // e.g., 80
  confidence: 'high' | 'medium';  // ≥80 = high, 60-79 = medium
  matchValues?: number[]; // per-match values for bar chart (ordered oldest→newest)
}

export interface ScheduleRound {
  id: number;
  name: string;
  fixtures?: Fixture[];
}

// API route request/response types
export interface FixturesRequest {
  date: string; // YYYY-MM-DD format
}

export interface PredictionRequest {
  fixtureId: number;
}

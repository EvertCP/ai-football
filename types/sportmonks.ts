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
  // Includes (populated via API includes)
  participants?: Team[];
  league?: League;
  scores?: Score[];
  statistics?: FixtureStatistic[];
  state?: FixtureState;
  venue?: Venue;
  events?: MatchEvent[];
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
  | '1H' // First Half
  | 'HT' // Half Time
  | '2H' // Second Half
  | 'ET' // Extra Time
  | 'PEN' // Penalties
  | 'FT' // Full Time
  | 'AET' // After Extra Time
  | 'BREAK' // Break
  | 'SUSP' // Suspended
  | 'INT' // Interrupted
  | 'ABAN' // Abandoned
  | 'CANC' // Cancelled
  | 'PST' // Postponed
  | 'TBA' // To Be Announced
  | 'WO' // Walkover
  | 'AU' // Awaiting Updates
  | 'LIVE'; // Live

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

// API route request/response types
export interface FixturesRequest {
  date: string; // YYYY-MM-DD format
}

export interface PredictionRequest {
  fixtureId: number;
}

export interface Opportunity {
  id: number;
  title: string;
  slug: string;
  type: string;
  chain: string | null;
  status: string;

  summary: string | null;
  thesis: string | null;

  asset_symbol: string | null;
  base_symbol: string | null;
  quote_symbol: string | null;

  source: string | null;
  source_ref: string | null;

  estimated_cost: number | null;
  estimated_upside: number | null;
  estimated_roi_percent: number | null;

  confidence_score: number;
  upside_score: number;
  freshness_score: number;
  liquidity_score: number;
  accessibility_score: number;
  risk_score: number;
  difficulty_score: number;
  total_score: number;

  risk_level: string | null;
  difficulty_level: string | null;

  detected_at: string | null;
  expires_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  raw_payload?: Record<string, unknown> | null;
}

export type OpportunityFilter = {
  type?: string;
  chain?: string;
  min_score?: number;
};

export interface OpportunityListResponse {
  items: Opportunity[];
  total: number;
}

export interface WalletLeaderboardEntry {
  wallet_address: string;
  win_rate: number;
  average_roi: number;
  total_profit_usd: number;
  recent_opportunity_count: number;
}

export interface AlphaEvent {
  id: number;
  event_type: string;
  token_symbol: string | null;
  chain: string | null;
  summary: string;
  confidence_score: number;
  source: string | null;
  created_at: string | null;
}

export interface NarrativeTokenGroup {
  token_symbol: string;
  opportunities: Opportunity[];
}

export interface AlphaRankedOpportunity {
  alpha_score: number;
  rank_position: number;
  snapshot_type: string | null;
  snapshot_created_at?: string | null;
  opportunity: Opportunity;
}

export interface RadarEventDto {
  token_symbol: string;
  chain?: string | null;
  event_score?: number;
  signal_count?: number;
  avg_signal_strength?: number;
  avg_confidence_score?: number;
  recency_score?: number;
  latest_signal_at?: string;
  signal_types?: string[];
  /** Present when event is from persisted radar (MarketRadarEngine). */
  description?: string | null;
  event_type?: string | null;
  severity_score?: number | null;
  created_at?: string | null;
}

export interface SignalDto {
  id: number;
  signal_type: string;
  token_symbol: string | null;
  token_address: string | null;
  chain: string | null;
  title: string | null;
  description: string | null;
  signal_strength: number;
  confidence_score: number;
  source: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface TrendingSignalTokenDto {
  token_symbol: string | null;
  token_address: string | null;
  chain: string | null;
  signal_count: number;
  avg_confidence_score: number;
  avg_signal_strength: number;
  trend_direction: string;
  latest_signal_at: string | null;
}

export interface CandidateProject {
  id: number;
  project_name: string;
  token_symbol: string | null;
  chain: string | null;
  source: string | null;
  source_url: string | null;
  description: string | null;
  dev_activity_score: number;
  social_activity_score: number;
  confidence_score: number;
  detected_at: string | null;
  created_at: string;
  updated_at: string;
}


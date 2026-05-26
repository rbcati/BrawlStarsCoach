export type Confidence = "low" | "medium" | "high";
export type PlaystyleArchetype = "Control" | "Aggro" | "Support" | "Damage" | "Tank" | "Flex";

export type PlayerSummary = {
  tag: string;
  name: string;
  trophies?: number;
  highestTrophies?: number;
  expLevel?: number;
  brawlerCount?: number;
  lastSyncedAt?: string;
};

export type SavedBattle = {
  id?: string;
  stableBattleId?: string;
  battleTime: string;
  mode: string;
  map: string;
  battleType?: string | null;
  result: string;
  duration?: number | null;
  trophyChange?: number | null;
  playerBrawlerName: string;
  playerBrawlerId?: number | null;
  playerPowerLevel?: number | null;
  starPlayerTag?: string | null;
  targetTeamIndex?: number | null;
  teamAveragePower?: number | null;
  enemyAveragePower?: number | null;
  teamAverageTrophies?: number | null;
  enemyAverageTrophies?: number | null;
  adjustedDifficultyScore?: number | null;
  enemyCompArchetype?: string | null;
  targetPlayer?: BattleParticipant | null;
  teammates: BattleParticipant[];
  enemies: BattleParticipant[];
  note?: ManualNote | null;
};

export type BattleParticipant = {
  tag: string;
  name: string;
  brawlerName: string;
  brawlerId?: number | null;
  power?: number | null;
  trophies?: number | null;
  side: "ally" | "enemy" | "solo";
  relationship?: "target_player" | "teammate" | "opponent";
  isStarPlayer?: boolean;
};

export type ManualNote = {
  tags: string[];
  note: string;
};

export type BrawlerMetric = {
  brawlerName: string;
  battles: number;
  wins: number;
  losses: number;
  winRate: number;
  recentForm: number;
  starPlayerRate: number;
  survivalScore: number;
  modeSpread: number;
  role: string;
  archetype: PlaystyleArchetype;
  teammateDependency: string;
  counterNotes: string[];
  currentPowerLevel?: number | null;
};

export type ModeMetric = {
  key: string;
  battles: number;
  wins: number;
  winRate: number;
};

export type UpgradeRecommendation = {
  brawlerName: string;
  score: number;
  confidence: Confidence;
  currentPowerLevel?: number | null;
  sampleSize: number;
  reasons: string[];
};

export type EnemyMatchupMetric = {
  userBrawlerName: string;
  enemyBrawlerName: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  confidence: Confidence;
  averageTrophyChange: number | null;
  adjustedDifficultyScore: number;
  label: string;
  inferred: true;
};

export type TeammateBrawlerSynergyMetric = {
  userBrawlerName: string;
  teammateBrawlerName: string;
  matches: number;
  wins: number;
  winRate: number;
  confidence: Confidence;
  adjustedDifficultyScore: number;
  label: string;
  inferred: true;
};

export type TeammatePlayerSynergyMetric = {
  teammateTag: string;
  teammateName: string;
  matches: number;
  wins: number;
  winRate: number;
  confidence: Confidence;
  bestBrawlerPair?: string;
  label: string;
  inferred: true;
};

export type MapModeBrawlerMetric = {
  mode: string;
  map: string;
  brawlerName: string;
  matches: number;
  wins: number;
  winRate: number;
  confidence: Confidence;
  adjustedDifficultyScore: number;
};

export type EnemyCompArchetypeMetric = {
  archetype: string;
  matches: number;
  wins: number;
  winRate: number;
  confidence: Confidence;
  label: string;
  inferred: true;
};

export type StarPlayerRateMetric = {
  brawlerName: string;
  mode: string;
  matches: number;
  starPlayerMatches: number;
  starPlayerRate: number;
  confidence: Confidence;
};

export type BestCurrentBrawlerFit = {
  brawlerName: string;
  score: number;
  confidence: Confidence;
  reasons: string[];
};

export type MapModeWarning = {
  mode: string;
  map: string;
  brawlerName: string;
  matches: number;
  winRate: number;
  confidence: Confidence;
  warning: string;
};

export type RecentTrendSummary = {
  matches: number;
  winRate: number;
  previousWinRate: number | null;
  delta: number | null;
  label: string;
  confidence: Confidence;
};

export type LowSampleSizeWarning = {
  metric: string;
  matches: number;
  message: string;
};

export type AdvancedAnalytics = {
  bestCurrentBrawlerFit: BestCurrentBrawlerFit | null;
  worstEnemyMatchups: EnemyMatchupMetric[];
  bestTeammatePairings: TeammateBrawlerSynergyMetric[];
  teammatePlayerSynergies: TeammatePlayerSynergyMetric[];
  mapModeBrawlerPerformance: MapModeBrawlerMetric[];
  mapModeWarnings: MapModeWarning[];
  enemyCompArchetypePerformance: EnemyCompArchetypeMetric[];
  starPlayerRates: StarPlayerRateMetric[];
  recentTrendSummary: RecentTrendSummary;
  lowSampleSizeWarnings: LowSampleSizeWarning[];
  limitations: string[];
};

export type PlayerAnalysis = {
  player: PlayerSummary;
  totals: {
    battles: number;
    wins: number;
    winRate: number;
    starPlayerRate: number;
    recentForm: number;
    versatilityScore: number;
  };
  brawlers: BrawlerMetric[];
  modes: ModeMetric[];
  maps: ModeMetric[];
  recommendations: UpgradeRecommendation[];
  advanced: AdvancedAnalytics;
  battles: SavedBattle[];
};

export type SyncResponse = {
  player: PlayerSummary;
  fetchedCount: number;
  savedCount: number;
  skippedCount: number;
  analysis: PlayerAnalysis;
};

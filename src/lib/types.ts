export type Confidence = "Low" | "Medium" | "High";
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
  battleTime: string;
  mode: string;
  map: string;
  result: string;
  duration?: number | null;
  trophyChange?: number | null;
  playerBrawlerName: string;
  playerBrawlerId?: number | null;
  playerPowerLevel?: number | null;
  starPlayerTag?: string | null;
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
  side: "ally" | "enemy" | "solo";
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
  battles: SavedBattle[];
};

export type SyncResponse = {
  player: PlayerSummary;
  fetchedCount: number;
  savedCount: number;
  skippedCount: number;
  analysis: PlayerAnalysis;
};

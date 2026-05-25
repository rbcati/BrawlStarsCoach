import type {
  BrawlerMetric,
  Confidence,
  ModeMetric,
  PlayerAnalysis,
  PlayerSummary,
  PlaystyleArchetype,
  SavedBattle,
  UpgradeRecommendation,
} from "./types";

type AnalysisInput = {
  player: PlayerSummary;
  battles: SavedBattle[];
};

type BrawlerProfile = {
  role: string;
  archetype: PlaystyleArchetype;
};

const DEFAULT_BRAWLER_PROFILE: BrawlerProfile = {
  role: "Flex",
  archetype: "Flex",
};

const ROLE_BY_BRAWLER: Record<string, BrawlerProfile> = {
  SHELLY: { role: "Tank counter", archetype: "Damage" },
  COLT: { role: "Damage dealer", archetype: "Damage" },
  NITA: { role: "Controller", archetype: "Control" },
  BULL: { role: "Tank", archetype: "Tank" },
  BROCK: { role: "Marksman", archetype: "Damage" },
  "EL PRIMO": { role: "Tank", archetype: "Tank" },
  BARLEY: { role: "Thrower", archetype: "Control" },
  POCO: { role: "Support", archetype: "Support" },
  ROSA: { role: "Tank", archetype: "Tank" },
  JESSIE: { role: "Controller", archetype: "Control" },
  DYNAMIKE: { role: "Thrower", archetype: "Control" },
  TICK: { role: "Thrower", archetype: "Control" },
  "8-BIT": { role: "Damage dealer", archetype: "Damage" },
  RICO: { role: "Damage dealer", archetype: "Damage" },
  DARRYL: { role: "Assassin", archetype: "Aggro" },
  PENNY: { role: "Controller", archetype: "Control" },
  CARL: { role: "Skirmisher", archetype: "Damage" },
  JACKY: { role: "Tank", archetype: "Tank" },
  GUS: { role: "Support", archetype: "Support" },
  BO: { role: "Controller", archetype: "Control" },
  EMZ: { role: "Controller", archetype: "Control" },
  STU: { role: "Assassin", archetype: "Aggro" },
  PIPER: { role: "Marksman", archetype: "Damage" },
  PAM: { role: "Support", archetype: "Support" },
  FRANK: { role: "Tank", archetype: "Tank" },
  BIBI: { role: "Tank", archetype: "Tank" },
  BEA: { role: "Marksman", archetype: "Damage" },
  NANI: { role: "Marksman", archetype: "Damage" },
  EDGAR: { role: "Assassin", archetype: "Aggro" },
  GRIFF: { role: "Damage dealer", archetype: "Damage" },
  GROM: { role: "Thrower", archetype: "Control" },
  BONNIE: { role: "Marksman", archetype: "Damage" },
  MORTIS: { role: "Assassin", archetype: "Aggro" },
  TARA: { role: "Controller", archetype: "Control" },
  GENE: { role: "Support", archetype: "Support" },
  MAX: { role: "Support", archetype: "Support" },
  "MR. P": { role: "Controller", archetype: "Control" },
  SPROUT: { role: "Thrower", archetype: "Control" },
  BYRON: { role: "Support", archetype: "Support" },
  SQUEAK: { role: "Controller", archetype: "Control" },
  GRAY: { role: "Support", archetype: "Support" },
  SPIKE: { role: "Controller", archetype: "Control" },
  CROW: { role: "Assassin", archetype: "Aggro" },
  LEON: { role: "Assassin", archetype: "Aggro" },
  SANDY: { role: "Support", archetype: "Support" },
  AMBER: { role: "Controller", archetype: "Control" },
  MEG: { role: "Tank", archetype: "Tank" },
  CHESTER: { role: "Damage dealer", archetype: "Damage" },
  SURGE: { role: "Damage dealer", archetype: "Damage" },
  COLETTE: { role: "Tank counter", archetype: "Damage" },
  LOU: { role: "Controller", archetype: "Control" },
  BELLE: { role: "Marksman", archetype: "Damage" },
  BUZZ: { role: "Assassin", archetype: "Aggro" },
  FANG: { role: "Assassin", archetype: "Aggro" },
  EVE: { role: "Controller", archetype: "Control" },
  JANET: { role: "Marksman", archetype: "Damage" },
  OTIS: { role: "Controller", archetype: "Control" },
  SAM: { role: "Tank", archetype: "Tank" },
  BUSTER: { role: "Tank", archetype: "Tank" },
  MANDY: { role: "Marksman", archetype: "Damage" },
  MAISIE: { role: "Damage dealer", archetype: "Damage" },
  CORDELIUS: { role: "Assassin", archetype: "Aggro" },
  CHUCK: { role: "Controller", archetype: "Control" },
  CHARLIE: { role: "Controller", archetype: "Control" },
  MICO: { role: "Assassin", archetype: "Aggro" },
  KIT: { role: "Support", archetype: "Support" },
  "LARRY & LAWRIE": { role: "Thrower", archetype: "Control" },
  ANGELO: { role: "Marksman", archetype: "Damage" },
  MELODIE: { role: "Assassin", archetype: "Aggro" },
  LILY: { role: "Assassin", archetype: "Aggro" },
  BERRY: { role: "Support", archetype: "Support" },
  CLANCY: { role: "Damage dealer", archetype: "Damage" },
  MOE: { role: "Damage dealer", archetype: "Damage" },
  KENJI: { role: "Assassin", archetype: "Aggro" },
};

export function calculatePlayerAnalysis({
  player,
  battles,
}: AnalysisInput): PlayerAnalysis {
  const sortedBattles = [...battles].sort(
    (a, b) => new Date(b.battleTime).getTime() - new Date(a.battleTime).getTime(),
  );
  const brawlers = calculateBrawlerMetrics(sortedBattles, player.tag);
  const recommendations = calculateUpgradeRecommendations(brawlers);
  const wins = sortedBattles.filter(isWin).length;
  const recent = sortedBattles.slice(0, 10);
  const starPlayerWins = sortedBattles.filter(
    (battle) => battle.starPlayerTag === player.tag,
  ).length;

  return {
    player,
    totals: {
      battles: sortedBattles.length,
      wins,
      winRate: rate(wins, sortedBattles.length),
      starPlayerRate: rate(starPlayerWins, sortedBattles.length),
      recentForm: rate(recent.filter(isWin).length, recent.length),
      versatilityScore: calculateVersatility(sortedBattles),
    },
    brawlers,
    modes: calculateModePerformance(sortedBattles, (battle) => battle.mode),
    maps: calculateModePerformance(sortedBattles, (battle) => battle.map),
    recommendations,
    battles: sortedBattles,
  };
}

export function calculateBrawlerMetrics(
  battles: SavedBattle[],
  playerTag: string,
): BrawlerMetric[] {
  return Array.from(groupBy(battles, (battle) => battle.playerBrawlerName).entries())
    .map(([brawlerName, rows]) => {
      const profile = ROLE_BY_BRAWLER[brawlerName.toUpperCase()] ?? DEFAULT_BRAWLER_PROFILE;
      const wins = rows.filter(isWin).length;
      const recent = rows.slice(0, 8);
      const starPlayerCount = rows.filter(
        (battle) => battle.starPlayerTag === playerTag,
      ).length;
      const modeSpread = new Set(rows.map((battle) => battle.mode)).size;
      const enemyLosses = rows
        .filter((battle) => !isWin(battle))
        .flatMap((battle) => battle.enemies.map((enemy) => enemy.brawlerName));
      const counterNotes = topCounts(enemyLosses)
        .slice(0, 2)
        .map(([enemy, count]) => `${enemy} appeared in ${count} loss${count === 1 ? "" : "es"}.`);
      const teammateDependency =
        wins === 0
          ? "Unproven"
          : starPlayerCount / wins > 0.55
            ? "Carries wins"
            : "Balanced";

      return {
        brawlerName,
        battles: rows.length,
        wins,
        losses: rows.length - wins,
        winRate: rate(wins, rows.length),
        recentForm: rate(recent.filter(isWin).length, recent.length),
        starPlayerRate: rate(starPlayerCount, rows.length),
        survivalScore: calculateSurvivalProxy(rows),
        modeSpread,
        role: profile.role,
        archetype: profile.archetype,
        teammateDependency,
        counterNotes,
        currentPowerLevel: firstNumber(rows.map((battle) => battle.playerPowerLevel)),
      };
    })
    .sort((a, b) => b.battles - a.battles || b.winRate - a.winRate);
}

export function calculateModePerformance(
  battles: SavedBattle[],
  getKey: (battle: SavedBattle) => string,
): ModeMetric[] {
  return Array.from(groupBy(battles, getKey).entries())
    .map(([key, rows]) => {
      const wins = rows.filter(isWin).length;
      return { key, battles: rows.length, wins, winRate: rate(wins, rows.length) };
    })
    .sort((a, b) => b.battles - a.battles || b.winRate - a.winRate);
}

export function calculateUpgradeRecommendations(
  metrics: BrawlerMetric[],
): UpgradeRecommendation[] {
  return metrics
    .filter((metric) => metric.battles > 0)
    .map((metric) => {
      const samplePenalty = metric.battles < 5 ? metric.battles / 5 : 1;
      const multiModeScore = Math.min(1, metric.modeSpread / 4);
      const powerLevel = metric.currentPowerLevel ?? 11;
      const upgradeUrgency = Math.max(0, 11 - powerLevel) / 10;
      const score =
        (metric.winRate * 35 +
          multiModeScore * 18 +
          metric.recentForm * 22 +
          metric.starPlayerRate * 15 +
          upgradeUrgency * 18) *
        samplePenalty;
      const confidence: Confidence =
        metric.battles >= 12 ? "High" : metric.battles >= 5 ? "Medium" : "Low";
      const reasons = [
        `${metric.brawlerName} has a ${Math.round(metric.winRate * 100)}% win rate over ${metric.battles} saved match${metric.battles === 1 ? "" : "es"}.`,
        `${metric.modeSpread > 1 ? "It is working across multiple modes" : "Mode coverage is still narrow"}.`,
        `${metric.recentForm >= 0.55 ? "Recent results are trending up" : "Recent form needs more proof"}.`,
        powerLevel < 10
          ? `Power ${powerLevel} makes upgrades more urgent.`
          : `Power ${powerLevel} is already high, so urgency is moderated.`,
      ];

      return {
        brawlerName: metric.brawlerName,
        score,
        confidence,
        currentPowerLevel: metric.currentPowerLevel,
        sampleSize: metric.battles,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function isWin(battle: SavedBattle) {
  return ["victory", "win"].includes(battle.result.toLowerCase());
}

function calculateVersatility(battles: SavedBattle[]) {
  const brawlers = new Set(battles.map((battle) => battle.playerBrawlerName)).size;
  const modes = new Set(battles.map((battle) => battle.mode)).size;
  return Math.min(100, brawlers * 9 + modes * 5);
}

function calculateSurvivalProxy(battles: SavedBattle[]) {
  if (!battles.length) return 0;
  const scores = battles.map((battle) => {
    if (!battle.duration) return isWin(battle) ? 0.72 : 0.42;
    const durationComponent = Math.min(1, battle.duration / 180);
    return isWin(battle) ? 0.58 + durationComponent * 0.32 : 0.28 + durationComponent * 0.22;
  });
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = getKey(row) || "Unknown";
    map.set(key, [...(map.get(key) ?? []), row]);
  });
  return map;
}

function topCounts(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function firstNumber(values: unknown[]) {
  const value = values.find((item) => typeof item === "number");
  return typeof value === "number" ? value : null;
}

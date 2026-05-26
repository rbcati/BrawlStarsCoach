import type {
  AdvancedAnalytics,
  BrawlerMetric,
  Confidence,
  EnemyCompArchetypeMetric,
  EnemyMatchupMetric,
  MapModeBrawlerMetric,
  MapModeWarning,
  ModeMetric,
  PlayerAnalysis,
  PlayerSummary,
  PlaystyleArchetype,
  RecentTrendSummary,
  SavedBattle,
  StarPlayerRateMetric,
  TeammateBrawlerSynergyMetric,
  TeammatePlayerSynergyMetric,
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
    advanced: calculateAdvancedAnalytics(sortedBattles, brawlers),
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

export function calculateAdvancedAnalytics(
  battles: SavedBattle[],
  brawlers = calculateBrawlerMetrics(battles, ""),
): AdvancedAnalytics {
  const enemyMatchups = calculateEnemyMatchups(battles);
  const teammatePairings = calculateTeammateBrawlerSynergy(battles);
  const teammatePlayerSynergies = calculateTeammatePlayerSynergy(battles);
  const mapModeBrawlerPerformance = calculateMapModeBrawlerPerformance(battles);
  const starPlayerRates = calculateStarPlayerRates(battles);
  const enemyCompArchetypePerformance = calculateEnemyCompArchetypePerformance(battles);
  const mapModeWarnings = mapModeBrawlerPerformance
    .filter((metric) => metric.matches >= 3 && metric.winRate < 0.45)
    .sort((a, b) => a.winRate - b.winRate || b.matches - a.matches)
    .slice(0, 4)
    .map<MapModeWarning>((metric) => ({
      mode: metric.mode,
      map: metric.map,
      brawlerName: metric.brawlerName,
      matches: metric.matches,
      winRate: metric.winRate,
      confidence: metric.confidence,
      warning: `${metric.brawlerName} is underperforming on ${metric.map} ${metric.mode} in saved matches.`,
    }));

  return {
    bestCurrentBrawlerFit: calculateBestCurrentBrawlerFit(brawlers, battles),
    worstEnemyMatchups: enemyMatchups
      .filter((metric) => metric.matches >= 2)
      .sort((a, b) => a.winRate - b.winRate || b.matches - a.matches)
      .slice(0, 5),
    bestTeammatePairings: teammatePairings
      .filter((metric) => metric.matches >= 2)
      .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches)
      .slice(0, 5),
    teammatePlayerSynergies: teammatePlayerSynergies.slice(0, 5),
    mapModeBrawlerPerformance,
    mapModeWarnings,
    enemyCompArchetypePerformance,
    starPlayerRates,
    recentTrendSummary: calculateRecentTrendSummary(battles),
    lowSampleSizeWarnings: buildLowSampleSizeWarnings({
      enemyMatchups,
      teammatePairings,
      mapModeWarnings,
      totalMatches: battles.length,
    }),
    limitations: [
      "Battlelog history is limited by what has been synced before official matches roll off.",
      "Matchups are enemy team appearance trends, not confirmed lane matchups or exact 1v1 outcomes.",
      "Difficulty is inferred only from available brawler power and trophy differences.",
      "The official battlelog does not include kills, deaths, damage, draft order, lane assignment, or positioning.",
    ],
  };
}

export function calculateEnemyMatchups(battles: SavedBattle[]): EnemyMatchupMetric[] {
  return aggregateBattleAppearances(
    battles.flatMap((battle) =>
      battle.enemies.map((enemy) => ({
        battle,
        key: `${battle.playerBrawlerName}|${enemy.brawlerName}`,
        userBrawlerName: battle.playerBrawlerName,
        enemyBrawlerName: enemy.brawlerName,
      })),
    ),
  ).map(({ rows, userBrawlerName, enemyBrawlerName }) => {
    const wins = rows.filter(({ battle }) => isWin(battle)).length;
    const trophyChanges = rows
      .map(({ battle }) => battle.trophyChange)
      .filter((value): value is number => typeof value === "number");
    const matches = rows.length;

    return {
      userBrawlerName,
      enemyBrawlerName,
      matches,
      wins,
      losses: matches - wins,
      winRate: rate(wins, matches),
      confidence: getConfidenceLabel(matches),
      averageTrophyChange: trophyChanges.length
        ? trophyChanges.reduce((sum, value) => sum + value, 0) / trophyChanges.length
        : null,
      adjustedDifficultyScore: averageDifficulty(rows.map(({ battle }) => battle)),
      label: "Enemy team appearance matchup",
      inferred: true,
    };
  });
}

export function calculateTeammateBrawlerSynergy(
  battles: SavedBattle[],
): TeammateBrawlerSynergyMetric[] {
  return aggregateBattleAppearances(
    battles.flatMap((battle) =>
      battle.teammates.map((teammate) => ({
        battle,
        key: `${battle.playerBrawlerName}|${teammate.brawlerName}`,
        userBrawlerName: battle.playerBrawlerName,
        teammateBrawlerName: teammate.brawlerName,
      })),
    ),
  ).map(({ rows, userBrawlerName, teammateBrawlerName }) => {
    const wins = rows.filter(({ battle }) => isWin(battle)).length;
    const matches = rows.length;

    return {
      userBrawlerName,
      teammateBrawlerName,
      matches,
      wins,
      winRate: rate(wins, matches),
      confidence: getConfidenceLabel(matches),
      adjustedDifficultyScore: averageDifficulty(rows.map(({ battle }) => battle)),
      label: "Teammate brawler appearance synergy",
      inferred: true,
    };
  });
}

export function calculateTeammatePlayerSynergy(
  battles: SavedBattle[],
): TeammatePlayerSynergyMetric[] {
  return aggregateBattleAppearances(
    battles.flatMap((battle) =>
      battle.teammates.map((teammate) => ({
        battle,
        key: teammate.tag,
        teammateTag: teammate.tag,
        teammateName: teammate.name,
        pairLabel: `${battle.playerBrawlerName} + ${teammate.brawlerName}`,
      })),
    ),
  )
    .map(({ rows, teammateTag, teammateName }) => {
      const wins = rows.filter(({ battle }) => isWin(battle)).length;
      const matches = rows.length;
      const bestBrawlerPair = topCounts(rows.map((row) => row.pairLabel))[0]?.[0];

      return {
        teammateTag,
        teammateName,
        matches,
        wins,
        winRate: rate(wins, matches),
        confidence: getConfidenceLabel(matches),
        bestBrawlerPair,
        label: "Specific teammate tag synergy",
        inferred: true as const,
      };
    })
    .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches);
}

function calculateMapModeBrawlerPerformance(
  battles: SavedBattle[],
): MapModeBrawlerMetric[] {
  return Array.from(
    groupBy(
      battles,
      (battle) => `${battle.mode}|${battle.map}|${battle.playerBrawlerName}`,
    ).entries(),
  )
    .map(([key, rows]) => {
      const [mode, map, brawlerName] = key.split("|");
      const wins = rows.filter(isWin).length;

      return {
        mode,
        map,
        brawlerName,
        matches: rows.length,
        wins,
        winRate: rate(wins, rows.length),
        confidence: getConfidenceLabel(rows.length),
        adjustedDifficultyScore: averageDifficulty(rows),
      };
    })
    .sort((a, b) => b.matches - a.matches || b.winRate - a.winRate);
}

function calculateEnemyCompArchetypePerformance(
  battles: SavedBattle[],
): EnemyCompArchetypeMetric[] {
  return Array.from(
    groupBy(battles, (battle) => battle.enemyCompArchetype ?? "Unknown enemy comp").entries(),
  )
    .map(([archetype, rows]) => {
      const wins = rows.filter(isWin).length;
      return {
        archetype,
        matches: rows.length,
        wins,
        winRate: rate(wins, rows.length),
        confidence: getConfidenceLabel(rows.length),
        label: "Enemy comp archetype performance",
        inferred: true as const,
      };
    })
    .sort((a, b) => b.matches - a.matches || a.winRate - b.winRate);
}

function calculateStarPlayerRates(battles: SavedBattle[]): StarPlayerRateMetric[] {
  return Array.from(
    groupBy(battles, (battle) => `${battle.playerBrawlerName}|${battle.mode}`).entries(),
  )
    .map(([key, rows]) => {
      const [brawlerName, mode] = key.split("|");
      const starPlayerMatches = rows.filter((battle) => {
        const targetTag = battle.targetPlayer?.tag;
        return Boolean(targetTag && battle.starPlayerTag === targetTag);
      }).length;

      return {
        brawlerName,
        mode,
        matches: rows.length,
        starPlayerMatches,
        starPlayerRate: rate(starPlayerMatches, rows.length),
        confidence: getConfidenceLabel(rows.length),
      };
    })
    .sort((a, b) => b.starPlayerRate - a.starPlayerRate || b.matches - a.matches);
}

function calculateBestCurrentBrawlerFit(
  brawlers: BrawlerMetric[],
  battles: SavedBattle[],
) {
  const recentBattles = battles.slice(0, 12);
  const recentByBrawler = groupBy(recentBattles, (battle) => battle.playerBrawlerName);
  const candidate = brawlers
    .map((metric) => {
      const recentRows = recentByBrawler.get(metric.brawlerName) ?? [];
      const recentWinRate = rate(recentRows.filter(isWin).length, recentRows.length);
      const difficulty =
        averageDifficulty(battles.filter((battle) => battle.playerBrawlerName === metric.brawlerName)) /
        100;
      const score =
        metric.winRate * 44 +
        metric.recentForm * 28 +
        metric.starPlayerRate * 14 +
        Math.max(0, difficulty) * 8 +
        Math.min(1, metric.modeSpread / 4) * 6;

      return {
        brawlerName: metric.brawlerName,
        score,
        confidence: getConfidenceLabel(metric.battles),
        reasons: [
          `${Math.round(metric.winRate * 100)}% saved win rate over ${metric.battles} match${metric.battles === 1 ? "" : "es"}.`,
          recentRows.length
            ? `${Math.round(recentWinRate * 100)}% recent win rate in the latest ${recentRows.length} appearance${recentRows.length === 1 ? "" : "s"}.`
            : "No very recent appearance in the latest saved matches.",
          `Star player rate is ${Math.round(metric.starPlayerRate * 100)}% when available.`,
        ],
      };
    })
    .sort((a, b) => b.score - a.score)[0];

  return candidate ?? null;
}

function calculateRecentTrendSummary(battles: SavedBattle[]): RecentTrendSummary {
  const recent = battles.slice(0, 10);
  const previous = battles.slice(10, 20);
  const recentWinRate = rate(recent.filter(isWin).length, recent.length);
  const previousWinRate = previous.length ? rate(previous.filter(isWin).length, previous.length) : null;
  const delta = previousWinRate === null ? null : recentWinRate - previousWinRate;

  return {
    matches: recent.length,
    winRate: recentWinRate,
    previousWinRate,
    delta,
    label:
      delta === null
        ? "Need more saved matches for a trend comparison."
        : delta >= 0.12
          ? "Recent results are improving."
          : delta <= -0.12
            ? "Recent results are cooling off."
            : "Recent results are roughly stable.",
    confidence: getConfidenceLabel(recent.length),
  };
}

function buildLowSampleSizeWarnings({
  enemyMatchups,
  teammatePairings,
  mapModeWarnings,
  totalMatches,
}: {
  enemyMatchups: EnemyMatchupMetric[];
  teammatePairings: TeammateBrawlerSynergyMetric[];
  mapModeWarnings: MapModeWarning[];
  totalMatches: number;
}) {
  const warnings = [];
  if (totalMatches < 15) {
    warnings.push({
      metric: "Overall analysis",
      matches: totalMatches,
      message: "High-confidence reads need at least 15 saved matches.",
    });
  }

  const lowEnemy = enemyMatchups.filter((metric) => metric.matches < 5).length;
  if (lowEnemy) {
    warnings.push({
      metric: "Enemy appearance matchups",
      matches: lowEnemy,
      message: `${lowEnemy} enemy matchup trend${lowEnemy === 1 ? " is" : "s are"} still low sample.`,
    });
  }

  const lowPairings = teammatePairings.filter((metric) => metric.matches < 5).length;
  if (lowPairings) {
    warnings.push({
      metric: "Teammate pairings",
      matches: lowPairings,
      message: `${lowPairings} teammate pairing trend${lowPairings === 1 ? " is" : "s are"} still low sample.`,
    });
  }

  mapModeWarnings
    .filter((warning) => warning.matches < 5)
    .slice(0, 2)
    .forEach((warning) =>
      warnings.push({
        metric: `${warning.brawlerName} on ${warning.map}`,
        matches: warning.matches,
        message: "Treat this map/mode warning as directional until more matches are saved.",
      }),
    );

  return warnings.slice(0, 5);
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
      const confidence = getConfidenceLabel(metric.battles);
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

export function getConfidenceLabel(matches: number): Confidence {
  if (matches >= 15) return "high";
  if (matches >= 5) return "medium";
  return "low";
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

function aggregateBattleAppearances<
  T extends { battle: SavedBattle; key: string },
>(rows: T[]) {
  return Array.from(groupBy(rows, (row) => row.key).values()).map((groupedRows) => ({
    ...groupedRows[0],
    rows: groupedRows,
  }));
}

function averageDifficulty(battles: SavedBattle[]) {
  const values = battles
    .map((battle) => battle.adjustedDifficultyScore)
    .filter((value): value is number => typeof value === "number");
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

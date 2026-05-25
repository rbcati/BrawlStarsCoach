import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePlayerTag } from "./brawlStars";
import { toClientBattle } from "./normalize";

type BattleRow = Record<string, any>;
type ParticipantRow = Record<string, any>;

const ROLE_BY_BRAWLER: Record<string, string> = {
  SHELLY: "Tank counter",
  COLT: "Damage dealer",
  NITA: "Controller",
  BULL: "Tank",
  BROCK: "Marksman",
  ELPRIMO: "Tank",
  "EL PRIMO": "Tank",
  BARLEY: "Thrower",
  POCO: "Support",
  ROSA: "Tank",
  JESSIE: "Controller",
  DYNAMIKE: "Thrower",
  TICK: "Thrower",
  "8-BIT": "Damage dealer",
  RICO: "Damage dealer",
  DARRYL: "Assassin",
  PENNY: "Controller",
  CARL: "Skirmisher",
  JACKY: "Tank",
  GUS: "Support",
  BO: "Controller",
  EMZ: "Controller",
  STU: "Assassin",
  PIPER: "Marksman",
  PAM: "Support",
  FRANK: "Tank",
  BIBI: "Tank",
  BEA: "Marksman",
  NANI: "Marksman",
  EDGAR: "Assassin",
  GRIFF: "Damage dealer",
  GROM: "Thrower",
  BONNIE: "Marksman",
  MORTIS: "Assassin",
  TARA: "Controller",
  GENE: "Support",
  MAX: "Support",
  MRP: "Controller",
  "MR. P": "Controller",
  SPROUT: "Thrower",
  BYRON: "Support",
  SQUEAK: "Controller",
  GRAY: "Support",
  SPIKE: "Controller",
  CROW: "Assassin",
  LEON: "Assassin",
  SANDY: "Support",
  AMBER: "Controller",
  MEG: "Tank",
  CHESTER: "Damage dealer",
  SURGE: "Damage dealer",
  COLETTE: "Tank counter",
  LOU: "Controller",
  BELLE: "Marksman",
  BUZZ: "Assassin",
  FANG: "Assassin",
  EVE: "Controller",
  JANET: "Marksman",
  OTIS: "Controller",
  SAM: "Tank",
  BUSTER: "Tank",
  MANDY: "Marksman",
  MAISIE: "Damage dealer",
  CORDELIUS: "Assassin",
  CHUCK: "Controller",
  CHARLIE: "Controller",
  MICO: "Assassin",
  KIT: "Support",
  LARRYLAWRIE: "Thrower",
  "LARRY & LAWRIE": "Thrower",
  ANGELO: "Marksman",
  MELODIE: "Assassin",
  LILY: "Assassin",
  BERRY: "Support",
  CLANCY: "Damage dealer",
  MOE: "Damage dealer",
  KENJI: "Assassin",
};

export async function buildAnalysis(supabase: SupabaseClient, playerTagInput: string) {
  const playerTag = normalizePlayerTag(playerTagInput);

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("tag", playerTag)
    .maybeSingle();

  if (playerError) throw playerError;

  const { data: battles, error: battleError } = await supabase
    .from("battles")
    .select("*")
    .eq("player_tag", playerTag)
    .order("battle_time", { ascending: false })
    .limit(250);

  if (battleError) throw battleError;

  const battleRows = battles ?? [];
  const battleIds = battleRows.map((battle) => battle.id);

  const [participantResult, noteResult, snapshotResult] = await Promise.all([
    battleIds.length
      ? supabase.from("battle_players").select("*").in("battle_id", battleIds)
      : Promise.resolve({ data: [], error: null }),
    battleIds.length
      ? supabase
          .from("manual_match_notes")
          .select("battle_id,tags,note")
          .eq("player_tag", playerTag)
          .in("battle_id", battleIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("brawler_snapshots")
      .select("*")
      .eq("player_tag", playerTag)
      .order("snapshot_at", { ascending: false }),
  ]);

  if (participantResult.error) throw participantResult.error;
  if (noteResult.error) throw noteResult.error;
  if (snapshotResult.error) throw snapshotResult.error;

  const participantsByBattle = groupBy(
    (participantResult.data ?? []) as ParticipantRow[],
    "battle_id",
  );
  const notesByBattle = new Map(
    (noteResult.data ?? []).map((note: any) => [
      note.battle_id,
      { tags: note.tags ?? [], note: note.note ?? "" },
    ]),
  );
  const latestPowerByBrawler = latestPowerMap(snapshotResult.data ?? []);

  const brawlers = buildBrawlerMetrics(
    battleRows,
    participantsByBattle,
    latestPowerByBrawler,
    playerTag,
  );
  const totals = buildTotals(battleRows, playerTag);
  const recommendations = buildRecommendations(brawlers);

  await persistRecommendations(supabase, playerTag, recommendations);

  return {
    player: {
      tag: player?.tag ?? playerTag,
      name: player?.name ?? "Unknown player",
      trophies: player?.trophies ?? undefined,
      highestTrophies: player?.highest_trophies ?? undefined,
      expLevel: player?.exp_level ?? undefined,
      brawlerCount: Array.isArray(snapshotResult.data)
        ? new Set(snapshotResult.data.map((row: any) => row.brawler_id)).size
        : 0,
      lastSyncedAt: player?.last_synced_at ?? undefined,
    },
    totals,
    brawlers,
    modes: buildBucketMetrics(battleRows, (battle) => battle.mode),
    maps: buildBucketMetrics(battleRows, (battle) => battle.map),
    recommendations,
    battles: battleRows
      .slice(0, 50)
      .map((battle) =>
        toClientBattle(
          battle,
          participantsByBattle.get(battle.id) ?? [],
          notesByBattle.get(battle.id) ?? null,
        ),
      ),
  };
}

function buildTotals(battles: BattleRow[], playerTag: string) {
  const wins = battles.filter(isWin).length;
  const recent = battles.slice(0, 10);
  const starPlayerCount = battles.filter(
    (battle) => battle.star_player_tag === playerTag,
  ).length;
  const brawlerCount = new Set(battles.map((battle) => battle.player_brawler_name)).size;

  return {
    battles: battles.length,
    wins,
    winRate: rate(wins, battles.length),
    starPlayerRate: rate(starPlayerCount, battles.length),
    recentForm: rate(recent.filter(isWin).length, recent.length),
    versatilityScore: Math.min(100, brawlerCount * 9 + buildBucketMetrics(battles, (b) => b.mode).length * 5),
  };
}

function buildBrawlerMetrics(
  battles: BattleRow[],
  participantsByBattle: Map<string, ParticipantRow[]>,
  latestPowerByBrawler: Map<string, number | null>,
  playerTag: string,
) {
  const byBrawler = groupBy(battles, "player_brawler_name");

  return Array.from(byBrawler.entries())
    .map(([brawlerName, rows]) => {
      const wins = rows.filter(isWin).length;
      const recent = rows.slice(0, 8);
      const starPlayerWins = rows.filter(
        (battle) => battle.star_player_tag === playerTag,
      ).length;
      const modes = new Set(rows.map((battle) => battle.mode));
      const enemiesInLosses = rows
        .filter((battle) => !isWin(battle))
        .flatMap((battle) =>
          (participantsByBattle.get(battle.id) ?? [])
            .filter((participant) => participant.side === "enemy")
            .map((participant) => participant.brawler_name),
        );
      const counterNotes = topCounts(enemiesInLosses)
        .slice(0, 2)
        .map(([enemy, count]) => `${enemy} showed up in ${count} loss${count === 1 ? "" : "es"}.`);
      const teammateDependency =
        starPlayerWins > 0 && wins > 0
          ? starPlayerWins / wins > 0.55
            ? "Carries wins"
            : "Balanced"
          : wins > 0
            ? "Team-reliant"
            : "Unproven";

      return {
        brawlerName,
        battles: rows.length,
        wins,
        losses: rows.length - wins,
        winRate: rate(wins, rows.length),
        recentForm: rate(recent.filter(isWin).length, recent.length),
        starPlayerRate: rate(starPlayerWins, rows.length),
        survivalScore: buildSurvivalProxy(rows),
        modeSpread: modes.size,
        role: ROLE_BY_BRAWLER[brawlerName.toUpperCase().replace(/\s/g, "")] ?? ROLE_BY_BRAWLER[brawlerName.toUpperCase()] ?? "Flex",
        teammateDependency,
        counterNotes,
        currentPowerLevel:
          latestPowerByBrawler.get(brawlerName.toUpperCase()) ??
          firstNumber(rows.map((battle) => battle.player_power_level)),
      };
    })
    .sort((a, b) => b.battles - a.battles || b.winRate - a.winRate);
}

function buildBucketMetrics(battles: BattleRow[], getKey: (battle: BattleRow) => string) {
  return Array.from(groupByWithGetter(battles, getKey).entries())
    .map(([key, rows]) => {
      const wins = rows.filter(isWin).length;
      return { key, battles: rows.length, wins, winRate: rate(wins, rows.length) };
    })
    .sort((a, b) => b.battles - a.battles || b.winRate - a.winRate);
}

function buildRecommendations(metrics: ReturnType<typeof buildBrawlerMetrics>) {
  return metrics
    .filter((metric) => metric.battles >= 2)
    .map((metric) => {
      const samplePenalty = Math.min(1, metric.battles / 8);
      const roleCoverage = Math.min(1, metric.modeSpread / 4);
      const powerLevel = metric.currentPowerLevel ?? 11;
      const upgradeNeed = Math.max(0, 11 - powerLevel) / 10;
      const score =
        (metric.winRate * 38 +
          metric.recentForm * 24 +
          roleCoverage * 18 +
          metric.starPlayerRate * 8 +
          metric.survivalScore * 7 +
          upgradeNeed * 18) *
        samplePenalty;
      const confidence =
        metric.battles >= 12 ? "High" : metric.battles >= 6 ? "Medium" : "Low";
      const reasons = [
        `${metric.brawlerName} is winning ${Math.round(metric.winRate * 100)}% across ${metric.battles} saved matches.`,
        `${metric.recentForm >= 0.55 ? "Recent form is positive" : "Recent form is still developing"}.`,
        powerLevel < 11
          ? `Power ${powerLevel} leaves upgrade room.`
          : "Already near max power, so upgrade urgency is lower.",
      ];

      if (metric.modeSpread >= 3) {
        reasons.push("Good mode coverage improves the recommendation.");
      }

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

async function persistRecommendations(
  supabase: SupabaseClient,
  playerTag: string,
  recommendations: ReturnType<typeof buildRecommendations>,
) {
  await supabase.from("recommendations").delete().eq("player_tag", playerTag);

  if (!recommendations.length) return;

  const { error } = await supabase.from("recommendations").insert(
    recommendations.map((item, index) => ({
      player_tag: playerTag,
      brawler_name: item.brawlerName,
      score: item.score,
      confidence: item.confidence,
      explanation: item.reasons.join(" "),
      rank: index + 1,
    })),
  );

  if (error) throw error;
}

function isWin(battle: BattleRow) {
  return ["victory", "win"].includes(String(battle.result).toLowerCase());
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function buildSurvivalProxy(rows: BattleRow[]) {
  if (!rows.length) return 0;
  const durationScores = rows.map((battle) => {
    if (!battle.duration) return isWin(battle) ? 0.72 : 0.42;
    const durationComponent = Math.min(1, Number(battle.duration) / 180);
    return isWin(battle) ? 0.58 + durationComponent * 0.32 : 0.28 + durationComponent * 0.22;
  });
  return durationScores.reduce((sum, value) => sum + value, 0) / durationScores.length;
}

function latestPowerMap(rows: any[]) {
  const map = new Map<string, number | null>();
  rows.forEach((row) => {
    const key = String(row.name).toUpperCase();
    if (!map.has(key)) map.set(key, row.power_level ?? null);
  });
  return map;
}

function groupBy<T extends Record<string, any>>(rows: T[], key: string) {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const value = String(row[key] ?? "Unknown");
    map.set(value, [...(map.get(value) ?? []), row]);
  });
  return map;
}

function groupByWithGetter<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const value = getKey(row) || "Unknown";
    map.set(value, [...(map.get(value) ?? []), row]);
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

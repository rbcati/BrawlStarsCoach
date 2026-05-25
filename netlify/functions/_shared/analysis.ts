import type { SupabaseClient } from "@supabase/supabase-js";
import { calculatePlayerAnalysis } from "../../../src/lib/analysis";
import type { PlayerAnalysis, UpgradeRecommendation } from "../../../src/lib/types";
import { normalizePlayerTag } from "./brawlStars";
import { toClientBattle } from "./normalize";

type BattleRow = Record<string, any>;
type ParticipantRow = Record<string, any>;

export async function buildAnalysis(
  supabase: SupabaseClient,
  playerTagInput: string,
): Promise<PlayerAnalysis> {
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

  const battleRows = (battles ?? []) as BattleRow[];
  const battleIds = battleRows.map((battle) => battle.id);

  const [participantResult, noteResult, snapshotResult] = await Promise.all([
    battleIds.length
      ? supabase.from("battle_participants").select("*").in("battle_id", battleIds)
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

  const clientBattles = battleRows.map((battle) =>
    toClientBattle(
      battle,
      participantsByBattle.get(battle.id) ?? [],
      notesByBattle.get(battle.id) ?? null,
    ),
  );

  const analysis = calculatePlayerAnalysis({
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
    battles: clientBattles,
  });

  await persistRecommendations(supabase, playerTag, analysis.recommendations);

  return analysis;
}

async function persistRecommendations(
  supabase: SupabaseClient,
  playerTag: string,
  recommendations: UpgradeRecommendation[],
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

function groupBy<T extends Record<string, any>>(rows: T[], key: string) {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const value = String(row[key] ?? "Unknown");
    map.set(value, [...(map.get(value) ?? []), row]);
  });
  return map;
}

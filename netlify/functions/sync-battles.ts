import type { Config, Context } from "@netlify/functions";
import { buildAnalysis } from "./_shared/analysis";
import {
  getOfficialBattleLog,
  getOfficialPlayer,
  normalizePlayerTag,
} from "./_shared/brawlStars";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import {
  normalizeBattle,
  toBrawlerSnapshots,
  toPlayerSummary,
} from "./_shared/normalize";
import { getServiceSupabase } from "./_shared/supabase";

type SyncBody = {
  tag?: string;
  playerTag?: string;
};

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return methodNotAllowed(req.method);

  try {
    const body = await readJson<SyncBody>(req);
    const playerTag = normalizePlayerTag(body.tag ?? body.playerTag ?? "");
    const supabase = getServiceSupabase();
    const [player, battleLog] = await Promise.all([
      getOfficialPlayer(playerTag),
      getOfficialBattleLog(playerTag),
    ]);

    const normalized = battleLog.items
      .map((item) => normalizeBattle(item, playerTag))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const dedupeKeys = normalized.map((battle) => battle.dedupe_key);
    const existingKeys = new Set<string>();

    if (dedupeKeys.length) {
      const { data: existing, error } = await supabase
        .from("battles")
        .select("dedupe_key")
        .in("dedupe_key", dedupeKeys);

      if (error) throw error;
      existing?.forEach((row) => existingKeys.add(row.dedupe_key));
    }

    const { error: playerError } = await supabase
      .from("players")
      .upsert(toPlayerSummary(player), { onConflict: "tag" });

    if (playerError) throw playerError;

    const snapshots = toBrawlerSnapshots(player);
    if (snapshots.length) {
      const { error: snapshotError } = await supabase
        .from("brawler_snapshots")
        .upsert(snapshots, { onConflict: "player_tag,brawler_id" });

      if (snapshotError) throw snapshotError;
    }

    const battleRows = normalized.map((battle) => ({
      player_tag: playerTag,
      stable_battle_id: battle.stable_battle_id,
      battle_time: battle.battle_time,
      mode: battle.mode,
      map: battle.map,
      battle_type: battle.battle_type,
      result: battle.result,
      duration: battle.duration,
      trophy_change: battle.trophy_change,
      star_player_tag: battle.star_player_tag,
      player_brawler_id: battle.player_brawler_id,
      player_brawler_name: battle.player_brawler_name,
      player_power_level: battle.player_power_level,
      target_team_index: battle.target_team_index,
      team_average_power: battle.team_average_power,
      enemy_average_power: battle.enemy_average_power,
      team_average_trophies: battle.team_average_trophies,
      enemy_average_trophies: battle.enemy_average_trophies,
      adjusted_difficulty_score: battle.adjusted_difficulty_score,
      enemy_comp_archetype: battle.enemy_comp_archetype,
      teams_hash: battle.teams_hash,
      dedupe_key: battle.dedupe_key,
      raw: battle.raw,
    }));

    let savedCount = 0;

    if (battleRows.length) {
      const { data: savedBattles, error: battleError } = await supabase
        .from("battles")
        .upsert(battleRows, { onConflict: "dedupe_key" })
        .select("id,dedupe_key");

      if (battleError) throw battleError;

      const battleIdByKey = new Map(
        (savedBattles ?? []).map((row) => [row.dedupe_key, row.id]),
      );
      const participantRows = normalized.flatMap((battle) => {
        const battleId = battleIdByKey.get(battle.dedupe_key);
        if (!battleId) return [];
        return battle.participants.map((participant) => ({
          battle_id: battleId,
          ...participant,
        }));
      });

      if (savedBattles?.length) {
        const ids = savedBattles.map((battle) => battle.id);
        const { error: deleteError } = await supabase
          .from("battle_participants")
          .delete()
          .in("battle_id", ids);
        if (deleteError) throw deleteError;
      }

      if (participantRows.length) {
        const { error: participantError } = await supabase
          .from("battle_participants")
          .insert(participantRows);
        if (participantError) throw participantError;
      }

      savedCount = dedupeKeys.filter((key) => !existingKeys.has(key)).length;
    }

    const analysis = await buildAnalysis(supabase, playerTag);

    return json({
      player: analysis.player,
      fetchedCount: battleLog.items.length,
      savedCount,
      skippedCount: Math.max(0, normalized.length - savedCount),
      analysis,
    });
  } catch (error) {
    return handleError(error);
  }
};

export const config: Config = {
  path: "/api/sync-battles",
  method: ["POST"],
};

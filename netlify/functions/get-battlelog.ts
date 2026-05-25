import type { Config, Context } from "@netlify/functions";
import type { BrawlBattleLogItem } from "./_shared/brawlStars";
import { getOfficialBattleLog, normalizePlayerTag } from "./_shared/brawlStars";
import { handleError, json, methodNotAllowed } from "./_shared/http";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") return methodNotAllowed(req.method);

  try {
    const url = new URL(req.url);
    const tag = normalizePlayerTag(url.searchParams.get("tag") ?? "");
    const battleLog = await getOfficialBattleLog(tag);
    return json({
      items: battleLog.items.map((item) => sanitizeBattle(item)),
    });
  } catch (error) {
    return handleError(error);
  }
};

function sanitizeBattle(item: BrawlBattleLogItem) {
  return {
    battleTime: item.battleTime,
    event: {
      mode: item.event?.mode ?? item.battle.mode ?? "unknown",
      map: item.event?.map ?? "unknown map",
    },
    battle: {
      mode: item.battle.mode ?? item.event?.mode ?? "unknown",
      type: item.battle.type ?? null,
      result: item.battle.result ?? "unknown",
      duration: item.battle.duration ?? null,
      trophyChange: item.battle.trophyChange ?? null,
      starPlayer: item.battle.starPlayer
        ? sanitizeParticipant(item.battle.starPlayer)
        : null,
      teams: item.battle.teams?.map((team) => team.map(sanitizeParticipant)) ?? null,
      players: item.battle.players?.map(sanitizeParticipant) ?? null,
    },
  };
}

function sanitizeParticipant(player: NonNullable<BrawlBattleLogItem["battle"]["starPlayer"]>) {
  return {
    tag: normalizePlayerTag(player.tag),
    name: player.name,
    brawler: {
      id: player.brawler.id ?? null,
      name: player.brawler.name,
      power: player.brawler.power ?? null,
      trophies: player.brawler.trophies ?? null,
    },
  };
}

export const config: Config = {
  path: "/api/get-battlelog",
  method: ["GET"],
};

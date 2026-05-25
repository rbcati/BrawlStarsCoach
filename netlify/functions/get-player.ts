import type { Config, Context } from "@netlify/functions";
import type { BrawlPlayer } from "./_shared/brawlStars";
import { getOfficialPlayer, normalizePlayerTag } from "./_shared/brawlStars";
import { handleError, json, methodNotAllowed } from "./_shared/http";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") return methodNotAllowed(req.method);

  try {
    const url = new URL(req.url);
    const tag = normalizePlayerTag(url.searchParams.get("tag") ?? "");
    const player = await getOfficialPlayer(tag);
    return json(sanitizePlayer(player));
  } catch (error) {
    return handleError(error);
  }
};

function sanitizePlayer(player: BrawlPlayer) {
  return {
    tag: normalizePlayerTag(player.tag),
    name: player.name,
    trophies: player.trophies ?? null,
    highestTrophies: player.highestTrophies ?? null,
    expLevel: player.expLevel ?? null,
    brawlers: (player.brawlers ?? []).map((brawler) => ({
      id: brawler.id,
      name: brawler.name,
      power: brawler.power ?? null,
      trophies: brawler.trophies ?? null,
      highestTrophies: brawler.highestTrophies ?? null,
    })),
  };
}

export const config: Config = {
  path: "/api/get-player",
  method: ["GET"],
};

import type { Config, Context } from "@netlify/functions";
import { getOfficialPlayer, normalizePlayerTag } from "./_shared/brawlStars";
import { handleError, json, methodNotAllowed } from "./_shared/http";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") return methodNotAllowed(req.method);

  try {
    const url = new URL(req.url);
    const tag = normalizePlayerTag(url.searchParams.get("tag") ?? "");
    const player = await getOfficialPlayer(tag);
    return json(player);
  } catch (error) {
    return handleError(error);
  }
};

export const config: Config = {
  path: "/api/getPlayer",
  method: ["GET"],
};

import type { Config, Context } from "@netlify/functions";
import { getOfficialBattleLog, normalizePlayerTag } from "./_shared/brawlStars";
import { handleError, json, methodNotAllowed } from "./_shared/http";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") return methodNotAllowed(req.method);

  try {
    const url = new URL(req.url);
    const tag = normalizePlayerTag(url.searchParams.get("tag") ?? "");
    const battleLog = await getOfficialBattleLog(tag);
    return json(battleLog);
  } catch (error) {
    return handleError(error);
  }
};

export const config: Config = {
  path: "/api/getBattleLog",
  method: ["GET"],
};

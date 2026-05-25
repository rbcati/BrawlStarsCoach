import type { Config, Context } from "@netlify/functions";
import { buildAnalysis } from "./_shared/analysis";
import { normalizePlayerTag } from "./_shared/brawlStars";
import { handleError, json, methodNotAllowed } from "./_shared/http";
import { getServiceSupabase } from "./_shared/supabase";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") return methodNotAllowed(req.method);

  try {
    const url = new URL(req.url);
    const tag = normalizePlayerTag(url.searchParams.get("tag") ?? "");
    const supabase = getServiceSupabase();
    const analysis = await buildAnalysis(supabase, tag);
    return json(analysis);
  } catch (error) {
    return handleError(error);
  }
};

export const config: Config = {
  path: "/api/analyze-player",
  method: ["GET"],
};

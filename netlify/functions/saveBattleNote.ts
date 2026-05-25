import type { Config, Context } from "@netlify/functions";
import { normalizePlayerTag } from "./_shared/brawlStars";
import { handleError, json, methodNotAllowed, readJson } from "./_shared/http";
import { getServiceSupabase } from "./_shared/supabase";

type SaveNoteBody = {
  battleId?: string;
  playerTag?: string;
  tags?: string[];
  note?: string;
};

const ALLOWED_TAGS = new Set([
  "bad draft",
  "carried",
  "countered",
  "felt controlled",
  "tilted",
  "teammates weak",
]);

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return methodNotAllowed(req.method);

  try {
    const body = await readJson<SaveNoteBody>(req);
    if (!body.battleId) {
      return json({ error: "battleId is required." }, { status: 400 });
    }

    const playerTag = normalizePlayerTag(body.playerTag ?? "");
    const tags = (body.tags ?? []).filter((tag) => ALLOWED_TAGS.has(tag));
    const note = (body.note ?? "").trim().slice(0, 1200);
    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from("manual_match_notes")
      .upsert(
        {
          battle_id: body.battleId,
          player_tag: playerTag,
          tags,
          note,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "battle_id,player_tag" },
      )
      .select("tags,note")
      .single();

    if (error) throw error;

    return json({ note: data });
  } catch (error) {
    return handleError(error);
  }
};

export const config: Config = {
  path: "/api/saveBattleNote",
  method: ["POST"],
};

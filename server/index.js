import crypto from "node:crypto";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const BRAWL_API_BASE = "https://api.brawlstars.com/v1";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin(origin, callback) {
      const allowed = parseCorsOrigins(process.env.CORS_ORIGIN);
      if (!origin || allowed.length === 0 || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError("Origin is not allowed by CORS.", 403, "cors_forbidden"));
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/player/:tag", async (req, res, next) => {
  try {
    const player = await getOfficialPlayer(req.params.tag);
    res.json(sanitizePlayer(player));
  } catch (error) {
    next(error);
  }
});

app.get("/api/battlelog/:tag", async (req, res, next) => {
  try {
    const battlelog = await getOfficialBattleLog(req.params.tag);
    res.json({
      items: battlelog.items.map(sanitizeBattle),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sync/:tag", async (req, res, next) => {
  try {
    const playerTag = normalizePlayerTag(req.params.tag);
    const supabase = getSupabaseAdmin();
    const [player, battlelog] = await Promise.all([
      getOfficialPlayer(playerTag),
      getOfficialBattleLog(playerTag),
    ]);

    const normalized = battlelog.items
      .map((item) => normalizeBattle(item, playerTag))
      .filter(Boolean);
    const dedupeKeys = normalized.map((battle) => battle.dedupe_key);
    const existingKeys = new Set();

    if (dedupeKeys.length) {
      const { data, error } = await supabase
        .from("battles")
        .select("dedupe_key")
        .in("dedupe_key", dedupeKeys);

      if (error) throw databaseError(error);
      data?.forEach((row) => existingKeys.add(row.dedupe_key));
    }

    const { error: playerError } = await supabase
      .from("players")
      .upsert(toPlayerRow(player), { onConflict: "tag" });

    if (playerError) throw databaseError(playerError);

    const snapshots = toBrawlerSnapshots(player);
    if (snapshots.length) {
      const { error } = await supabase
        .from("brawler_snapshots")
        .upsert(snapshots, { onConflict: "player_tag,brawler_id" });

      if (error) throw databaseError(error);
    }

    const battleRows = normalized.map(({ participants, ...battle }) => battle);
    let savedCount = 0;

    if (battleRows.length) {
      const { data: savedBattles, error: battleError } = await supabase
        .from("battles")
        .upsert(battleRows, { onConflict: "dedupe_key" })
        .select("id,dedupe_key");

      if (battleError) throw databaseError(battleError);

      const battleIdByKey = new Map(
        (savedBattles ?? []).map((battle) => [battle.dedupe_key, battle.id]),
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
        const { error } = await supabase
          .from("battle_participants")
          .delete()
          .in("battle_id", ids);

        if (error) throw databaseError(error);
      }

      if (participantRows.length) {
        const { error } = await supabase
          .from("battle_participants")
          .insert(participantRows);

        if (error) throw databaseError(error);
      }

      savedCount = dedupeKeys.filter((key) => !existingKeys.has(key)).length;
    }

    const analysis = await buildAnalysis(supabase, playerTag);

    res.json({
      player: analysis.player,
      fetchedCount: battlelog.items.length,
      savedCount,
      skippedCount: Math.max(0, normalized.length - savedCount),
      analysis,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/analyze/:tag", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const analysis = await buildAnalysis(supabase, req.params.tag);
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

app.use((req, _res, next) => {
  next(new ApiError(`Route not found: ${req.method} ${req.path}`, 404, "not_found"));
});

app.use((error, _req, res, _next) => {
  const normalized = normalizeError(error);
  if (normalized.status >= 500) {
    console.error(normalized.logMessage ?? normalized.message);
  }

  res.status(normalized.status).json({
    error: normalized.message,
    code: normalized.code,
  });
});

app.listen(PORT, () => {
  console.log(`Brawl Stars Coach API listening on port ${PORT}`);
});

class ApiError extends Error {
  constructor(message, status = 500, code = "server_error", logMessage = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.logMessage = logMessage;
  }
}

function normalizeError(error) {
  if (error instanceof ApiError) return error;
  return new ApiError(
    "Unexpected server error.",
    500,
    "unexpected_server_error",
    error?.stack ?? String(error),
  );
}

function parseCorsOrigins(value) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(
      `Missing required server environment variable: ${name}.`,
      500,
      "missing_env",
    );
  }
  return value;
}

function getSupabaseAdmin() {
  const url = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizePlayerTag(input) {
  const tag = String(input ?? "").trim().toUpperCase();
  if (!tag) {
    throw new ApiError("Player tag is required.", 400, "invalid_tag");
  }

  const withHash = tag.startsWith("#") ? tag : `#${tag}`;
  if (!/^#[0289PYLQGRJCUV]{2,14}$/.test(withHash)) {
    throw new ApiError(
      "Player tag looks invalid. Use the official tag format, for example #GQ0GRPCVQ.",
      400,
      "invalid_tag",
    );
  }

  return withHash;
}

function encodeTagForPath(tag) {
  return encodeURIComponent(normalizePlayerTag(tag));
}

async function fetchBrawlApi(path) {
  const token = getRequiredEnv("BRAWL_STARS_API_TOKEN");
  const response = await fetch(`${BRAWL_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (response.ok) return response.json();

  const detail = await readUpstreamMessage(response);
  if (response.status === 403) {
    throw new ApiError(
      "Brawl Stars API access was denied. Check the API token and IP allowlist.",
      502,
      "brawl_api_forbidden",
      detail,
    );
  }
  if (response.status === 404) {
    throw new ApiError("No Brawl Stars player was found for that tag.", 404, "player_not_found");
  }
  if (response.status === 429) {
    throw new ApiError(
      "Brawl Stars API rate limit reached. Try again shortly.",
      429,
      "brawl_api_rate_limited",
    );
  }
  if (response.status >= 500) {
    throw new ApiError(
      "Brawl Stars API is temporarily unavailable.",
      502,
      "brawl_api_unavailable",
      detail,
    );
  }

  throw new ApiError(
    `Brawl Stars API request failed with status ${response.status}.`,
    502,
    "brawl_api_failure",
    detail,
  );
}

async function readUpstreamMessage(response) {
  try {
    const payload = await response.json();
    return payload?.message ?? JSON.stringify(payload);
  } catch {
    return `HTTP ${response.status}`;
  }
}

function getOfficialPlayer(tag) {
  return fetchBrawlApi(`/players/${encodeTagForPath(tag)}`);
}

function getOfficialBattleLog(tag) {
  return fetchBrawlApi(`/players/${encodeTagForPath(tag)}/battlelog`);
}

function sanitizePlayer(player) {
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

function sanitizeBattle(item) {
  return {
    battleTime: item.battleTime,
    event: {
      mode: item.event?.mode ?? item.battle?.mode ?? "unknown",
      map: item.event?.map ?? "unknown map",
    },
    battle: {
      mode: item.battle?.mode ?? item.event?.mode ?? "unknown",
      type: item.battle?.type ?? null,
      result: item.battle?.result ?? "unknown",
      duration: item.battle?.duration ?? null,
      trophyChange: item.battle?.trophyChange ?? null,
      starPlayer: item.battle?.starPlayer
        ? sanitizeParticipant(item.battle.starPlayer)
        : null,
      teams: item.battle?.teams?.map((team) => team.map(sanitizeParticipant)) ?? null,
      players: item.battle?.players?.map(sanitizeParticipant) ?? null,
    },
  };
}

function sanitizeParticipant(player) {
  return {
    tag: normalizePlayerTag(player.tag),
    name: player.name,
    brawler: {
      id: player.brawler?.id ?? null,
      name: player.brawler?.name ?? "Unknown",
      power: player.brawler?.power ?? null,
      trophies: player.brawler?.trophies ?? null,
    },
  };
}

function toPlayerRow(player) {
  return {
    tag: normalizePlayerTag(player.tag),
    name: player.name,
    trophies: player.trophies ?? null,
    highest_trophies: player.highestTrophies ?? null,
    exp_level: player.expLevel ?? null,
    raw: player,
    last_synced_at: new Date().toISOString(),
  };
}

function toBrawlerSnapshots(player) {
  const playerTag = normalizePlayerTag(player.tag);
  return (player.brawlers ?? []).map((brawler) => ({
    player_tag: playerTag,
    brawler_id: brawler.id,
    name: brawler.name,
    power_level: brawler.power ?? null,
    trophies: brawler.trophies ?? null,
    highest_trophies: brawler.highestTrophies ?? null,
    raw: brawler,
    snapshot_at: new Date().toISOString(),
  }));
}

function normalizeBattle(item, playerTagInput) {
  const playerTag = normalizePlayerTag(playerTagInput);
  const teams = item.battle?.teams ?? [];
  const players = item.battle?.players ?? [];
  const allPlayers = teams.flat().concat(players);
  const self = allPlayers.find((player) => normalizePlayerTag(player.tag) === playerTag);

  if (!self) return null;

  const mode = item.event?.mode ?? item.battle?.mode ?? "unknown";
  const map = item.event?.map ?? "unknown map";
  const battleTime = parseBattleTime(item.battleTime);
  const teamsHash = hashTeams(teams.length > 0 ? teams : [players]);
  const dedupeKey = [
    playerTag,
    battleTime,
    mode.toLowerCase(),
    map.toLowerCase(),
    teamsHash,
  ].join("|");

  return {
    player_tag: playerTag,
    battle_time: battleTime,
    mode,
    map,
    result: item.battle?.result ?? "unknown",
    duration: item.battle?.duration ?? null,
    trophy_change: item.battle?.trophyChange ?? null,
    star_player_tag: item.battle?.starPlayer?.tag
      ? normalizePlayerTag(item.battle.starPlayer.tag)
      : null,
    player_brawler_id: self.brawler?.id ?? null,
    player_brawler_name: self.brawler?.name ?? "Unknown",
    player_power_level: self.brawler?.power ?? null,
    teams_hash: teamsHash,
    dedupe_key: dedupeKey,
    raw: item,
    participants: normalizeParticipants(item, playerTag),
  };
}

function normalizeParticipants(item, playerTag) {
  const starPlayerTag = item.battle?.starPlayer?.tag
    ? normalizePlayerTag(item.battle.starPlayer.tag)
    : null;

  if (item.battle?.teams?.length) {
    const ownTeamIndex = item.battle.teams.findIndex((team) =>
      team.some((player) => normalizePlayerTag(player.tag) === playerTag),
    );

    return item.battle.teams.flatMap((team, teamIndex) =>
      team.map((player) =>
        participantFromBattlePlayer(
          player,
          teamIndex === ownTeamIndex ? "ally" : "enemy",
          playerTag,
          starPlayerTag,
        ),
      ),
    );
  }

  return (item.battle?.players ?? []).map((player) =>
    participantFromBattlePlayer(player, "solo", playerTag, starPlayerTag),
  );
}

function participantFromBattlePlayer(player, side, playerTag, starPlayerTag) {
  const normalizedTag = normalizePlayerTag(player.tag);
  return {
    player_tag: normalizedTag,
    name: player.name,
    brawler_id: player.brawler?.id ?? null,
    brawler_name: player.brawler?.name ?? "Unknown",
    brawler_power: player.brawler?.power ?? null,
    side,
    is_player: normalizedTag === playerTag,
    is_star_player: normalizedTag === starPlayerTag,
  };
}

function parseBattleTime(value) {
  const compact = String(value ?? "").match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?Z$/,
  );

  if (compact) {
    const [, year, month, day, hour, minute, second, ms = "000"] = compact;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function hashTeams(teams) {
  const normalized = teams
    .map((team) =>
      team
        .map((player) => ({
          tag: normalizePlayerTag(player.tag),
          brawler: player.brawler?.name ?? "Unknown",
        }))
        .sort((a, b) => `${a.tag}:${a.brawler}`.localeCompare(`${b.tag}:${b.brawler}`)),
    )
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

async function buildAnalysis(supabase, playerTagInput) {
  const playerTag = normalizePlayerTag(playerTagInput);

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("tag", playerTag)
    .maybeSingle();

  if (playerError) throw databaseError(playerError);

  const { data: battles, error: battleError } = await supabase
    .from("battles")
    .select("*")
    .eq("player_tag", playerTag)
    .order("battle_time", { ascending: false })
    .limit(250);

  if (battleError) throw databaseError(battleError);

  const battleRows = battles ?? [];
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

  if (participantResult.error) throw databaseError(participantResult.error);
  if (noteResult.error) throw databaseError(noteResult.error);
  if (snapshotResult.error) throw databaseError(snapshotResult.error);

  const participantsByBattle = groupBy(participantResult.data ?? [], "battle_id");
  const notesByBattle = new Map(
    (noteResult.data ?? []).map((note) => [
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
        ? new Set(snapshotResult.data.map((row) => row.brawler_id)).size
        : 0,
      lastSyncedAt: player?.last_synced_at ?? undefined,
    },
    battles: clientBattles,
  });

  await persistRecommendations(supabase, playerTag, analysis.recommendations);
  return analysis;
}

function toClientBattle(row, participants = [], note = null) {
  return {
    id: row.id,
    battleTime: row.battle_time,
    mode: row.mode,
    map: row.map,
    result: row.result,
    duration: row.duration,
    trophyChange: row.trophy_change,
    playerBrawlerName: row.player_brawler_name,
    playerBrawlerId: row.player_brawler_id,
    playerPowerLevel: row.player_power_level,
    starPlayerTag: row.star_player_tag,
    teammates: participants
      .filter((player) => player.side === "ally" && !player.is_player)
      .map(toClientParticipant),
    enemies: participants
      .filter((player) => player.side === "enemy")
      .map(toClientParticipant),
    note,
  };
}

function toClientParticipant(row) {
  return {
    tag: row.player_tag,
    name: row.name,
    brawlerName: row.brawler_name,
    brawlerId: row.brawler_id,
    power: row.brawler_power,
    side: row.side,
  };
}

function calculatePlayerAnalysis({ player, battles }) {
  const sortedBattles = [...battles].sort(
    (a, b) => new Date(b.battleTime).getTime() - new Date(a.battleTime).getTime(),
  );
  const brawlers = calculateBrawlerMetrics(sortedBattles, player.tag);
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
    recommendations: calculateUpgradeRecommendations(brawlers),
    battles: sortedBattles,
  };
}

const ROLE_BY_BRAWLER = {
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

function calculateBrawlerMetrics(battles, playerTag) {
  return Array.from(groupByByGetter(battles, (battle) => battle.playerBrawlerName).entries())
    .map(([brawlerName, rows]) => {
      const profile = ROLE_BY_BRAWLER[brawlerName.toUpperCase()] ?? {
        role: "Flex",
        archetype: "Flex",
      };
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
        teammateDependency:
          wins === 0
            ? "Unproven"
            : starPlayerCount / wins > 0.55
              ? "Carries wins"
              : "Balanced",
        counterNotes,
        currentPowerLevel: firstNumber(rows.map((battle) => battle.playerPowerLevel)),
      };
    })
    .sort((a, b) => b.battles - a.battles || b.winRate - a.winRate);
}

function calculateModePerformance(battles, getKey) {
  return Array.from(groupByByGetter(battles, getKey).entries())
    .map(([key, rows]) => {
      const wins = rows.filter(isWin).length;
      return { key, battles: rows.length, wins, winRate: rate(wins, rows.length) };
    })
    .sort((a, b) => b.battles - a.battles || b.winRate - a.winRate);
}

function calculateUpgradeRecommendations(metrics) {
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
      const confidence =
        metric.battles >= 12 ? "High" : metric.battles >= 5 ? "Medium" : "Low";

      return {
        brawlerName: metric.brawlerName,
        score,
        confidence,
        currentPowerLevel: metric.currentPowerLevel,
        sampleSize: metric.battles,
        reasons: [
          `${metric.brawlerName} has a ${Math.round(metric.winRate * 100)}% win rate over ${metric.battles} saved match${metric.battles === 1 ? "" : "es"}.`,
          `${metric.modeSpread > 1 ? "It is working across multiple modes" : "Mode coverage is still narrow"}.`,
          `${metric.recentForm >= 0.55 ? "Recent results are trending up" : "Recent form needs more proof"}.`,
          powerLevel < 10
            ? `Power ${powerLevel} makes upgrades more urgent.`
            : `Power ${powerLevel} is already high, so urgency is moderated.`,
        ],
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

async function persistRecommendations(supabase, playerTag, recommendations) {
  const { error: deleteError } = await supabase
    .from("recommendations")
    .delete()
    .eq("player_tag", playerTag);

  if (deleteError) throw databaseError(deleteError);
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

  if (error) throw databaseError(error);
}

function calculateVersatility(battles) {
  const brawlers = new Set(battles.map((battle) => battle.playerBrawlerName)).size;
  const modes = new Set(battles.map((battle) => battle.mode)).size;
  return Math.min(100, brawlers * 9 + modes * 5);
}

function calculateSurvivalProxy(battles) {
  if (!battles.length) return 0;
  const scores = battles.map((battle) => {
    if (!battle.duration) return isWin(battle) ? 0.72 : 0.42;
    const durationComponent = Math.min(1, battle.duration / 180);
    return isWin(battle) ? 0.58 + durationComponent * 0.32 : 0.28 + durationComponent * 0.22;
  });
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function isWin(battle) {
  return ["victory", "win"].includes(String(battle.result).toLowerCase());
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function groupBy(rows, key) {
  const map = new Map();
  rows.forEach((row) => {
    const value = String(row[key] ?? "Unknown");
    map.set(value, [...(map.get(value) ?? []), row]);
  });
  return map;
}

function groupByByGetter(rows, getKey) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getKey(row) || "Unknown";
    map.set(key, [...(map.get(key) ?? []), row]);
  });
  return map;
}

function topCounts(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function firstNumber(values) {
  const value = values.find((item) => typeof item === "number");
  return typeof value === "number" ? value : null;
}

function databaseError(error) {
  return new ApiError(
    "Database request failed.",
    500,
    "database_error",
    error?.message ?? String(error),
  );
}

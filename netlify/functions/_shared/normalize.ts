import { createHash } from "node:crypto";
import type {
  BrawlBattleLogItem,
  BrawlBattlePlayer,
  BrawlPlayer,
} from "./brawlStars";
import { normalizePlayerTag } from "./brawlStars";

export type NormalizedBattle = {
  battle_time: string;
  mode: string;
  map: string;
  result: string;
  duration: number | null;
  trophy_change: number | null;
  star_player_tag: string | null;
  player_brawler_id: number | null;
  player_brawler_name: string;
  player_power_level: number | null;
  teams_hash: string;
  dedupe_key: string;
  raw: BrawlBattleLogItem;
  participants: NormalizedParticipant[];
};

export type NormalizedParticipant = {
  player_tag: string;
  name: string;
  brawler_id: number | null;
  brawler_name: string;
  brawler_power: number | null;
  side: "ally" | "enemy" | "solo";
  is_player: boolean;
  is_star_player: boolean;
};

export function toPlayerSummary(player: BrawlPlayer) {
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

export function toBrawlerSnapshots(player: BrawlPlayer) {
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

export function normalizeBattle(
  item: BrawlBattleLogItem,
  playerTagInput: string,
): NormalizedBattle | null {
  const playerTag = normalizePlayerTag(playerTagInput);
  const teams = item.battle.teams ?? [];
  const players = item.battle.players ?? [];
  const allPlayers = teams.flat().concat(players);
  const self = allPlayers.find((player) => normalizePlayerTag(player.tag) === playerTag);

  if (!self) return null;

  const mode = item.event?.mode ?? item.battle.mode ?? "unknown";
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
    battle_time: battleTime,
    mode,
    map,
    result: item.battle.result ?? "unknown",
    duration: item.battle.duration ?? null,
    trophy_change: item.battle.trophyChange ?? null,
    star_player_tag: item.battle.starPlayer?.tag
      ? normalizePlayerTag(item.battle.starPlayer.tag)
      : null,
    player_brawler_id: self.brawler.id ?? null,
    player_brawler_name: self.brawler.name,
    player_power_level: self.brawler.power ?? null,
    teams_hash: teamsHash,
    dedupe_key: dedupeKey,
    raw: item,
    participants: normalizeParticipants(item, playerTag),
  };
}

function normalizeParticipants(
  item: BrawlBattleLogItem,
  playerTag: string,
): NormalizedParticipant[] {
  const starPlayerTag = item.battle.starPlayer?.tag
    ? normalizePlayerTag(item.battle.starPlayer.tag)
    : null;

  if (item.battle.teams?.length) {
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

  return (item.battle.players ?? []).map((player) =>
    participantFromBattlePlayer(player, "solo", playerTag, starPlayerTag),
  );
}

function participantFromBattlePlayer(
  player: BrawlBattlePlayer,
  side: "ally" | "enemy" | "solo",
  playerTag: string,
  starPlayerTag: string | null,
): NormalizedParticipant {
  const normalizedTag = normalizePlayerTag(player.tag);
  return {
    player_tag: normalizedTag,
    name: player.name,
    brawler_id: player.brawler.id ?? null,
    brawler_name: player.brawler.name,
    brawler_power: player.brawler.power ?? null,
    side,
    is_player: normalizedTag === playerTag,
    is_star_player: normalizedTag === starPlayerTag,
  };
}

function parseBattleTime(value: string) {
  const compact = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?Z$/,
  );

  if (compact) {
    const [, year, month, day, hour, minute, second, ms = "000"] = compact;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function hashTeams(teams: BrawlBattlePlayer[][]) {
  const normalized = teams
    .map((team) =>
      team
        .map((player) => ({
          tag: normalizePlayerTag(player.tag),
          brawler: player.brawler.name,
        }))
        .sort((a, b) => `${a.tag}:${a.brawler}`.localeCompare(`${b.tag}:${b.brawler}`)),
    )
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function toClientBattle(
  row: Record<string, any>,
  participants: Record<string, any>[] = [],
  note?: { tags: string[]; note: string } | null,
) {
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

function toClientParticipant(row: Record<string, any>) {
  return {
    tag: row.player_tag,
    name: row.name,
    brawlerName: row.brawler_name,
    brawlerId: row.brawler_id,
    power: row.brawler_power,
    side: row.side,
  };
}

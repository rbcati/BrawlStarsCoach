import { createHash } from "node:crypto";
import type {
  BrawlBattleLogItem,
  BrawlBattlePlayer,
  BrawlPlayer,
} from "./brawlStars";
import { normalizePlayerTag } from "./brawlStars";

export type NormalizedBattle = {
  stable_battle_id: string;
  battle_time: string;
  mode: string;
  map: string;
  battle_type: string | null;
  result: string;
  duration: number | null;
  trophy_change: number | null;
  star_player_tag: string | null;
  player_brawler_id: number | null;
  player_brawler_name: string;
  player_power_level: number | null;
  target_team_index: number | null;
  team_average_power: number | null;
  enemy_average_power: number | null;
  team_average_trophies: number | null;
  enemy_average_trophies: number | null;
  adjusted_difficulty_score: number | null;
  enemy_comp_archetype: string | null;
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
  brawler_trophies: number | null;
  side: "ally" | "enemy" | "solo";
  relationship: "target_player" | "teammate" | "opponent";
  team_index: number | null;
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
  const targetTeamIndex = identifyTargetTeamIndex(item, playerTag);
  const stableBattleId = generateStableBattleId(item, battleTime, mode, map);
  const teamsHash = hashTeams(teams.length > 0 ? teams : [players]);
  const participants = normalizeParticipants(item, playerTag, targetTeamIndex);
  const teamRows = participants.filter(
    (participant) => participant.relationship !== "opponent",
  );
  const enemyRows = participants.filter(
    (participant) => participant.relationship === "opponent",
  );
  const teamAveragePower = averageNumbers(teamRows.map((player) => player.brawler_power));
  const enemyAveragePower = averageNumbers(enemyRows.map((player) => player.brawler_power));
  const teamAverageTrophies = averageNumbers(
    teamRows.map((player) => player.brawler_trophies),
  );
  const enemyAverageTrophies = averageNumbers(
    enemyRows.map((player) => player.brawler_trophies),
  );
  const dedupeKey = [playerTag, stableBattleId].join("|");

  return {
    stable_battle_id: stableBattleId,
    battle_time: battleTime,
    mode,
    map,
    battle_type: item.battle.type ?? null,
    result: item.battle.result ?? "unknown",
    duration: item.battle.duration ?? null,
    trophy_change: item.battle.trophyChange ?? null,
    star_player_tag: item.battle.starPlayer?.tag
      ? normalizePlayerTag(item.battle.starPlayer.tag)
      : null,
    player_brawler_id: self.brawler.id ?? null,
    player_brawler_name: self.brawler.name,
    player_power_level: self.brawler.power ?? null,
    target_team_index: targetTeamIndex,
    team_average_power: teamAveragePower,
    enemy_average_power: enemyAveragePower,
    team_average_trophies: teamAverageTrophies,
    enemy_average_trophies: enemyAverageTrophies,
    adjusted_difficulty_score: calculateAdjustedDifficultyScore({
      teamAveragePower,
      enemyAveragePower,
      teamAverageTrophies,
      enemyAverageTrophies,
    }),
    enemy_comp_archetype: enemyCompArchetype(enemyRows),
    teams_hash: teamsHash,
    dedupe_key: dedupeKey,
    raw: item,
    participants,
  };
}

export function identifyTargetTeamIndex(
  item: BrawlBattleLogItem,
  playerTag: string,
): number | null {
  if (!item.battle.teams?.length) return null;

  const index = item.battle.teams.findIndex((team) =>
    team.some((player) => normalizePlayerTag(player.tag) === playerTag),
  );

  return index >= 0 ? index : null;
}

function normalizeParticipants(
  item: BrawlBattleLogItem,
  playerTag: string,
  targetTeamIndex: number | null,
): NormalizedParticipant[] {
  const starPlayerTag = item.battle.starPlayer?.tag
    ? normalizePlayerTag(item.battle.starPlayer.tag)
    : null;

  if (item.battle.teams?.length) {
    return item.battle.teams.flatMap((team, teamIndex) =>
      team.map((player) =>
        participantFromBattlePlayer(
          player,
          teamIndex === targetTeamIndex ? "ally" : "enemy",
          playerTag,
          starPlayerTag,
          teamIndex,
        ),
      ),
    );
  }

  return (item.battle.players ?? []).map((player) =>
    participantFromBattlePlayer(player, "solo", playerTag, starPlayerTag, null),
  );
}

function participantFromBattlePlayer(
  player: BrawlBattlePlayer,
  side: "ally" | "enemy" | "solo",
  playerTag: string,
  starPlayerTag: string | null,
  teamIndex: number | null,
): NormalizedParticipant {
  const normalizedTag = normalizePlayerTag(player.tag);
  const isTarget = normalizedTag === playerTag;
  return {
    player_tag: normalizedTag,
    name: player.name,
    brawler_id: player.brawler.id ?? null,
    brawler_name: player.brawler.name,
    brawler_power: player.brawler.power ?? null,
    brawler_trophies: player.brawler.trophies ?? null,
    side,
    relationship: isTarget ? "target_player" : side === "ally" ? "teammate" : "opponent",
    team_index: teamIndex,
    is_player: isTarget,
    is_star_player: normalizedTag === starPlayerTag,
  };
}

export function parseBattleTime(value: string) {
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

export function generateStableBattleId(
  item: BrawlBattleLogItem,
  battleTime: string,
  mode: string,
  map: string,
) {
  const players = (item.battle.teams?.length
    ? item.battle.teams.flat()
    : item.battle.players ?? []
  )
    .map((player) => ({
      tag: normalizePlayerTag(player.tag),
      brawlerId: player.brawler.id ?? null,
    }))
    .sort((a, b) =>
      `${a.tag}:${a.brawlerId ?? "unknown"}`.localeCompare(
        `${b.tag}:${b.brawlerId ?? "unknown"}`,
      ),
    );

  return createHash("sha256")
    .update(
      JSON.stringify({
        battleTime,
        mode: mode.toLowerCase(),
        map: map.toLowerCase(),
        players,
      }),
    )
    .digest("hex");
}

function hashTeams(teams: BrawlBattlePlayer[][]) {
  const normalized = teams
    .map((team) =>
      team
        .map((player) => ({
          tag: normalizePlayerTag(player.tag),
          brawlerId: player.brawler.id ?? null,
        }))
        .sort((a, b) =>
          `${a.tag}:${a.brawlerId ?? "unknown"}`.localeCompare(
            `${b.tag}:${b.brawlerId ?? "unknown"}`,
          ),
        ),
    )
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function averageNumbers(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => typeof value === "number");
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function calculateAdjustedDifficultyScore({
  teamAveragePower,
  enemyAveragePower,
  teamAverageTrophies,
  enemyAverageTrophies,
}: {
  teamAveragePower: number | null;
  enemyAveragePower: number | null;
  teamAverageTrophies: number | null;
  enemyAverageTrophies: number | null;
}) {
  const powerDiff =
    typeof enemyAveragePower === "number" && typeof teamAveragePower === "number"
      ? (enemyAveragePower - teamAveragePower) * 8
      : 0;
  const trophyDiff =
    typeof enemyAverageTrophies === "number" && typeof teamAverageTrophies === "number"
      ? (enemyAverageTrophies - teamAverageTrophies) / 25
      : 0;

  return Math.round(Math.max(-40, Math.min(40, powerDiff + trophyDiff)));
}

function enemyCompArchetype(enemies: NormalizedParticipant[]) {
  if (!enemies.length) return null;

  const counts = new Map<string, number>();
  enemies.forEach((enemy) => {
    const key = inferBrawlerArchetype(enemy.brawler_name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => (count > 1 ? `${count} ${name}` : name))
    .join(" + ");
}

function inferBrawlerArchetype(name: string) {
  const upper = name.toUpperCase();
  if (["BULL", "EL PRIMO", "ROSA", "FRANK", "BIBI", "JACKY", "MEG", "SAM", "BUSTER"].includes(upper)) {
    return "Tank";
  }
  if (["MORTIS", "EDGAR", "STU", "CROW", "LEON", "BUZZ", "FANG", "CORDELIUS", "MICO", "MELODIE", "LILY", "KENJI"].includes(upper)) {
    return "Aggro";
  }
  if (["POCO", "PAM", "GENE", "MAX", "BYRON", "GUS", "GRAY", "SANDY", "KIT", "BERRY"].includes(upper)) {
    return "Support";
  }
  if (["BARLEY", "DYNAMIKE", "TICK", "GROM", "SPROUT", "LARRY & LAWRIE", "NITA", "JESSIE", "PENNY", "BO", "EMZ", "MR. P", "SQUEAK", "SPIKE", "AMBER", "LOU", "EVE", "OTIS", "CHUCK", "CHARLIE"].includes(upper)) {
    return "Control";
  }
  return "Damage";
}

export function toClientBattle(
  row: Record<string, any>,
  participants: Record<string, any>[] = [],
  note?: { tags: string[]; note: string } | null,
) {
  return {
    id: row.id,
    stableBattleId: row.stable_battle_id,
    battleTime: row.battle_time,
    mode: row.mode,
    map: row.map,
    battleType: row.battle_type,
    result: row.result,
    duration: row.duration,
    trophyChange: row.trophy_change,
    playerBrawlerName: row.player_brawler_name,
    playerBrawlerId: row.player_brawler_id,
    playerPowerLevel: row.player_power_level,
    starPlayerTag: row.star_player_tag,
    targetTeamIndex: row.target_team_index,
    teamAveragePower: row.team_average_power,
    enemyAveragePower: row.enemy_average_power,
    teamAverageTrophies: row.team_average_trophies,
    enemyAverageTrophies: row.enemy_average_trophies,
    adjustedDifficultyScore: row.adjusted_difficulty_score,
    enemyCompArchetype: row.enemy_comp_archetype,
    targetPlayer:
      participants.find((player) => player.relationship === "target_player" || player.is_player)
        ? toClientParticipant(
            participants.find(
              (player) => player.relationship === "target_player" || player.is_player,
            )!,
          )
        : null,
    teammates: participants
      .filter(
        (player) =>
          player.relationship === "teammate" ||
          (player.side === "ally" && !player.is_player),
      )
      .map(toClientParticipant),
    enemies: participants
      .filter(
        (player) => player.relationship === "opponent" || player.side === "enemy",
      )
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
    trophies: row.brawler_trophies,
    side: row.side,
    relationship: row.relationship,
    isStarPlayer: row.is_star_player,
  };
}

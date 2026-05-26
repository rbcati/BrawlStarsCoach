import { describe, expect, it } from "vitest";
import type { BrawlBattleLogItem, BrawlBattlePlayer } from "./brawlStars";
import { identifyTargetTeamIndex, normalizeBattle } from "./normalize";

const target = player("#2PP", "Target", 16000000, "COLT", 9, 600);
const ally = player("#8YY", "Ally", 16000001, "POCO", 8, 560);
const enemyOne = player("#9LL", "Enemy 1", 16000002, "BULL", 10, 650);
const enemyTwo = player("#PQQ", "Enemy 2", 16000003, "PIPER", 11, 700);

describe("battlelog normalization", () => {
  it("identifies the target player's team by tag", () => {
    const item = battle([[enemyOne, enemyTwo], [target, ally]]);

    expect(identifyTargetTeamIndex(item, "#2PP")).toBe(1);
  });

  it("separates target player, teammates, and opponents", () => {
    const normalized = normalizeBattle(battle([[target, ally], [enemyOne, enemyTwo]]), "#2PP");

    expect(normalized).not.toBeNull();
    expect(normalized?.target_team_index).toBe(0);
    expect(normalized?.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          player_tag: "#2PP",
          relationship: "target_player",
          side: "ally",
          is_player: true,
        }),
        expect.objectContaining({
          player_tag: "#8YY",
          relationship: "teammate",
          side: "ally",
        }),
        expect.objectContaining({
          player_tag: "#9LL",
          relationship: "opponent",
          side: "enemy",
        }),
      ]),
    );
  });

  it("uses a stable battle ID and dedupe key for the same battle participants", () => {
    const first = normalizeBattle(battle([[target, ally], [enemyOne, enemyTwo]]), "#2PP");
    const reordered = normalizeBattle(
      battle([[enemyTwo, enemyOne], [ally, target]]),
      "#2PP",
    );

    expect(first?.stable_battle_id).toBe(reordered?.stable_battle_id);
    expect(first?.dedupe_key).toBe(reordered?.dedupe_key);
  });

  it("keeps optional trophyChange and starPlayer fields nullable", () => {
    const normalized = normalizeBattle(
      {
        ...battle([[target, ally], [enemyOne, enemyTwo]]),
        battle: {
          ...battle([[target, ally], [enemyOne, enemyTwo]]).battle,
          trophyChange: undefined,
          starPlayer: undefined,
        },
      },
      "#2PP",
    );

    expect(normalized?.trophy_change).toBeNull();
    expect(normalized?.star_player_tag).toBeNull();
  });
});

function battle(teams: BrawlBattlePlayer[][]): BrawlBattleLogItem {
  return {
    battleTime: "20260525T180000.000Z",
    event: {
      mode: "gemGrab",
      map: "Hard Rock Mine",
    },
    battle: {
      mode: "gemGrab",
      type: "ranked",
      result: "victory",
      duration: 120,
      trophyChange: 8,
      starPlayer: target,
      teams,
    },
  };
}

function player(
  tag: string,
  name: string,
  brawlerId: number,
  brawlerName: string,
  power: number,
  trophies: number,
): BrawlBattlePlayer {
  return {
    tag,
    name,
    brawler: {
      id: brawlerId,
      name: brawlerName,
      power,
      trophies,
    },
  };
}

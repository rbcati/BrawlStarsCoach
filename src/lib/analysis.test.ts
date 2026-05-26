import { describe, expect, it } from "vitest";
import {
  calculateAdvancedAnalytics,
  calculateEnemyMatchups,
  calculateTeammateBrawlerSynergy,
  getConfidenceLabel,
} from "./analysis";
import type { SavedBattle } from "./types";

describe("advanced analytics", () => {
  it("aggregates user brawler vs enemy brawler appearance matchups", () => {
    const matchups = calculateEnemyMatchups([
      savedBattle({ result: "victory", enemyBrawler: "BULL" }),
      savedBattle({ result: "defeat", enemyBrawler: "BULL" }),
      savedBattle({ result: "defeat", enemyBrawler: "PIPER" }),
    ]);

    const bull = matchups.find((item) => item.enemyBrawlerName === "BULL");

    expect(bull).toMatchObject({
      userBrawlerName: "COLT",
      enemyBrawlerName: "BULL",
      matches: 2,
      wins: 1,
      losses: 1,
      label: "Enemy team appearance matchup",
      inferred: true,
    });
    expect(bull?.winRate).toBe(0.5);
  });

  it("aggregates teammate brawler synergy", () => {
    const synergy = calculateTeammateBrawlerSynergy([
      savedBattle({ result: "victory", teammateBrawler: "POCO" }),
      savedBattle({ result: "victory", teammateBrawler: "POCO" }),
      savedBattle({ result: "defeat", teammateBrawler: "PAM" }),
    ]);

    const poco = synergy.find((item) => item.teammateBrawlerName === "POCO");

    expect(poco).toMatchObject({
      userBrawlerName: "COLT",
      teammateBrawlerName: "POCO",
      matches: 2,
      wins: 2,
      winRate: 1,
      label: "Teammate brawler appearance synergy",
      inferred: true,
    });
  });

  it("uses exact confidence thresholds", () => {
    expect(getConfidenceLabel(0)).toBe("low");
    expect(getConfidenceLabel(4)).toBe("low");
    expect(getConfidenceLabel(5)).toBe("medium");
    expect(getConfidenceLabel(14)).toBe("medium");
    expect(getConfidenceLabel(15)).toBe("high");
  });

  it("handles missing trophyChange and starPlayer fields", () => {
    const analytics = calculateAdvancedAnalytics([
      savedBattle({
        result: "victory",
        trophyChange: null,
        starPlayerTag: null,
      }),
    ]);

    expect(analytics.worstEnemyMatchups[0]?.averageTrophyChange ?? null).toBeNull();
    expect(analytics.starPlayerRates[0]).toMatchObject({
      matches: 1,
      starPlayerMatches: 0,
      starPlayerRate: 0,
    });
  });
});

function savedBattle({
  result,
  enemyBrawler = "BULL",
  teammateBrawler = "POCO",
  trophyChange = 8,
  starPlayerTag = "#2PP",
}: {
  result: string;
  enemyBrawler?: string;
  teammateBrawler?: string;
  trophyChange?: number | null;
  starPlayerTag?: string | null;
}): SavedBattle {
  return {
    id: `${result}-${enemyBrawler}-${teammateBrawler}`,
    stableBattleId: `${result}-${enemyBrawler}-${teammateBrawler}`,
    battleTime: "2026-05-25T18:00:00.000Z",
    mode: "gemGrab",
    map: "Hard Rock Mine",
    battleType: "ranked",
    result,
    duration: 120,
    trophyChange,
    playerBrawlerName: "COLT",
    playerBrawlerId: 16000000,
    playerPowerLevel: 9,
    starPlayerTag,
    targetTeamIndex: 0,
    teamAveragePower: 8.5,
    enemyAveragePower: 10.5,
    teamAverageTrophies: 580,
    enemyAverageTrophies: 670,
    adjustedDifficultyScore: 20,
    enemyCompArchetype: "Tank + Damage",
    targetPlayer: {
      tag: "#2PP",
      name: "Target",
      brawlerName: "COLT",
      brawlerId: 16000000,
      power: 9,
      trophies: 600,
      side: "ally",
      relationship: "target_player",
    },
    teammates: [
      {
        tag: "#8YY",
        name: "Ally",
        brawlerName: teammateBrawler,
        brawlerId: 16000001,
        power: 8,
        trophies: 560,
        side: "ally",
        relationship: "teammate",
      },
    ],
    enemies: [
      {
        tag: "#9LL",
        name: "Enemy",
        brawlerName: enemyBrawler,
        brawlerId: 16000002,
        power: 10,
        trophies: 650,
        side: "enemy",
        relationship: "opponent",
      },
    ],
  };
}

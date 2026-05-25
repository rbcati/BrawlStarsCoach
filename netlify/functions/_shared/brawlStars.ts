import { HttpError } from "./http";
import { getEnv } from "./env";

const API_BASE = "https://api.brawlstars.com/v1";

export type BrawlPlayer = {
  tag: string;
  name: string;
  trophies?: number;
  highestTrophies?: number;
  expLevel?: number;
  brawlers?: BrawlPlayerBrawler[];
};

export type BrawlPlayerBrawler = {
  id: number;
  name: string;
  power?: number;
  trophies?: number;
  highestTrophies?: number;
};

export type BrawlBattleLog = {
  items: BrawlBattleLogItem[];
};

export type BrawlBattleLogItem = {
  battleTime: string;
  event?: {
    id?: number;
    mode?: string;
    map?: string;
  };
  battle: {
    mode?: string;
    type?: string;
    result?: string;
    duration?: number;
    trophyChange?: number;
    starPlayer?: BrawlBattlePlayer;
    teams?: BrawlBattlePlayer[][];
    players?: BrawlBattlePlayer[];
  };
};

export type BrawlBattlePlayer = {
  tag: string;
  name: string;
  brawler: {
    id?: number;
    name: string;
    power?: number;
    trophies?: number;
  };
};

export function normalizePlayerTag(input: string) {
  const tag = input.trim().toUpperCase();
  if (!tag) throw new HttpError("Player tag is required.", 400);

  const withHash = tag.startsWith("#") ? tag : `#${tag}`;
  if (!/^#[0289PYLQGRJCUV]{2,14}$/.test(withHash)) {
    throw new HttpError(
      "Player tag looks invalid. Use the official tag format, for example #2PP.",
      400,
    );
  }

  return withHash;
}

export function encodeTagForPath(tag: string) {
  return encodeURIComponent(normalizePlayerTag(tag));
}

export async function fetchBrawlApi<T>(path: string): Promise<T> {
  const token = getEnv("BRAWL_STARS_API_TOKEN");
  if (!token) {
    throw new HttpError(
      "BRAWL_STARS_API_TOKEN is missing on the server. Add it in Netlify environment variables.",
      500,
    );
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (response.ok) return (await response.json()) as T;

  let detail = "";
  try {
    const payload = await response.json();
    detail = payload?.message ? ` ${payload.message}` : "";
  } catch {
    detail = "";
  }

  if (response.status === 400) {
    throw new HttpError(`The Brawl Stars API rejected that player tag.${detail}`, 400);
  }
  if (response.status === 403) {
    throw new HttpError(
      "Brawl Stars API access was denied. Check the token and any API key IP restrictions.",
      502,
    );
  }
  if (response.status === 404) {
    throw new HttpError("No Brawl Stars player was found for that tag.", 404);
  }
  if (response.status === 429) {
    throw new HttpError("Brawl Stars API rate limit reached. Try again shortly.", 429);
  }

  throw new HttpError(
    `Brawl Stars API request failed with status ${response.status}.${detail}`,
    502,
  );
}

export async function getOfficialPlayer(tag: string) {
  return fetchBrawlApi<BrawlPlayer>(`/players/${encodeTagForPath(tag)}`);
}

export async function getOfficialBattleLog(tag: string) {
  return fetchBrawlApi<BrawlBattleLog>(
    `/players/${encodeTagForPath(tag)}/battlelog`,
  );
}

import type { ManualNote, PlayerAnalysis, SyncResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type ApiOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

export const apiConfigError = API_BASE_URL
  ? null
  : "VITE_API_BASE_URL is missing. Set it to the Oracle backend URL, for example http://161.153.75.96:3001.";

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error ??
      payload?.message ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error(apiConfigError ?? "VITE_API_BASE_URL is missing.");
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function tagPath(playerTag: string) {
  return encodeURIComponent(playerTag.trim());
}

export function getPlayer(playerTag: string) {
  return request(`${requireApiBaseUrl()}/api/player/${tagPath(playerTag)}`);
}

export function getBattleLog(playerTag: string) {
  return request(`${requireApiBaseUrl()}/api/battlelog/${tagPath(playerTag)}`);
}

export function syncBattles(playerTag: string) {
  return request<SyncResponse>(`${requireApiBaseUrl()}/api/sync/${tagPath(playerTag)}`, {
    method: "POST",
  });
}

export function analyzePlayer(playerTag: string) {
  return request<PlayerAnalysis>(`${requireApiBaseUrl()}/api/analyze/${tagPath(playerTag)}`);
}

export function saveBattleNote(
  battleId: string,
  playerTag: string,
  note: ManualNote,
) {
  return request<{ note: ManualNote }>("/api/save-battle-note", {
    method: "POST",
    body: { battleId, playerTag, tags: note.tags, note: note.note },
  });
}

import type { ManualNote, PlayerAnalysis, SyncResponse } from "./types";

type ApiOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

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

export function syncBattles(playerTag: string) {
  return request<SyncResponse>("/api/syncBattles", {
    method: "POST",
    body: { playerTag },
  });
}

export function analyzePlayer(playerTag: string) {
  const tag = encodeURIComponent(playerTag.trim());
  return request<PlayerAnalysis>(`/api/analyzePlayer?tag=${tag}`);
}

export function saveBattleNote(
  battleId: string,
  playerTag: string,
  note: ManualNote,
) {
  return request<{ note: ManualNote }>("/api/saveBattleNote", {
    method: "POST",
    body: { battleId, playerTag, tags: note.tags, note: note.note },
  });
}

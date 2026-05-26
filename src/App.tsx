import { Moon, RefreshCcw, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdvancedAnalyticsCards } from "./components/AdvancedAnalyticsCards";
import { BrawlerPerformance } from "./components/BrawlerPerformance";
import { ModeMapPerformance } from "./components/ModeMapPerformance";
import { Overview } from "./components/Overview";
import { RecentBattles } from "./components/RecentBattles";
import { UpgradeRecommendations } from "./components/UpgradeRecommendations";
import { analyzePlayer, apiConfigError, saveBattleNote, syncBattles } from "./lib/api";
import type { ManualNote, PlayerAnalysis, SavedBattle } from "./lib/types";

const DEFAULT_PLAYER_TAG = "GQ0GRPCVQ";
const THEME_STORAGE_KEY = "brawl-stars-coach-theme";

type Theme = "light" | "dark";

function normalizeTagInput(tag: string) {
  const trimmed = (tag.trim() || DEFAULT_PLAYER_TAG).toUpperCase();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function App() {
  const [playerTag, setPlayerTag] = useState(DEFAULT_PLAYER_TAG);
  const [autoSave, setAutoSave] = useState(false);
  const [analysis, setAnalysis] = useState<PlayerAnalysis | null>(null);
  const [status, setStatus] = useState(
    apiConfigError ?? "Enter a player tag to start coaching.",
  );
  const [error, setError] = useState<string | null>(apiConfigError);
  const [isSyncing, setIsSyncing] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, ManualNote>>({});
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const syncInFlightRef = useRef(false);

  const normalizedTag = useMemo(() => normalizeTagInput(playerTag), [playerTag]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const hydrateNotes = useCallback((battles: SavedBattle[]) => {
    setNoteDrafts((current) => {
      const next = { ...current };
      battles.forEach((battle) => {
        if (battle.id && !next[battle.id]) {
          next[battle.id] = battle.note ?? { tags: [], note: "" };
        }
      });
      return next;
    });
  }, []);

  const fetchAndSync = useCallback(
    async (source: "manual" | "auto" = "manual") => {
      if (apiConfigError) {
        setError(apiConfigError);
        setStatus(apiConfigError);
        return;
      }

      if (syncInFlightRef.current) {
        if (source === "manual") {
          setStatus("A sync is already running. Finishing that one first.");
        }
        return;
      }

      syncInFlightRef.current = true;
      setIsSyncing(true);
      setError(null);
      setStatus("Syncing official battle log and refreshing analysis...");

      try {
        const result = await syncBattles(normalizedTag);
        setAnalysis(result.analysis);
        setStatus(
          `Fetched ${result.fetchedCount} battles. Saved ${result.savedCount} new battle${
            result.savedCount === 1 ? "" : "s"
          }.`,
        );
        hydrateNotes(result.analysis.battles);
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : "Sync failed.");
        try {
          const existing = await analyzePlayer(normalizedTag);
          setAnalysis(existing);
          hydrateNotes(existing.battles);
          setStatus("Showing saved analysis from Supabase.");
        } catch {
          setStatus("No saved analysis loaded.");
        }
      } finally {
        syncInFlightRef.current = false;
        setIsSyncing(false);
      }
    },
    [hydrateNotes, normalizedTag],
  );

  const persistNote = useCallback(
    async (battle: SavedBattle) => {
      if (!battle.id) return;
      const draft = noteDrafts[battle.id] ?? { tags: [], note: "" };

      try {
        await saveBattleNote(battle.id, normalizedTag, draft);
        setStatus("Manual notes saved.");
        setAnalysis((current) => {
          if (!current) return current;
          return {
            ...current,
            battles: current.battles.map((item) =>
              item.id === battle.id ? { ...item, note: draft } : item,
            ),
          };
        });
      } catch (noteError) {
        setError(
          noteError instanceof Error
            ? noteError.message
            : "Could not save match notes.",
        );
      }
    },
    [normalizedTag, noteDrafts],
  );

  const toggleBattleTag = useCallback((battleId: string, tag: string) => {
    setNoteDrafts((current) => {
      const existing = current[battleId] ?? { tags: [], note: "" };
      const tags = existing.tags.includes(tag)
        ? existing.tags.filter((item) => item !== tag)
        : [...existing.tags, tag];
      return { ...current, [battleId]: { ...existing, tags } };
    });
  }, []);

  useEffect(() => {
    if (!autoSave) return undefined;

    const id = window.setInterval(() => {
      void fetchAndSync("auto");
    }, 5 * 60 * 1000);

    return () => window.clearInterval(id);
  }, [autoSave, fetchAndSync]);

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Brawl Stars Coach controls">
        <div>
          <p className="app-kicker">Brawl Stars Coach</p>
          <h1>Turn recent battles into upgrade decisions.</h1>
        </div>
        <div className="command-strip">
          <label className="tag-field">
            <span>Player tag</span>
            <input
              value={playerTag}
              onChange={(event) => setPlayerTag(event.target.value)}
              placeholder="#YOURTAG"
              autoComplete="off"
            />
          </label>
          <button
            className="primary-button"
            onClick={() => void fetchAndSync("manual")}
            disabled={isSyncing}
          >
            <RefreshCcw size={18} />
            {isSyncing ? "Syncing..." : "Fetch Latest Battles"}
          </button>
          <button
            className="theme-button"
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(event) => setAutoSave(event.target.checked)}
            />
            <span>Auto-save battles every 5 minutes</span>
          </label>
        </div>
      </section>

      <section className="status-row" aria-live="polite">
        <span className={error ? "status-dot error" : "status-dot"} />
        <p>{error ?? status}</p>
      </section>

      <section className="dashboard-grid">
        <Overview analysis={analysis} />
        <UpgradeRecommendations recommendations={analysis?.recommendations ?? []} />
        <BrawlerPerformance brawlers={analysis?.brawlers ?? []} />
        <ModeMapPerformance analysis={analysis} />
      </section>

      <AdvancedAnalyticsCards analysis={analysis} />

      <RecentBattles
        battles={analysis?.battles ?? []}
        noteDrafts={noteDrafts}
        onNoteChange={(battleId, note) =>
          setNoteDrafts((current) => ({
            ...current,
            [battleId]: { ...(current[battleId] ?? { tags: [], note: "" }), note },
          }))
        }
        onTagToggle={toggleBattleTag}
        onSaveNote={persistNote}
      />
    </main>
  );
}

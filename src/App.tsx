import {
  Activity,
  BarChart3,
  BookOpenText,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { analyzePlayer, saveBattleNote, syncBattles } from "./lib/api";
import type {
  BrawlerMetric,
  ManualNote,
  PlayerAnalysis,
  SavedBattle,
  UpgradeRecommendation,
} from "./lib/types";

const MANUAL_TAGS = [
  "bad draft",
  "carried",
  "countered",
  "felt controlled",
  "tilted",
  "teammates weak",
];

function formatPercent(value = 0) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeTagInput(tag: string) {
  const trimmed = tag.trim().toUpperCase();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export default function App() {
  const [playerTag, setPlayerTag] = useState("");
  const [autoSave, setAutoSave] = useState(false);
  const [analysis, setAnalysis] = useState<PlayerAnalysis | null>(null);
  const [status, setStatus] = useState("Enter a player tag to start coaching.");
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, ManualNote>>({});

  const normalizedTag = useMemo(() => normalizeTagInput(playerTag), [playerTag]);

  async function fetchAndSync() {
    if (!normalizedTag) {
      setError("Enter a Brawl Stars player tag, like #2PP or #ABC123.");
      return;
    }

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
      setIsSyncing(false);
    }
  }

  function hydrateNotes(battles: SavedBattle[]) {
    setNoteDrafts((current) => {
      const next = { ...current };
      battles.forEach((battle) => {
        if (battle.id && !next[battle.id]) {
          next[battle.id] = battle.note ?? { tags: [], note: "" };
        }
      });
      return next;
    });
  }

  async function persistNote(battle: SavedBattle) {
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
  }

  function toggleBattleTag(battleId: string, tag: string) {
    setNoteDrafts((current) => {
      const existing = current[battleId] ?? { tags: [], note: "" };
      const tags = existing.tags.includes(tag)
        ? existing.tags.filter((item) => item !== tag)
        : [...existing.tags, tag];
      return { ...current, [battleId]: { ...existing, tags } };
    });
  }

  useEffect(() => {
    if (!autoSave || !normalizedTag) return undefined;

    const id = window.setInterval(() => {
      void fetchAndSync();
    }, 5 * 60 * 1000);

    return () => window.clearInterval(id);
  }, [autoSave, normalizedTag]);

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
            onClick={fetchAndSync}
            disabled={isSyncing}
          >
            <RefreshCcw size={18} />
            {isSyncing ? "Syncing..." : "Fetch Latest Battles"}
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

function Overview({ analysis }: { analysis: PlayerAnalysis | null }) {
  const player = analysis?.player;
  const totals = analysis?.totals;

  return (
    <article className="panel overview-panel">
      <div className="section-heading">
        <Trophy size={20} />
        <h2>Player overview</h2>
      </div>
      <div className="player-name">{player?.name ?? "No player loaded"}</div>
      <p className="muted">{player?.tag ?? "Sync a tag to build a saved battle history."}</p>
      <div className="metric-grid">
        <Metric label="Saved battles" value={totals?.battles ?? 0} />
        <Metric label="Win rate" value={totals ? formatPercent(totals.winRate) : "0%"} />
        <Metric
          label="Star player"
          value={totals ? formatPercent(totals.starPlayerRate) : "0%"}
        />
        <Metric
          label="Versatility"
          value={totals ? Math.round(totals.versatilityScore) : 0}
        />
      </div>
    </article>
  );
}

function UpgradeRecommendations({
  recommendations,
}: {
  recommendations: UpgradeRecommendation[];
}) {
  return (
    <article className="panel recommendations-panel">
      <div className="section-heading">
        <Sparkles size={20} />
        <h2>Upgrade recommendations</h2>
      </div>
      {recommendations.length === 0 ? (
        <EmptyState message="Sync more battles to generate confident upgrade priorities." />
      ) : (
        <div className="recommendation-list">
          {recommendations.slice(0, 5).map((item) => (
            <div className="recommendation-row" key={item.brawlerName}>
              <div>
                <strong>{item.brawlerName}</strong>
                <p>{item.reasons.join(" ")}</p>
              </div>
              <div className="score-stack">
                <span>{Math.round(item.score)}</span>
                <small>{item.confidence}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function BrawlerPerformance({ brawlers }: { brawlers: BrawlerMetric[] }) {
  return (
    <article className="panel table-panel">
      <div className="section-heading">
        <Target size={20} />
        <h2>Brawler performance</h2>
      </div>
      {brawlers.length === 0 ? (
        <EmptyState message="Brawler win rates appear after the first sync." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Brawler</th>
                <th>Role</th>
                <th>Games</th>
                <th>Win</th>
                <th>Recent</th>
                <th>Power</th>
              </tr>
            </thead>
            <tbody>
              {brawlers.slice(0, 8).map((item) => (
                <tr key={item.brawlerName}>
                  <td>{item.brawlerName}</td>
                  <td>{item.role}</td>
                  <td>{item.battles}</td>
                  <td>{formatPercent(item.winRate)}</td>
                  <td>{formatPercent(item.recentForm)}</td>
                  <td>{item.currentPowerLevel ?? "?"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function ModeMapPerformance({ analysis }: { analysis: PlayerAnalysis | null }) {
  return (
    <article className="panel mode-panel">
      <div className="section-heading">
        <BarChart3 size={20} />
        <h2>Mode / map performance</h2>
      </div>
      <div className="split-list">
        <MetricList
          icon={<Activity size={18} />}
          title="Modes"
          rows={analysis?.modes ?? []}
        />
        <MetricList
          icon={<ShieldCheck size={18} />}
          title="Maps"
          rows={analysis?.maps ?? []}
        />
      </div>
    </article>
  );
}

function RecentBattles({
  battles,
  noteDrafts,
  onNoteChange,
  onTagToggle,
  onSaveNote,
}: {
  battles: SavedBattle[];
  noteDrafts: Record<string, ManualNote>;
  onNoteChange: (battleId: string, note: string) => void;
  onTagToggle: (battleId: string, tag: string) => void;
  onSaveNote: (battle: SavedBattle) => void;
}) {
  return (
    <section className="panel battle-panel">
      <div className="section-heading">
        <BookOpenText size={20} />
        <h2>Recent battles</h2>
      </div>
      {battles.length === 0 ? (
        <EmptyState message="No saved battles yet. Fetch the official battle log to persist matches before they disappear from the API." />
      ) : (
        <div className="battle-list">
          {battles.slice(0, 12).map((battle) => {
            const draft = battle.id
              ? noteDrafts[battle.id] ?? { tags: [], note: "" }
              : { tags: [], note: "" };

            return (
              <article className="battle-row" key={battle.id ?? battle.battleTime}>
                <div className="battle-main">
                  <span className={`result-pill ${battle.result.toLowerCase()}`}>
                    {battle.result || "unknown"}
                  </span>
                  <div>
                    <strong>{battle.playerBrawlerName}</strong>
                    <p>
                      {battle.mode} on {battle.map} · {formatDate(battle.battleTime)}
                    </p>
                  </div>
                </div>
                <div className="battle-meta">
                  <span>Power {battle.playerPowerLevel ?? "?"}</span>
                  <span>{battle.trophyChange ? `${battle.trophyChange} trophies` : "No trophy delta"}</span>
                  <span>
                    Star player:{" "}
                    {battle.starPlayerTag ? battle.starPlayerTag : "not listed"}
                  </span>
                </div>
                {battle.id ? (
                  <div className="note-editor">
                    <div className="chip-row" aria-label="Manual tags">
                      {MANUAL_TAGS.map((tag) => (
                        <button
                          type="button"
                          className={
                            draft.tags.includes(tag) ? "tag-chip selected" : "tag-chip"
                          }
                          key={tag}
                          onClick={() => onTagToggle(battle.id!, tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <div className="note-actions">
                      <textarea
                        value={draft.note}
                        onChange={(event) =>
                          onNoteChange(battle.id!, event.target.value)
                        }
                        placeholder="Manual notes"
                      />
                      <button className="icon-button" onClick={() => onSaveNote(battle)}>
                        <Save size={18} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricList({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: { key: string; battles: number; winRate: number }[];
}) {
  return (
    <div className="rank-list">
      <div className="rank-title">
        {icon}
        <strong>{title}</strong>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No data yet.</p>
      ) : (
        rows.slice(0, 5).map((row) => (
          <div className="rank-row" key={row.key}>
            <span>{row.key}</span>
            <strong>{formatPercent(row.winRate)}</strong>
            <small>{row.battles} games</small>
          </div>
        ))
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="empty-state">{message}</p>;
}

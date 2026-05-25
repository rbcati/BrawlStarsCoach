import { BookOpenText, Save } from "lucide-react";
import { formatDate } from "../lib/format";
import type { ManualNote, SavedBattle } from "../lib/types";
import { EmptyState } from "./EmptyState";

const MANUAL_TAGS = [
  "bad draft",
  "carried",
  "countered",
  "felt controlled",
  "tilted",
  "teammates weak",
];

type RecentBattlesProps = {
  battles: SavedBattle[];
  noteDrafts: Record<string, ManualNote>;
  onNoteChange: (battleId: string, note: string) => void;
  onTagToggle: (battleId: string, tag: string) => void;
  onSaveNote: (battle: SavedBattle) => void;
};

export function RecentBattles({
  battles,
  noteDrafts,
  onNoteChange,
  onTagToggle,
  onSaveNote,
}: RecentBattlesProps) {
  return (
    <section className="panel battle-panel">
      <div className="section-heading">
        <BookOpenText size={20} />
        <h2>Recent battles</h2>
      </div>
      {battles.length === 0 ? (
        <EmptyState message="No saved battles yet. Fetch the official battle log to persist matches before they disappear from the API." />
      ) : (
        <div className="table-wrap">
          <table className="battle-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Mode</th>
                <th>Map</th>
                <th>Brawler</th>
                <th>Result</th>
                <th>Power</th>
                <th>Trophies</th>
                <th>Manual notes</th>
              </tr>
            </thead>
            <tbody>
              {battles.slice(0, 12).map((battle) => {
                const draft = battle.id
                  ? noteDrafts[battle.id] ?? { tags: [], note: "" }
                  : { tags: [], note: "" };

                return (
                  <tr key={battle.id ?? battle.battleTime}>
                    <td>{formatDate(battle.battleTime)}</td>
                    <td>{battle.mode}</td>
                    <td>{battle.map}</td>
                    <td>{battle.playerBrawlerName}</td>
                    <td>
                      <span className={`result-pill ${battle.result.toLowerCase()}`}>
                        {battle.result || "unknown"}
                      </span>
                    </td>
                    <td>{battle.playerPowerLevel ?? "?"}</td>
                    <td>
                      {battle.trophyChange
                        ? `${battle.trophyChange > 0 ? "+" : ""}${battle.trophyChange}`
                        : "none"}
                    </td>
                    <td>
                      {battle.id ? (
                        <div className="note-editor compact">
                          <div className="chip-row" aria-label="Manual tags">
                            {MANUAL_TAGS.map((tag) => (
                              <button
                                type="button"
                                className={
                                  draft.tags.includes(tag)
                                    ? "tag-chip selected"
                                    : "tag-chip"
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
                            <button
                              className="icon-button"
                              onClick={() => onSaveNote(battle)}
                            >
                              <Save size={18} />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        "Not saved"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

import { Trophy } from "lucide-react";
import { formatPercent } from "../lib/format";
import type { PlayerAnalysis } from "../lib/types";
import { Metric } from "./Metric";

type OverviewProps = {
  analysis: PlayerAnalysis | null;
};

export function Overview({ analysis }: OverviewProps) {
  const player = analysis?.player;
  const totals = analysis?.totals;

  return (
    <article className="panel overview-panel">
      <div className="section-heading">
        <Trophy size={20} />
        <h2>Player overview</h2>
      </div>
      <div className="player-name">{player?.name ?? "No player loaded"}</div>
      <p className="muted">
        {player?.tag ?? "Sync a tag to build a saved battle history."}
      </p>
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

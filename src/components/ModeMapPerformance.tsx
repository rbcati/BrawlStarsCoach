import { Activity, BarChart3, ShieldCheck } from "lucide-react";
import type { PlayerAnalysis } from "../lib/types";
import { MetricList } from "./MetricList";

type ModeMapPerformanceProps = {
  analysis: PlayerAnalysis | null;
};

export function ModeMapPerformance({ analysis }: ModeMapPerformanceProps) {
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

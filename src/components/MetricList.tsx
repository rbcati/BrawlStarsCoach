import type { ReactNode } from "react";
import { formatPercent } from "../lib/format";

type MetricListProps = {
  icon: ReactNode;
  title: string;
  rows: { key: string; battles: number; winRate: number }[];
};

export function MetricList({ icon, title, rows }: MetricListProps) {
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

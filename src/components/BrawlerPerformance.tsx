import { Target } from "lucide-react";
import { formatPercent } from "../lib/format";
import type { BrawlerMetric } from "../lib/types";
import { EmptyState } from "./EmptyState";

type BrawlerPerformanceProps = {
  brawlers: BrawlerMetric[];
};

export function BrawlerPerformance({ brawlers }: BrawlerPerformanceProps) {
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
                <th>Archetype</th>
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
                  <td>{item.archetype}</td>
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

import { Sparkles } from "lucide-react";
import type { UpgradeRecommendation } from "../lib/types";
import { EmptyState } from "./EmptyState";

type UpgradeRecommendationsProps = {
  recommendations: UpgradeRecommendation[];
};

export function UpgradeRecommendations({
  recommendations,
}: UpgradeRecommendationsProps) {
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

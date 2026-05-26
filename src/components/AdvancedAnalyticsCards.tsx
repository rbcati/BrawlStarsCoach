import {
  AlertTriangle,
  Crosshair,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { calculateAdvancedAnalytics } from "../lib/analysis";
import { formatPercent } from "../lib/format";
import type { PlayerAnalysis } from "../lib/types";
import { EmptyState } from "./EmptyState";

type AdvancedAnalyticsCardsProps = {
  analysis: PlayerAnalysis | null;
};

export function AdvancedAnalyticsCards({ analysis }: AdvancedAnalyticsCardsProps) {
  const advanced = useMemo(() => {
    if (!analysis) return null;
    return analysis.advanced ?? calculateAdvancedAnalytics(analysis.battles, analysis.brawlers);
  }, [analysis]);

  if (!analysis || !advanced) {
    return (
      <section className="advanced-grid" aria-label="Advanced analytics">
        <article className="panel advanced-card wide">
          <div className="section-heading">
            <Sparkles size={20} />
            <h2>Advanced matchup analytics</h2>
          </div>
          <EmptyState message="Sync battles to unlock matchup, teammate, map, and trend cards." />
        </article>
      </section>
    );
  }

  const bestFit = advanced.bestCurrentBrawlerFit;
  const trend = advanced.recentTrendSummary;

  return (
    <section className="advanced-grid" aria-label="Advanced analytics">
      <article className="panel advanced-card">
        <div className="section-heading">
          <Sparkles size={20} />
          <h2>Best Current Brawler Fit</h2>
        </div>
        {bestFit ? (
          <div className="insight-stack">
            <div>
              <strong className="insight-title">{bestFit.brawlerName}</strong>
              <p className="muted">
                Score {Math.round(bestFit.score)} · {bestFit.confidence} confidence
              </p>
            </div>
            <ul className="plain-list">
              {bestFit.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState message="No brawler fit can be ranked yet." />
        )}
      </article>

      <article className="panel advanced-card">
        <div className="section-heading">
          <ShieldAlert size={20} />
          <h2>Worst Enemy Matchups</h2>
        </div>
        <InsightRows
          empty="Enemy appearance matchup trends appear after more saved team battles."
          rows={advanced.worstEnemyMatchups.map((item) => ({
            key: `${item.userBrawlerName}-${item.enemyBrawlerName}`,
            title: `${item.userBrawlerName} into ${item.enemyBrawlerName}`,
            meta: `${formatPercent(item.winRate)} win · ${item.matches} matches · ${item.confidence}`,
            detail: `${item.label}; inferred from enemy team appearances.`,
          }))}
        />
      </article>

      <article className="panel advanced-card">
        <div className="section-heading">
          <Users size={20} />
          <h2>Best Teammate Pairings</h2>
        </div>
        <InsightRows
          empty="Teammate brawler synergy appears after repeated teammate pairings."
          rows={advanced.bestTeammatePairings.map((item) => ({
            key: `${item.userBrawlerName}-${item.teammateBrawlerName}`,
            title: `${item.userBrawlerName} + ${item.teammateBrawlerName}`,
            meta: `${formatPercent(item.winRate)} win · ${item.matches} matches · ${item.confidence}`,
            detail: "Inferred teammate brawler appearance synergy.",
          }))}
        />
      </article>

      <article className="panel advanced-card">
        <div className="section-heading">
          <Crosshair size={20} />
          <h2>Map/Mode Warnings</h2>
        </div>
        <InsightRows
          empty="No repeated map/mode weakness has enough saved evidence yet."
          rows={advanced.mapModeWarnings.map((item) => ({
            key: `${item.mode}-${item.map}-${item.brawlerName}`,
            title: `${item.brawlerName} on ${item.map}`,
            meta: `${item.mode} · ${formatPercent(item.winRate)} win · ${item.confidence}`,
            detail: item.warning,
          }))}
        />
      </article>

      <article className="panel advanced-card">
        <div className="section-heading">
          <TrendingUp size={20} />
          <h2>Recent Trend Summary</h2>
        </div>
        <div className="insight-stack">
          <strong className="insight-title">{formatPercent(trend.winRate)}</strong>
          <p className="muted">
            Latest {trend.matches} saved matches · {trend.confidence} confidence
          </p>
          <p>{trend.label}</p>
          {trend.delta !== null ? (
            <p className="muted">
              Previous comparison: {formatPercent(trend.previousWinRate ?? 0)} (
              {trend.delta > 0 ? "+" : ""}
              {Math.round(trend.delta * 100)} pts).
            </p>
          ) : null}
        </div>
      </article>

      <article className="panel advanced-card">
        <div className="section-heading">
          <AlertTriangle size={20} />
          <h2>Low Sample Size Warning</h2>
        </div>
        <InsightRows
          empty="No low-sample warning is active."
          rows={advanced.lowSampleSizeWarnings.map((item) => ({
            key: `${item.metric}-${item.matches}`,
            title: item.metric,
            meta: `${item.matches} saved sample${item.matches === 1 ? "" : "s"}`,
            detail: item.message,
          }))}
        />
      </article>

      <article className="panel advanced-card wide">
        <div className="section-heading">
          <AlertTriangle size={20} />
          <h2>Analytics Limitations</h2>
        </div>
        <ul className="plain-list limitations-list">
          {advanced.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}

type InsightRowsProps = {
  empty: string;
  rows: Array<{
    key: string;
    title: string;
    meta: string;
    detail: string;
  }>;
};

function InsightRows({ empty, rows }: InsightRowsProps) {
  if (!rows.length) return <EmptyState message={empty} />;

  return (
    <div className="insight-list">
      {rows.slice(0, 4).map((row) => (
        <div className="insight-row" key={row.key}>
          <strong>{row.title}</strong>
          <span>{row.meta}</span>
          <p>{row.detail}</p>
        </div>
      ))}
    </div>
  );
}

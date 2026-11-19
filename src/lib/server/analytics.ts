import "server-only";
import type { DB } from "./models";

export interface Metrics {
  views: number;
  retention3s: number | null;
  avgWatchSec: number | null;
  completionRate: number | null;
  rewatches: number;
  shares: number;
  returningViewers: number;
  durationSec: number | null;
}

/**
 * Retention metrics from plays inside In My World's own players (share page,
 * Explore, embeds). Creators' plays of their own videos are excluded.
 * Plays on TikTok/Reels/Shorts aren't visible to us.
 */
export function metricsFor(db: DB, targetId: string, ownerId: string | null, durationSec: number | null): Metrics {
  const stats = (db.viewerStats ?? []).filter((s) => s.targetId === targetId);
  const n = stats.length;
  const project = db.projects.find((p) => p.id === targetId);
  // Viewers who also watched another video by the same creator.
  const ownerTargets = ownerId ? new Set(db.projects.filter((p) => p.userId === ownerId && p.id !== targetId).map((p) => p.id)) : new Set<string>();
  const returning = stats.filter((s) => (db.viewerStats ?? []).some((o) => o.viewer === s.viewer && ownerTargets.has(o.targetId))).length;
  return {
    views: n,
    retention3s: n ? stats.filter((s) => s.reached3s).length / n : null,
    // Per play, so it compares directly with the video length.
    avgWatchSec: n ? stats.reduce((a, s) => a + s.watched, 0) / Math.max(1, stats.reduce((a, s) => a + s.plays, 0)) : null,
    completionRate: n ? stats.filter((s) => s.completed).length / n : null,
    rewatches: stats.reduce((a, s) => a + Math.max(0, s.plays - 1), 0),
    shares: project?.shares ?? 0,
    returningViewers: returning,
    durationSec,
  };
}

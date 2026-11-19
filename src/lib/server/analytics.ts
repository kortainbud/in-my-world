import "server-only";
import { findDocs, findIds, getDoc } from "./data";
import type { Project, ViewerStat } from "./models";

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
export async function metricsFor(targetId: string, ownerId: string | null, durationSec: number | null): Promise<Metrics> {
  const [stats, project] = await Promise.all([
    findDocs<ViewerStat>("viewer_stats", (q) => q.eq("target_id", targetId)),
    getDoc<Project>("projects", targetId),
  ]);
  const n = stats.length;
  // Viewers who also watched another video by the same creator.
  let returning = 0;
  if (ownerId && n) {
    const others = await findIds("projects", (q) => q.eq("user_id", ownerId).neq("id", targetId));
    if (others.length) {
      const viewers = [...new Set(stats.map((s) => s.viewer))];
      const seen = await findDocs<ViewerStat>("viewer_stats", (q) => q.in("viewer", viewers).in("target_id", others));
      const rv = new Set(seen.map((s) => s.viewer));
      returning = stats.filter((s) => rv.has(s.viewer)).length;
    }
  }
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

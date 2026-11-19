import "server-only";
import { mediaUrl } from "./media";
import type { DB } from "./models";
import { SAMPLES } from "./views";

export interface ExploreItem {
  id: string;
  title: string;
  prompt: string;
  style: "roblox" | "minecraft";
  category: string;
  durationSec: number;
  video: string;
  thumb: string;
  views: number;
  createdAt: string;
  isSample: boolean;
  owner: { handle: string; displayName: string };
}

/** Public, completed videos plus clearly-labelled sample videos. */
export function exploreItems(db: DB): ExploreItem[] {
  const pub: ExploreItem[] = db.projects
    .filter((p) => p.visibility === "public" && p.status === "completed" && p.videoId)
    .map((p) => {
      const v = db.videos.find((x) => x.id === p.videoId)!;
      const prof = db.profiles.find((x) => x.userId === p.userId);
      return {
        id: p.id, title: p.title, prompt: p.prompt, style: p.style, category: p.category, durationSec: v.durationSec,
        video: mediaUrl(v.mediaKey), thumb: mediaUrl(v.thumbKey), views: p.views, createdAt: p.createdAt, isSample: false,
        owner: { handle: prof?.handle ?? "unknown", displayName: prof?.displayName ?? "Unknown" },
      };
    });
  const samples: ExploreItem[] = SAMPLES.map((s) => ({
    id: s.id, title: s.title, prompt: s.prompt, style: s.style, category: s.category, durationSec: s.durationSec, video: s.video, thumb: s.thumb,
    views: db.sampleViews[s.id] ?? 0, createdAt: s.createdAt, isSample: true, owner: { handle: "samples", displayName: "In My World samples" },
  }));
  return [...pub, ...samples];
}

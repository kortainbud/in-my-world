import "server-only";
import { findDocs, getMany } from "./data";
import { mediaUrl } from "./media";
import type { Profile, Project, Video } from "./models";
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
export async function exploreItems(): Promise<ExploreItem[]> {
  const projects = (await findDocs<Project>("projects", (q) => q.eq("visibility", "public").eq("status", "completed").order("ts", { ascending: false }).limit(300))).filter((p) => p.videoId);
  const [videos, profiles, sampleViews] = await Promise.all([
    getMany<Video>("videos", projects.map((p) => p.videoId!)),
    getMany<Profile>("profiles", projects.map((p) => p.userId)),
    getMany<{ n: number }>("sample_views", SAMPLES.map((s) => `views:${s.id}`)),
  ]);
  const pub: ExploreItem[] = projects.flatMap((p) => {
    const v = videos.get(p.videoId!);
    if (!v) return [];
    const prof = profiles.get(p.userId);
    return [{
      id: p.id, title: p.title, prompt: p.prompt, style: p.style, category: p.category, durationSec: v.durationSec,
      video: mediaUrl(v.mediaKey), thumb: mediaUrl(v.thumbKey), views: p.views, createdAt: p.createdAt, isSample: false,
      owner: { handle: prof?.handle ?? "unknown", displayName: prof?.displayName ?? "Unknown" },
    }];
  });
  const samples: ExploreItem[] = SAMPLES.map((s) => ({
    id: s.id, title: s.title, prompt: s.prompt, style: s.style, category: s.category, durationSec: s.durationSec, video: s.video, thumb: s.thumb,
    views: sampleViews.get(`views:${s.id}`)?.n ?? 0, createdAt: s.createdAt, isSample: true, owner: { handle: "samples", displayName: "In My World samples" },
  }));
  return [...pub, ...samples];
}

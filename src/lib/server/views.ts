import "server-only";
import samples from "@/data/samples.json";
import { STAGES, type ChecklistItem, type StageState, type StoryFormat, type StorySheet } from "@/lib/engine/types";
import { metricsFor, type Metrics } from "./analytics";
import { mediaUrl } from "./media";
import type { DB, Project } from "./models";
import { SAMPLE_USER_ID } from "./pipeline";

export interface SampleEntry {
  id: string;
  title: string;
  prompt: string;
  style: "roblox" | "minecraft";
  category: string;
  durationSec: number;
  width?: number;
  height?: number;
  video: string;
  thumb: string;
  createdAt: string;
  format?: string;
  story?: { source?: string; sheet?: import("@/lib/engine/types").StorySheet; scenes: { narration: string; description: string; environment: string }[]; cast: { id: string; name: string; appearance: import("@/lib/engine/types").Appearance }[] };
  previews?: string[];
}

export const SAMPLES = samples as SampleEntry[];

export interface ProjectView {
  id: string;
  title: string;
  prompt: string;
  style: Project["style"];
  durationPreset: number;
  category: string;
  status: Project["status"];
  visibility: Project["visibility"];
  createdAt: string;
  updatedAt: string;
  views: number;
  isSample: boolean;
  format: StoryFormat;
  episode: number;
  series: { id: string; episodes: { id: string; episode: number; title: string; status: string }[] } | null;
  owner: { handle: string; displayName: string };
  video: { url: string; thumb: string; durationSec: number; width: number; height: number; sizeBytes: number } | null;
  thumb: string | null;
  job?: {
    id: string;
    stages: (StageState & { label: string })[];
    attempts: number;
    maxAttempts: number;
    error?: string;
    creditCost: number;
    refunded: boolean;
    engine: { story: string; voice: string; render: string };
    renderProgress?: { phase: string; framesDone: number; framesTotal: number; updatedAt: string };
    previews: { scene: number; url: string }[];
    exportHeight: number;
    watermark: boolean;
  };
  story?: {
    source: string;
    model?: string;
    premise: string;
    scenes: { narration: string; description: string; environment: string }[];
    cast: { id: string; name: string; generated: boolean }[];
    sheet?: StorySheet;
    checklist?: ChecklistItem[];
    checklistSource?: string;
    revised?: boolean;
  };
  metrics?: Metrics;
}

export function projectView(db: DB, p: Project, opts: { withJob?: boolean } = {}): ProjectView {
  const video = p.videoId ? db.videos.find((v) => v.id === p.videoId) : undefined;
  const prof = db.profiles.find((x) => x.userId === p.userId);
  const job = opts.withJob ? db.jobs.find((j) => j.id === p.jobId) : undefined;
  const story = opts.withJob ? db.stories.find((s) => s.projectId === p.id) : undefined;
  const lastPreview = job?.previews.at(-1);
  return {
    id: p.id,
    title: p.title,
    prompt: p.prompt,
    style: p.style,
    durationPreset: p.durationPreset,
    category: p.category,
    status: p.status,
    visibility: p.visibility,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    views: p.views,
    isSample: p.userId === SAMPLE_USER_ID,
    format: p.format ?? "strange_world",
    episode: p.episode ?? 1,
    series: p.seriesId
      ? {
          id: p.seriesId,
          episodes: db.projects
            .filter((x) => x.seriesId === p.seriesId && (opts.withJob || (x.visibility === "public" && x.status === "completed")))
            .sort((a, b) => (a.episode ?? 1) - (b.episode ?? 1))
            .map((x) => ({ id: x.id, episode: x.episode ?? 1, title: x.title, status: x.status })),
        }
      : null,
    owner: { handle: prof?.handle ?? "unknown", displayName: prof?.displayName ?? "Unknown" },
    video: video ? { url: mediaUrl(video.mediaKey), thumb: mediaUrl(video.thumbKey), durationSec: video.durationSec, width: video.width, height: video.height, sizeBytes: video.sizeBytes } : null,
    thumb: video ? mediaUrl(video.thumbKey) : lastPreview ? mediaUrl(lastPreview.mediaKey) : null,
    job: job
      ? {
          id: job.id,
          stages: job.stages.map((s) => ({ ...s, label: STAGES.find((x) => x.key === s.key)!.label })),
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          error: job.error,
          creditCost: job.creditCost,
          refunded: job.refunded,
          engine: job.engine,
          renderProgress: job.renderProgress,
          previews: job.previews.map((x) => ({ scene: x.scene, url: mediaUrl(x.mediaKey) })),
          exportHeight: job.exportHeight,
          watermark: job.watermark,
        }
      : undefined,
    story: story
      ? {
          source: story.source,
          model: story.model,
          premise: story.plan.premise,
          scenes: story.plan.scenes.map((s) => ({ narration: s.narration, description: s.description, environment: s.environment })),
          cast: (story.cast ?? []).map((c) => ({ id: c.id, name: c.name, generated: !!story.generatedCharacterIds?.includes(c.id) })),
          sheet: story.plan.sheet,
          checklist: story.checklist,
          checklistSource: story.checklistSource,
          revised: story.revised,
        }
      : undefined,
    metrics: opts.withJob ? metricsFor(db, p.id, p.userId, video?.durationSec ?? null) : undefined,
  };
}

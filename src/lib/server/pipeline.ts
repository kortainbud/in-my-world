import "server-only";
import { estimateCredits, getPlan } from "@/config/plans";
import type { Category } from "@/config/site";
import { canCast, OFFICIAL_CHARACTERS, type CharacterRecord } from "@/lib/engine/characters";
import { compileTimeline, type SceneAudio } from "@/lib/engine/compile";
import { detectThemes } from "@/lib/engine/devStory";
import {
  DURATIONS, FORMATS, STAGES, VISUAL_STYLES,
  type CharacterSpec, type DurationPreset, type StageKey, type StageState, type StoryFormat, type VisualStyle,
} from "@/lib/engine/types";
import { HttpError } from "./auth";
import { MODE, PROVIDERS, providerSummary } from "./config";
import { balanceOf, rollPeriods } from "./credits";
import { id, now, read, tx } from "./db";
import { deleteMedia, mediaUrl, writeMedia } from "./media";
import type { DB, GenerationJob, Project, Story, User } from "./models";
import { generateStory, ProviderError } from "./providers/story";
import { defaultNarrator, narratorVoices, synthesize } from "./providers/voice";

export const SAMPLE_USER_ID = "usr_samples";
const MAX_ATTEMPTS = 3;
const LEASE_MS = 45_000;

/* ---------------- Character library ---------------- */

export function libraryFor(db: DB, userId: string | null): CharacterRecord[] {
  const own = userId ? db.characters.filter((c) => c.ownerId === userId) : [];
  const community = db.characters.filter((c) => c.visibility === "public" && c.ownerId !== userId);
  return [...OFFICIAL_CHARACTERS, ...own, ...community].map((c) => {
    // A use = a story whose resolved cast includes this character (explicit or auto-cast).
    const uses = db.stories.filter((s) => s.cast?.some((x) => x.id === c.id)).length;
    return { ...c, uses: c.uses + uses };
  });
}

function planFor(db: DB, userId: string) {
  return getPlan(db.subscriptions.find((s) => s.userId === userId)?.planId);
}

function categoryFor(prompt: string): Category {
  const t = detectThemes(prompt)[0];
  const map: Record<string, Category> = { money: "Money", grow: "Wholesome", kind: "Wholesome", numbers: "Mystery", discover: "Mystery", silence: "Mystery", dream: "Strange", truth: "Funny", jump: "Funny", generic: "Strange" };
  return map[t] ?? "Strange";
}

/* ---------------- Create ---------------- */

export interface CreateInput {
  prompt: string;
  style: VisualStyle;
  duration: DurationPreset;
  castIds: string[];
  voice: string | null;
  idempotencyKey?: string;
  parentProjectId?: string;
  /** Internal only (sample seeding): force an export size regardless of plan. */
  exportOverride?: 720 | 1080;
  format: StoryFormat;
  /** Continue a series from this (completed) project. */
  previousProjectId?: string;
}

export function validateInput(raw: unknown): CreateInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const prompt = typeof b.prompt === "string" ? b.prompt.trim().replace(/\s+/g, " ") : "";
  if (prompt.length < 8) throw new HttpError(400, "Describe your world in at least a few words.", "prompt_too_short");
  if (prompt.length > 600) throw new HttpError(400, "Keep your idea under 600 characters.", "prompt_too_long");
  if (/^(in my world|imagine if|nobody knows that|what if everyone|one day, i woke up|pov: you discover)\.{3}$/i.test(prompt))
    throw new HttpError(400, "Finish the sentence — what happens in your world?", "prompt_incomplete");
  const style = b.style as VisualStyle;
  if (!VISUAL_STYLES.includes(style)) throw new HttpError(400, "Choose a visual style.", "bad_style");
  const duration = Number(b.duration) as DurationPreset;
  if (!DURATIONS.includes(duration)) throw new HttpError(400, "Choose a video length.", "bad_duration");
  const castIds = Array.isArray(b.castIds) ? b.castIds.filter((x): x is string => typeof x === "string").slice(0, 3) : [];
  const voices = narratorVoices().map((v) => v.id);
  const voice = typeof b.voice === "string" && voices.includes(b.voice) ? b.voice : defaultNarrator();
  const idempotencyKey = typeof b.idempotencyKey === "string" ? b.idempotencyKey.slice(0, 80) : undefined;
  const parentProjectId = typeof b.parentProjectId === "string" ? b.parentProjectId : undefined;
  const format = (FORMATS as readonly string[]).includes(String(b.format)) ? (b.format as StoryFormat) : "strange_world";
  const previousProjectId = typeof b.previousProjectId === "string" ? b.previousProjectId : undefined;
  return { prompt, style, duration, castIds, voice, idempotencyKey, parentProjectId, format, previousProjectId };
}

export function quote(db: DB, userId: string, input: Pick<CreateInput, "duration" | "style">) {
  const plan = planFor(db, userId);
  const cost = estimateCredits({ duration: input.duration, style: input.style, narration: PROVIDERS.voice !== "none", exportHeight: plan.exportHeight });
  return { plan, cost, balance: balanceOf(db, userId) };
}

function freshStages(): StageState[] {
  return STAGES.map((s) => ({ key: s.key, status: "pending" }));
}

export async function createGeneration(user: User, input: CreateInput) {
  if (!PROVIDERS.story) throw new HttpError(503, "Video generation isn't available: no story provider is configured.", "provider_unavailable");
  const result = await tx((db) => {
    if (input.idempotencyKey) {
      const dup = db.jobs.find((j) => j.userId === user.id && j.idempotencyKey === input.idempotencyKey);
      if (dup) return { project: db.projects.find((p) => p.id === dup.projectId)!, job: dup, duplicate: true };
    }
    rollPeriods(db, user.id);
    const { plan, cost, balance } = quote(db, user.id, input);
    if (input.duration > plan.maxDurationSec)
      throw new HttpError(403, `${input.duration}-second videos need a plan that allows them. Your ${plan.name} plan goes up to ${plan.maxDurationSec}s.`, "duration_not_in_plan");
    if (balance < cost.total) throw new HttpError(402, `This video costs ${cost.total} credits and you have ${balance}.`, "insufficient_credits");

    const lib = libraryFor(db, user.id);
    const planId = plan.id;
    for (const cid of input.castIds) {
      const c = lib.find((x) => x.id === cid);
      if (!c) throw new HttpError(400, "One of the selected characters no longer exists.", "bad_cast");
      const ok = canCast(c, { id: user.id, planId });
      if (!ok.ok) throw new HttpError(403, `${c.name}: ${ok.reason}`, "cast_not_allowed");
    }

    let series: { seriesId: string; episode: number } | undefined;
    if (input.previousProjectId) {
      const prev = db.projects.find((x) => x.id === input.previousProjectId && x.userId === user.id);
      if (!prev || !db.stories.some((x) => x.projectId === prev.id)) throw new HttpError(400, "The previous episode couldn't be found.", "bad_previous");
      prev.seriesId ??= prev.id;
      prev.episode ??= 1;
      series = { seriesId: prev.seriesId, episode: prev.episode + 1 };
    }

    const projectId = id("prj");
    const jobId = id("job");
    const t = now();
    const height = input.exportOverride ?? plan.exportHeight;
    const summary = providerSummary();
    const job: GenerationJob = {
      id: jobId, projectId, userId: user.id, status: "queued", stages: freshStages(), attempts: 1, maxAttempts: MAX_ATTEMPTS,
      creditCost: cost.total, idempotencyKey: input.idempotencyKey, exportHeight: height, watermark: plan.watermark,
      engine: { story: summary.story.label, voice: summary.voice.label, render: summary.render.label },
      previews: [], refunded: false, createdAt: t, updatedAt: t,
    };
    const project: Project = {
      id: projectId, userId: user.id, title: "Untitled world", prompt: input.prompt, style: input.style, durationPreset: input.duration,
      aspect: "9:16", mode: "auto", voice: input.voice, castIds: input.castIds, category: categoryFor(input.prompt), visibility: "private",
      status: "queued", jobId, parentProjectId: input.parentProjectId, views: 0, createdAt: t, updatedAt: t,
      format: input.format, previousProjectId: input.previousProjectId, seriesId: series?.seriesId, episode: series?.episode,
    };
    db.jobs.push(job);
    db.projects.push(project);
    db.credits.push({ id: id("ctx"), userId: user.id, amount: -cost.total, kind: "debit_generation", jobId, note: `Video: ${input.duration}s ${input.style}`, createdAt: t });
    return { project, job, duplicate: false };
  });
  if (!result.duplicate) kick(result.job.id);
  return result;
}

/* ---------------- Worker ---------------- */

type W = { __imwRunning?: Set<string>; __imwResumed?: boolean };
const w = globalThis as W;
w.__imwRunning ??= new Set();

function kick(jobId: string, delayMs = 0) {
  setTimeout(() => void runJob(jobId), delayMs);
}

/** Resume jobs interrupted by a server restart. */
export async function resumePending() {
  if (w.__imwResumed) return;
  w.__imwResumed = true;
  const ids = await read((db) => db.jobs.filter((j) => j.status === "queued" || j.status === "processing").map((j) => j.id));
  ids.forEach((i) => kick(i));
}

async function setStage(jobId: string, key: StageKey, patch: Partial<StageState>) {
  await tx((db) => {
    const j = db.jobs.find((x) => x.id === jobId);
    if (!j) return;
    const s = j.stages.find((x) => x.key === key)!;
    Object.assign(s, patch);
    j.updatedAt = now();
  });
}

function sceneAudioKey(jobId: string, scene: number, kind: "n" | "d") {
  return `audio/${jobId}_${scene}_${kind}.wav`;
}

async function runJob(jobId: string) {
  if (w.__imwRunning!.has(jobId)) return;
  w.__imwRunning!.add(jobId);
  try {
    const ctx = await tx((db) => {
      const j = db.jobs.find((x) => x.id === jobId);
      if (!j || !["queued", "processing"].includes(j.status)) return null;
      j.status = "processing";
      const p = db.projects.find((x) => x.id === j.projectId)!;
      p.status = "processing";
      p.updatedAt = now();
      const previous = p.previousProjectId ? db.stories.find((s) => s.projectId === p.previousProjectId)?.plan : undefined;
      return { job: structuredClone(j), project: structuredClone(p), library: libraryFor(db, j.userId), planId: planFor(db, j.userId).id, story: structuredClone(db.stories.find((s) => s.projectId === p.id)), previous: structuredClone(previous) };
    });
    if (!ctx) return;
    const { job, project, library } = ctx;
    let story = ctx.story;
    const stageDone = (k: StageKey) => job.stages.find((s) => s.key === k)?.status === "done" || job.stages.find((s) => s.key === k)?.status === "skipped";
    let current: StageKey = "story";

    try {
      /* 1. Story */
      if (!stageDone("story") || !story) {
        current = "story";
        await setStage(jobId, "story", { status: "running", startedAt: now(), detail: job.engine.story });
        const cast = project.castIds.map((cid) => library.find((c) => c.id === cid)).filter(Boolean) as CharacterRecord[];
        const res = await generateStory({
          prompt: project.prompt, duration: project.durationPreset, style: project.style, format: project.format ?? "strange_world", previous: ctx.previous,
          cast, library: library.filter((c) => canCast(c, { id: project.userId, planId: ctx.planId }).ok || project.castIds.includes(c.id)), seed: jobId,
        });
        const s: Story = { id: id("sty"), projectId: project.id, source: res.source, model: res.model, plan: res.plan, checklist: res.checklist, checklistSource: res.checklistSource, revised: res.revised, createdAt: now() };
        await tx((db) => {
          db.stories = db.stories.filter((x) => x.projectId !== project.id);
          db.stories.push(s);
          const p = db.projects.find((x) => x.id === project.id)!;
          p.storyId = s.id;
          p.title = res.plan.title;
        });
        story = s;
        const passed = res.checklist.filter((c) => c.pass === true).length;
        const twist = res.plan.sheet?.twistType ? ` · ${res.plan.sheet.twistType.replace(/_/g, " ")} twist` : "";
        await setStage(jobId, "story", {
          status: "done", endedAt: now(),
          detail: `${res.plan.scenes.length} scenes${twist} · ${res.source === "anthropic" ? `written by ${res.model}${res.revised ? ", revised after editor review" : ""}` : "template engine (dev mode, not AI)"} · checklist ${passed}/${res.checklist.length}`,
        });
      }
      const plan = story.plan;

      /* 2. Characters */
      current = "characters";
      await setStage(jobId, "characters", { status: "running", startedAt: now() });
      const specs: CharacterSpec[] = [];
      const refs: Record<string, string> = {};
      const generated: string[] = [];
      let reused = 0;
      for (const c of plan.cast) {
        const rec = c.characterId ? library.find((x) => x.id === c.characterId) : undefined;
        if (rec) {
          specs.push({ id: rec.id, name: c.name || rec.name, appearance: rec.appearance, voice: rec.voice });
          refs[c.ref] = rec.id;
          reused++;
        } else if (c.appearance) {
          const gid = `gen_${jobId}_${c.ref}`;
          specs.push({ id: gid, name: c.name, appearance: c.appearance });
          refs[c.ref] = gid;
          generated.push(gid);
        }
      }
      await tx((db) => {
        const s = db.stories.find((x) => x.id === story!.id)!;
        s.cast = specs;
        s.refs = refs;
        s.generatedCharacterIds = generated;
      });
      await setStage(jobId, "characters", { status: "done", endedAt: now(), detail: `${specs.length} characters · ${reused} from the library${generated.length ? ` · ${generated.length} newly designed` : ""}` });

      /* 3. World */
      current = "world";
      await setStage(jobId, "world", { status: "running", startedAt: now() });
      const envs = [...new Set(plan.scenes.map((s) => s.environment.replace(/_/g, " ")))];
      const props = new Set(plan.scenes.flatMap((s) => s.props)).size;
      await setStage(jobId, "world", { status: "done", endedAt: now(), detail: `${envs.length} environment${envs.length === 1 ? "" : "s"} (${envs.join(", ")}) · ${props} prop type${props === 1 ? "" : "s"} · ${project.style} style` });

      /* 4. Animation */
      current = "animation";
      await setStage(jobId, "animation", { status: "running", startedAt: now() });
      const actions = plan.scenes.reduce((a, s) => a + s.characters.length, 0);
      const cams = new Set(plan.scenes.map((s) => s.camera)).size;
      await setStage(jobId, "animation", { status: "done", endedAt: now(), detail: `${plan.scenes.length} scenes · ${actions} character performances · ${cams} camera moves` });

      /* 5. Narration */
      current = "narration";
      const audio: SceneAudio[] = [];
      const stored: NonNullable<GenerationJob["audio"]> = [];
      if (PROVIDERS.voice === "none" || !project.voice) {
        await setStage(jobId, "narration", { status: "skipped", startedAt: now(), endedAt: now(), detail: "No narration provider configured — captions only" });
      } else {
        await setStage(jobId, "narration", { status: "running", startedAt: now(), detail: `Voice: ${project.voice}` });
        for (let i = 0; i < plan.scenes.length; i++) {
          const sc = plan.scenes[i];
          const n = await synthesize(sc.narration, project.voice, sceneAudioKey(jobId, i, "n"), sc.delivery);
          const entry: (typeof stored)[number] = { scene: i, narration: n };
          const a: SceneAudio = { narration: { url: mediaUrl(n.mediaKey), duration: n.duration } };
          if (sc.dialogue) {
            const speaker = specs.find((s) => s.id === refs[sc.dialogue!.ref]);
            const d = await synthesize(sc.dialogue.line, speaker?.voice ?? "Fred", sceneAudioKey(jobId, i, "d"));
            entry.dialogue = d;
            a.dialogue = { url: mediaUrl(d.mediaKey), duration: d.duration };
          }
          stored.push(entry);
          audio.push(a);
          await setStage(jobId, "narration", { detail: `Voice: ${project.voice} · ${i + 1} of ${plan.scenes.length} scenes recorded` });
        }
        const total = stored.reduce((x, s) => x + (s.narration?.duration ?? 0) + (s.dialogue?.duration ?? 0), 0);
        await setStage(jobId, "narration", { status: "done", endedAt: now(), detail: `Voice: ${project.voice} · ${stored.length} clips · ${total.toFixed(1)}s of speech` });
      }

      /* 6. Editing */
      current = "editing";
      await setStage(jobId, "editing", { status: "running", startedAt: now() });
      // "720p" / "1080p" refers to the short side of the vertical frame: 720×1280 or 1080×1920.
      const width = job.exportHeight;
      const timeline = compileTimeline({
        plan, style: project.style, cast: specs, refs, audio, width, height: Math.round((width * 16) / 9), watermark: job.watermark, targetDuration: project.durationPreset,
      });
      await tx((db) => {
        db.stories.find((x) => x.id === story!.id)!.timeline = timeline;
        const j = db.jobs.find((x) => x.id === jobId)!;
        j.audio = stored;
      });
      await setStage(jobId, "editing", {
        status: "done", endedAt: now(),
        detail: `${timeline.duration.toFixed(1)}s cut · ${timeline.captions.length} caption cards · ${timeline.sfx.length} sound cues · ${timeline.musicMood} score`,
      });

      /* 7. Hand off to the renderer */
      await tx((db) => {
        const j = db.jobs.find((x) => x.id === jobId)!;
        j.status = "awaiting_render";
        j.stages.find((s) => s.key === "render")!.detail = "Waiting for a renderer";
        const p = db.projects.find((x) => x.id === j.projectId)!;
        p.status = "awaiting_render";
        p.updatedAt = now();
      });
    } catch (e) {
      const retryable = e instanceof ProviderError ? e.retryable : false;
      const msg = e instanceof ProviderError ? e.message : "Something went wrong while preparing your video.";
      if (!(e instanceof ProviderError)) console.error("[pipeline]", e);
      await failOrRetry(jobId, current, msg, retryable);
    }
  } finally {
    w.__imwRunning!.delete(jobId);
  }
}

/** Retries a retryable failure, otherwise fails the job and refunds its credits. */
async function failOrRetry(jobId: string, stage: StageKey, message: string, retryable: boolean) {
  const retry = await tx((db) => {
    const j = db.jobs.find((x) => x.id === jobId);
    if (!j) return false;
    const p = db.projects.find((x) => x.id === j.projectId)!;
    const s = j.stages.find((x) => x.key === stage)!;
    if (retryable && j.attempts < j.maxAttempts) {
      j.attempts++;
      s.status = "pending";
      s.detail = `Retrying (attempt ${j.attempts} of ${j.maxAttempts}): ${message}`;
      j.status = stage === "render" ? "awaiting_render" : "queued";
      p.status = j.status;
      j.renderLease = undefined;
      j.updatedAt = now();
      return stage !== "render";
    }
    s.status = "failed";
    s.endedAt = now();
    s.detail = message;
    j.status = "failed";
    j.error = message;
    j.renderLease = undefined;
    j.updatedAt = now();
    p.status = "failed";
    p.updatedAt = now();
    refund(db, j);
    return false;
  });
  if (retry) kick(jobId, 2000);
}

function refund(db: DB, j: GenerationJob) {
  if (j.refunded) return;
  j.refunded = true;
  db.credits.push({ id: id("ctx"), userId: j.userId, amount: j.creditCost, kind: "refund_generation", jobId: j.id, note: "Refund — generation failed", createdAt: now() });
}

/* ---------------- Render agent protocol ---------------- */

function canRender(j: GenerationJob, userId: string) {
  return j.userId === userId || (MODE === "development" && j.userId === SAMPLE_USER_ID);
}

export async function claimRender(user: User, agentId: string) {
  await resumePending();
  return tx((db) => {
    const t = Date.now();
    const j = db.jobs
      .filter((x) => canRender(x, user.id))
      .filter((x) => x.status === "awaiting_render" || (x.status === "rendering" && (!x.renderLease || new Date(x.renderLease.expiresAt).getTime() < t)))
      .sort((a, b) => (a.userId === user.id ? -1 : 1) - (b.userId === user.id ? -1 : 1) || a.createdAt.localeCompare(b.createdAt))[0];
    if (!j) return null;
    const story = db.stories.find((s) => s.projectId === j.projectId);
    if (!story?.timeline) return null;
    j.status = "rendering";
    j.renderLease = { agentId, expiresAt: new Date(t + LEASE_MS).toISOString() };
    const st = j.stages.find((s) => s.key === "render")!;
    st.status = "running";
    st.startedAt ??= now();
    st.detail = "Rendering frames";
    j.previews = [];
    j.renderProgress = undefined;
    const p = db.projects.find((x) => x.id === j.projectId)!;
    p.status = "rendering";
    p.updatedAt = now();
    return { jobId: j.id, projectId: j.projectId, title: p.title, timeline: story.timeline };
  });
}

function leased(db: DB, user: User, jobId: string, agentId: string) {
  const j = db.jobs.find((x) => x.id === jobId);
  if (!j || !canRender(j, user.id)) throw new HttpError(404, "Job not found.");
  if (j.status !== "rendering" || j.renderLease?.agentId !== agentId) throw new HttpError(409, "This render was handed to another renderer.", "lease_lost");
  return j;
}

export async function reportProgress(user: User, jobId: string, agentId: string, prog: { phase: string; framesDone: number; framesTotal: number }) {
  return tx((db) => {
    const j = leased(db, user, jobId, agentId);
    j.renderLease = { agentId, expiresAt: new Date(Date.now() + LEASE_MS).toISOString() };
    j.renderProgress = { phase: String(prog.phase).slice(0, 20), framesDone: Math.max(0, Math.floor(prog.framesDone)), framesTotal: Math.max(1, Math.floor(prog.framesTotal)), updatedAt: now() };
    const st = j.stages.find((s) => s.key === "render")!;
    st.detail = prog.phase === "audio" ? "Mixing audio" : prog.phase === "previews" ? "Rendering scene previews" : prog.phase === "finalizing" ? "Finalizing MP4" : "Rendering frames";
    j.updatedAt = now();
  });
}

export async function savePreview(user: User, jobId: string, agentId: string, scene: number, jpeg: Buffer) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new HttpError(400, "Preview must be a JPEG.");
  if (jpeg.length > 2_000_000) throw new HttpError(413, "Preview too large.");
  await read((db) => leased(db, user, jobId, agentId));
  const key = await writeMedia(`previews/${jobId}_${scene}.jpg`, jpeg);
  await tx((db) => {
    const j = leased(db, user, jobId, agentId);
    j.previews = [...j.previews.filter((p) => p.scene !== scene), { scene, mediaKey: key }].sort((a, b) => a.scene - b.scene);
    j.renderLease = { agentId, expiresAt: new Date(Date.now() + LEASE_MS).toISOString() };
  });
}

function isMp4(buf: Buffer) {
  return buf.length > 1024 && buf.toString("ascii", 4, 8) === "ftyp";
}

export async function completeRender(
  user: User, jobId: string, agentId: string,
  files: { mp4: Buffer; thumb: Buffer },
  meta: { width: number; height: number; durationSec: number; videoCodec: string; audioCodec: string },
) {
  if (!isMp4(files.mp4)) throw new HttpError(400, "The uploaded file isn't a valid MP4.", "bad_video");
  if (files.thumb[0] !== 0xff || files.thumb[1] !== 0xd8) throw new HttpError(400, "Thumbnail must be a JPEG.");
  const expected = await read((db) => {
    const j = leased(db, user, jobId, agentId);
    const story = db.stories.find((s) => s.projectId === j.projectId);
    return { width: story?.timeline?.width, height: story?.timeline?.height, duration: story?.timeline?.duration ?? 0 };
  });
  if (meta.width !== expected.width || meta.height !== expected.height) throw new HttpError(400, "Video dimensions don't match the job.", "bad_video");
  if (Math.abs(meta.durationSec - expected.duration) > 1) throw new HttpError(400, "Video length doesn't match the job.", "bad_video");

  const videoId = id("vid");
  const mediaKey = await writeMedia(`videos/${videoId}.mp4`, files.mp4);
  const thumbKey = await writeMedia(`thumbs/${videoId}.jpg`, files.thumb);
  return tx((db) => {
    const j = leased(db, user, jobId, agentId);
    db.videos.push({
      id: videoId, projectId: j.projectId, mediaKey, thumbKey, width: meta.width, height: meta.height, durationSec: meta.durationSec,
      sizeBytes: files.mp4.length, videoCodec: String(meta.videoCodec).slice(0, 40), audioCodec: String(meta.audioCodec).slice(0, 40), engine: j.engine.render, createdAt: now(),
    });
    j.status = "completed";
    j.renderLease = undefined;
    const st = j.stages.find((s) => s.key === "render")!;
    st.status = "done";
    st.endedAt = now();
    st.detail = `${meta.width}×${meta.height} · ${meta.durationSec.toFixed(1)}s · ${(files.mp4.length / 1e6).toFixed(1)} MB MP4`;
    j.updatedAt = now();
    const p = db.projects.find((x) => x.id === j.projectId)!;
    p.status = "completed";
    p.videoId = videoId;
    p.updatedAt = now();
    return { videoId };
  });
}

export async function reportRenderFailure(user: User, jobId: string, agentId: string, message: string, retryable: boolean) {
  await read((db) => leased(db, user, jobId, agentId));
  await failOrRetry(jobId, "render", `Render failed: ${message.slice(0, 200)}`, retryable);
}

/* ---------------- Retry / regenerate / delete ---------------- */

export async function retryFailed(user: User, projectId: string) {
  const res = await tx((db) => {
    const p = db.projects.find((x) => x.id === projectId && x.userId === user.id);
    if (!p) throw new HttpError(404, "Project not found.");
    const j = db.jobs.find((x) => x.id === p.jobId)!;
    if (j.status !== "failed") throw new HttpError(409, "Only failed videos can be retried.");
    rollPeriods(db, user.id);
    if (balanceOf(db, user.id) < j.creditCost) throw new HttpError(402, `Retrying costs ${j.creditCost} credits and you have ${balanceOf(db, user.id)}.`, "insufficient_credits");
    const firstFailed = j.stages.findIndex((s) => s.status === "failed");
    j.stages = j.stages.map((s, i) => (i >= firstFailed ? { key: s.key, status: "pending" } : s));
    j.attempts = 1;
    j.error = undefined;
    j.refunded = false;
    j.previews = [];
    j.renderProgress = undefined;
    const renderOnly = j.stages[firstFailed]?.key === "render";
    j.status = renderOnly ? "awaiting_render" : "queued";
    p.status = j.status;
    p.updatedAt = now();
    db.credits.push({ id: id("ctx"), userId: user.id, amount: -j.creditCost, kind: "debit_generation", jobId: j.id, note: "Retry of failed video", createdAt: now() });
    return { jobId: j.id, renderOnly };
  });
  if (!res.renderOnly) kick(res.jobId);
  return res;
}

export async function deleteProject(user: User, projectId: string) {
  const keys = await tx((db) => {
    const p = db.projects.find((x) => x.id === projectId && x.userId === user.id);
    if (!p) throw new HttpError(404, "Project not found.");
    const j = db.jobs.find((x) => x.id === p.jobId);
    if (j && ["queued", "processing", "rendering"].includes(j.status)) throw new HttpError(409, "Wait for this video to finish before deleting it.");
    // Deleting before rendering finishes refunds unused credits.
    if (j && j.status === "awaiting_render") refund(db, j);
    const vids = db.videos.filter((v) => v.projectId === p.id);
    const keys = [...vids.flatMap((v) => [v.mediaKey, v.thumbKey]), ...(j?.previews.map((x) => x.mediaKey) ?? []), ...(j?.audio?.flatMap((a) => [a.narration?.mediaKey, a.dialogue?.mediaKey]).filter(Boolean) as string[] ?? [])];
    db.videos = db.videos.filter((v) => v.projectId !== p.id);
    db.stories = db.stories.filter((s) => s.projectId !== p.id);
    db.jobs = db.jobs.filter((x) => x.projectId !== p.id);
    db.projects = db.projects.filter((x) => x.id !== p.id);
    return keys;
  });
  await Promise.all(keys.map((k) => deleteMedia(k).catch(() => undefined)));
}

import "server-only";
import { estimateCredits, getPlan, type Plan } from "@/config/plans";
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
import { addCredits, planFor, rollPeriods } from "./credits";
import { creditBalance, deleteDocs, findDocs, findOne, getDoc, insertDoc, mutateDoc, newId, now, upsertDoc } from "./data";
import { deleteMedia, inspectMedia, mediaUrl, signedUploadUrl, writeMedia } from "./media";
import type { GenerationJob, Project, Story, User, Video } from "./models";
import { generateStory, ProviderError } from "./providers/story";
import { defaultNarrator, narratorVoices, synthesize } from "./providers/voice";
import { KOKORO_NARRATORS, kokoroVoiceFor } from "@/lib/engine/voices";

export const SAMPLE_USER_ID = "usr_samples";
const MAX_ATTEMPTS = 3;
const LEASE_MS = 45_000;
const ADVANCE_LEASE_MS = 90_000;

/* ---------------- Character library ---------------- */

type Counter = { n: number };

export async function libraryFor(userId: string | null): Promise<CharacterRecord[]> {
  const [own, community, counters] = await Promise.all([
    userId ? findDocs<CharacterRecord>("characters", (q) => q.eq("owner_id", userId)) : Promise.resolve([]),
    findDocs<CharacterRecord>("characters", (q) => (userId ? q.eq("visibility", "public").neq("owner_id", userId) : q.eq("visibility", "public"))),
    findDocs<Counter & { id: string }>("sample_views", (q) => q.like("id", "uses:%")),
  ]);
  const uses = new Map(counters.map((c) => [c.id.slice(5), c.n]));
  return [...OFFICIAL_CHARACTERS, ...own, ...community].map((c) => ({ ...c, uses: c.uses + (uses.get(c.id) ?? 0) }));
}

async function countUse(charId: string) {
  const key = `uses:${charId}`;
  const done = await mutateDoc<Counter & { id: string }>("sample_views", key, (d) => void (d.n += 1));
  if (!done) await upsertDoc("sample_views", key, { id: key, n: 1 });
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

export async function quote(userId: string, input: Pick<CreateInput, "duration" | "style">) {
  await rollPeriods(userId);
  const plan = await planFor(userId);
  const cost = estimateCredits({ duration: input.duration, style: input.style, narration: PROVIDERS.voice !== "none", exportHeight: plan.exportHeight });
  return { plan, cost, balance: await creditBalance(userId) };
}

function freshStages(): StageState[] {
  return STAGES.map((s) => ({ key: s.key, status: "pending" }));
}

export async function createGeneration(user: User, input: CreateInput) {
  if (!PROVIDERS.story) throw new HttpError(503, "Video generation isn't available: no story provider is configured.", "provider_unavailable");
  if (input.idempotencyKey) {
    const dup = await findOne<GenerationJob>("jobs", (q) => q.eq("user_id", user.id).eq("idempotency_key", input.idempotencyKey!));
    if (dup) return { project: (await getDoc<Project>("projects", dup.projectId))!, job: dup, duplicate: true };
  }
  const { plan, cost } = await quote(user.id, input);
  if (input.duration > plan.maxDurationSec)
    throw new HttpError(403, `${input.duration}-second videos need a plan that allows them. Your ${plan.name} plan goes up to ${plan.maxDurationSec}s.`, "duration_not_in_plan");

  const lib = await libraryFor(user.id);
  for (const cid of input.castIds) {
    const c = lib.find((x) => x.id === cid);
    if (!c) throw new HttpError(400, "One of the selected characters no longer exists.", "bad_cast");
    const ok = canCast(c, { id: user.id, planId: plan.id });
    if (!ok.ok) throw new HttpError(403, `${c.name}: ${ok.reason}`, "cast_not_allowed");
  }

  let series: { seriesId: string; episode: number } | undefined;
  if (input.previousProjectId) {
    const prev = await getDoc<Project>("projects", input.previousProjectId);
    if (!prev || prev.userId !== user.id || !(await findOne<Story>("stories", (q) => q.eq("project_id", prev.id)))) throw new HttpError(400, "The previous episode couldn't be found.", "bad_previous");
    const updated = await mutateDoc<Project>("projects", prev.id, (p) => {
      p.seriesId ??= p.id;
      p.episode ??= 1;
    });
    series = { seriesId: updated!.seriesId!, episode: (updated!.episode ?? 1) + 1 };
  }

  const projectId = newId("prj");
  const jobId = newId("job");
  const t = now();

  // Debit first: the database refuses it if the balance would go negative.
  try {
    await addCredits(user.id, -cost.total, "debit_generation", `Video: ${input.duration}s ${input.style}`, { jobId });
  } catch (e) {
    if (e instanceof HttpError && e.code === "insufficient_credits") {
      const bal = await creditBalance(user.id);
      throw new HttpError(402, `This video costs ${cost.total} credits and you have ${bal}.`, "insufficient_credits");
    }
    throw e;
  }

  const summary = providerSummary();
  const job: GenerationJob = {
    id: jobId, projectId, userId: user.id, status: "queued", stages: freshStages(), attempts: 1, maxAttempts: MAX_ATTEMPTS,
    creditCost: cost.total, idempotencyKey: input.idempotencyKey, exportHeight: input.exportOverride ?? plan.exportHeight, watermark: plan.watermark,
    engine: { story: summary.story.label, voice: summary.voice.label, render: summary.render.label },
    previews: [], refunded: false, createdAt: t, updatedAt: t,
  };
  const project: Project = {
    id: projectId, userId: user.id, title: "Untitled world", prompt: input.prompt, style: input.style, durationPreset: input.duration,
    aspect: "9:16", mode: "auto", voice: input.voice, castIds: input.castIds, category: categoryFor(input.prompt), visibility: "private",
    status: "queued", jobId, parentProjectId: input.parentProjectId, views: 0, createdAt: t, updatedAt: t,
    format: input.format, previousProjectId: input.previousProjectId, seriesId: series?.seriesId, episode: series?.episode,
  };
  try {
    await insertDoc("projects", projectId, project);
    await insertDoc("jobs", jobId, job);
  } catch (e) {
    await deleteDocs("projects", (q) => q.eq("id", projectId));
    await addCredits(user.id, cost.total, "refund_generation", "Refund — couldn't start", { jobId });
    // Lost an idempotency race: return the job that won.
    const dup = input.idempotencyKey ? await findOne<GenerationJob>("jobs", (q) => q.eq("user_id", user.id).eq("idempotency_key", input.idempotencyKey!)) : null;
    if (dup) return { project: (await getDoc<Project>("projects", dup.projectId))!, job: dup, duplicate: true };
    throw e;
  }
  return { project, job, duplicate: false };
}

const kokoroLabel = (id: string) => KOKORO_NARRATORS.find((v) => v.id === id)?.label ?? id;

/* ---------------- Running a job (serverless-friendly) ---------------- */

async function setStage(jobId: string, key: StageKey, patch: Partial<StageState>) {
  await mutateDoc<GenerationJob>("jobs", jobId, (j) => {
    Object.assign(j.stages.find((x) => x.key === key)!, patch);
    j.updatedAt = now();
  });
}

async function setProjectStatus(projectId: string, status: Project["status"], extra: Partial<Project> = {}) {
  await mutateDoc<Project>("projects", projectId, (p) => {
    Object.assign(p, extra, { status, updatedAt: now() });
  });
}

function sceneAudioKey(jobId: string, scene: number, kind: "n" | "d") {
  return `audio/${jobId}_${scene}_${kind}.wav`;
}

/**
 * Runs the server-side stages of a job inside the calling request. Called by
 * the project page (POST /api/jobs/:id/advance) — there's no background
 * worker, so it works on serverless hosts. A short lease stops two requests
 * running the same job.
 */
export async function advanceJob(jobId: string, userId: string) {
  let claimed = false;
  const job0 = await mutateDoc<GenerationJob & { advanceUntil?: string }>("jobs", jobId, (j) => {
    if (j.userId !== userId && !(MODE === "development" && j.userId === SAMPLE_USER_ID)) return false;
    if (!["queued", "processing"].includes(j.status)) return false;
    if (j.advanceUntil && new Date(j.advanceUntil) > new Date()) return false;
    j.advanceUntil = new Date(Date.now() + ADVANCE_LEASE_MS).toISOString();
    j.status = "processing";
    claimed = true;
  });
  if (!job0 || !claimed) return { ran: false };
  const job = job0;
  const project = (await getDoc<Project>("projects", job.projectId))!;
  await setProjectStatus(project.id, "processing");
  const plan: Plan = await planFor(job.userId);
  const library = await libraryFor(job.userId);
  const previous = project.previousProjectId ? (await findOne<Story>("stories", (q) => q.eq("project_id", project.previousProjectId!)))?.plan : undefined;
  let story = await findOne<Story>("stories", (q) => q.eq("project_id", project.id));
  const stageDone = (k: StageKey) => ["done", "skipped"].includes(job.stages.find((s) => s.key === k)?.status ?? "");
  let current: StageKey = "story";

  try {
    /* 1. Story */
    if (!stageDone("story") || !story) {
      current = "story";
      await setStage(jobId, "story", { status: "running", startedAt: now(), detail: job.engine.story });
      const cast = project.castIds.map((cid) => library.find((c) => c.id === cid)).filter(Boolean) as CharacterRecord[];
      const res = await generateStory({
        prompt: project.prompt, duration: project.durationPreset, style: project.style, format: project.format ?? "strange_world", previous,
        cast, library: library.filter((c) => canCast(c, { id: project.userId, planId: plan.id }).ok || project.castIds.includes(c.id)), seed: jobId,
      });
      const s: Story = { id: newId("sty"), projectId: project.id, source: res.source, model: res.model, plan: res.plan, checklist: res.checklist, checklistSource: res.checklistSource, revised: res.revised, createdAt: now() };
      await deleteDocs("stories", (q) => q.eq("project_id", project.id));
      await insertDoc("stories", s.id, s);
      await setProjectStatus(project.id, "processing", { storyId: s.id, title: res.plan.title });
      story = s;
      const passed = res.checklist.filter((c) => c.pass === true).length;
      const twist = res.plan.sheet?.twistType ? ` · ${res.plan.sheet.twistType.replace(/_/g, " ")} twist` : "";
      await setStage(jobId, "story", {
        status: "done", endedAt: now(),
        detail: `${res.plan.scenes.length} scenes${twist} · ${res.source === "anthropic" ? `written by ${res.model}${res.revised ? ", revised after editor review" : ""}` : "template engine (not AI)"} · checklist ${passed}/${res.checklist.length}`,
      });
    }
    const storyPlan = story.plan;

    /* 2. Characters */
    current = "characters";
    await setStage(jobId, "characters", { status: "running", startedAt: now() });
    const specs: CharacterSpec[] = [];
    const refs: Record<string, string> = {};
    const generated: string[] = [];
    let reused = 0;
    for (const c of storyPlan.cast) {
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
    await mutateDoc<Story>("stories", story.id, (s) => {
      s.cast = specs;
      s.refs = refs;
      s.generatedCharacterIds = generated;
    });
    await Promise.all(specs.filter((s) => !s.id.startsWith("gen_")).map((s) => countUse(s.id).catch(() => undefined)));
    await setStage(jobId, "characters", { status: "done", endedAt: now(), detail: `${specs.length} characters · ${reused} from the library${generated.length ? ` · ${generated.length} newly designed` : ""}` });

    /* 3. World */
    current = "world";
    const envs = [...new Set(storyPlan.scenes.map((s) => s.environment.replace(/_/g, " ")))];
    const props = new Set(storyPlan.scenes.flatMap((s) => s.props)).size;
    await setStage(jobId, "world", { status: "done", startedAt: now(), endedAt: now(), detail: `${envs.length} environment${envs.length === 1 ? "" : "s"} (${envs.join(", ")}) · ${props} prop type${props === 1 ? "" : "s"} · ${project.style} style` });

    /* 4. Animation */
    current = "animation";
    const actions = storyPlan.scenes.reduce((a, s) => a + s.characters.length, 0);
    const cams = new Set(storyPlan.scenes.map((s) => s.camera)).size;
    await setStage(jobId, "animation", { status: "done", startedAt: now(), endedAt: now(), detail: `${storyPlan.scenes.length} scenes · ${actions} character performances · ${cams} camera moves` });

    /* 5. Narration */
    current = "narration";
    const audio: SceneAudio[] = [];
    const stored: NonNullable<GenerationJob["audio"]> = [];
    if (PROVIDERS.voice === "kokoro-browser" && project.voice) {
      await setStage(jobId, "narration", { status: "pending", detail: `Voice: ${kokoroLabel(project.voice)} · recorded in your browser just before rendering` });
      await mutateDoc<GenerationJob>("jobs", jobId, (j) => void (j.browserVoice = { narrator: project.voice!, recorded: false }));
    } else if (PROVIDERS.voice === "none" || !project.voice) {
      await setStage(jobId, "narration", { status: "skipped", startedAt: now(), endedAt: now(), detail: "No narration voice set up — captions and music only" });
    } else {
      await setStage(jobId, "narration", { status: "running", startedAt: now(), detail: `Voice: ${project.voice}` });
      for (let i = 0; i < storyPlan.scenes.length; i++) {
        const sc = storyPlan.scenes[i];
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
      }
      const total = stored.reduce((x, s) => x + (s.narration?.duration ?? 0) + (s.dialogue?.duration ?? 0), 0);
      await setStage(jobId, "narration", { status: "done", endedAt: now(), detail: `Voice: ${project.voice} · ${stored.length} clips · ${total.toFixed(1)}s of speech` });
    }

    /* 6. Editing */
    current = "editing";
    const width = job.exportHeight;
    const timeline = compileTimeline({ plan: storyPlan, style: project.style, cast: specs, refs, audio, width, height: Math.round((width * 16) / 9), watermark: job.watermark, targetDuration: project.durationPreset });
    await mutateDoc<Story>("stories", story.id, (s) => void (s.timeline = timeline));
    await setStage(jobId, "editing", {
      status: "done", startedAt: now(), endedAt: now(),
      detail: `${timeline.duration.toFixed(1)}s cut · ${timeline.captions.length} caption cards · ${timeline.sfx.length} sound cues · ${timeline.musicMood} score`,
    });

    /* 7. Hand off to the renderer */
    await mutateDoc<GenerationJob & { advanceUntil?: string }>("jobs", jobId, (j) => {
      j.status = "awaiting_render";
      j.audio = stored;
      j.advanceUntil = undefined;
      j.stages.find((s) => s.key === "render")!.detail = "Waiting for a renderer";
    });
    await setProjectStatus(project.id, "awaiting_render");
  } catch (e) {
    const retryable = e instanceof ProviderError ? e.retryable : false;
    const msg = e instanceof ProviderError ? e.message : "Something went wrong while preparing your video.";
    if (!(e instanceof ProviderError)) console.error("[pipeline]", e);
    await failOrRetry(jobId, current, msg, retryable);
  }
  return { ran: true };
}

/** Retries a retryable failure (the next advance picks it up), otherwise fails and refunds. */
async function failOrRetry(jobId: string, stage: StageKey, message: string, retryable: boolean) {
  let refundFor: GenerationJob | null = null;
  const j = await mutateDoc<GenerationJob & { advanceUntil?: string }>("jobs", jobId, (job) => {
    refundFor = null;
    const s = job.stages.find((x) => x.key === stage)!;
    job.advanceUntil = undefined;
    job.renderLease = undefined;
    job.updatedAt = now();
    if (retryable && job.attempts < job.maxAttempts) {
      job.attempts++;
      s.status = "pending";
      s.detail = `Retrying (attempt ${job.attempts} of ${job.maxAttempts}): ${message}`;
      job.status = stage === "render" ? "awaiting_render" : "queued";
      return;
    }
    s.status = "failed";
    s.endedAt = now();
    s.detail = message;
    job.status = "failed";
    job.error = message;
    if (!job.refunded) {
      job.refunded = true;
      refundFor = job;
    }
  });
  if (!j) return;
  await setProjectStatus(j.projectId, j.status);
  if (refundFor) await refund(refundFor);
}

async function refund(j: GenerationJob) {
  try {
    await addCredits(j.userId, j.creditCost, "refund_generation", "Refund — generation failed", { jobId: j.id });
  } catch {
    /* already refunded (unique per job) */
  }
}

/* ---------------- Render agent protocol ---------------- */

function canRender(j: GenerationJob, userId: string) {
  return j.userId === userId || (MODE === "development" && j.userId === SAMPLE_USER_ID);
}

export async function claimRender(user: User, agentId: string) {
  const ownerIds = MODE === "development" ? [user.id, SAMPLE_USER_ID] : [user.id];
  const candidates = await findDocs<GenerationJob>("jobs", (q) => q.in("user_id", ownerIds).in("status", ["awaiting_render", "rendering"]).order("ts", { ascending: true }).limit(10));
  candidates.sort((a, b) => (a.userId === user.id ? -1 : 1) - (b.userId === user.id ? -1 : 1));
  for (const c of candidates) {
    let won = false;
    const j = await mutateDoc<GenerationJob>("jobs", c.id, (job) => {
      const t = Date.now();
      const free = job.status === "awaiting_render" || (job.status === "rendering" && (!job.renderLease || new Date(job.renderLease.expiresAt).getTime() < t));
      if (!free || !canRender(job, user.id)) return false;
      job.status = "rendering";
      job.renderLease = { agentId, expiresAt: new Date(t + LEASE_MS).toISOString() };
      const st = job.stages.find((s) => s.key === "render")!;
      st.status = "running";
      st.startedAt ??= now();
      st.detail = "Rendering frames";
      job.previews = [];
      job.renderProgress = undefined;
      won = true;
    });
    if (!won || !j) continue;
    const story = await findOne<Story>("stories", (q) => q.eq("project_id", j.projectId));
    if (!story?.timeline) continue;
    await setProjectStatus(j.projectId, "rendering");
    const p = await getDoc<Project>("projects", j.projectId);
    return { jobId: j.id, projectId: j.projectId, title: p?.title ?? "", timeline: story.timeline, voice: voiceTask(j, story) };
  }
  return null;
}

/** What the browser should record before rendering, if anything. */
function voiceTask(j: GenerationJob, story: Story) {
  if (!j.browserVoice || j.browserVoice.recorded) return null;
  const refs = story.refs ?? {};
  const cast = story.cast ?? [];
  return {
    clips: story.plan.scenes.flatMap((sc, i) => {
      const out: { scene: number; kind: "n" | "d"; text: string; voice: string; delivery: string }[] = [{ scene: i, kind: "n", text: sc.narration, voice: kokoroVoiceFor(j.browserVoice!.narrator), delivery: sc.delivery ?? "normal" }];
      if (sc.dialogue) {
        const speaker = cast.find((c) => c.id === refs[sc.dialogue!.ref]);
        out.push({ scene: i, kind: "d", text: sc.dialogue.line, voice: kokoroVoiceFor(speaker?.voice, speaker?.id ?? sc.dialogue.ref), delivery: "normal" });
      }
      return out;
    }),
  };
}

/** Signed URLs the browser uploads its recorded narration clips to. */
export async function narrationUploadUrls(user: User, jobId: string, agentId: string) {
  const j = await leased(user, jobId, agentId);
  const story = await findOne<Story>("stories", (q) => q.eq("project_id", j.projectId));
  if (!j.browserVoice || j.browserVoice.recorded || !story) throw new HttpError(409, "This video doesn't need narration recorded.");
  const task = voiceTask(j, story)!;
  await mutateLeased(user, jobId, agentId, (job) => {
    const st = job.stages.find((s) => s.key === "narration")!;
    st.status = "running";
    st.startedAt ??= now();
  });
  return Promise.all(task.clips.map(async (c) => ({ scene: c.scene, kind: c.kind, ...(await signedUploadUrl(sceneAudioKey(jobId, c.scene, c.kind))) })));
}

/**
 * The browser has uploaded its narration. Durations are read from the WAV
 * files themselves (not trusted from the client), then the timeline is
 * recompiled so scenes and captions follow the real speech.
 * `skipped` = the browser couldn't record (captions-only video).
 */
export async function saveNarration(user: User, jobId: string, agentId: string, skipped: string | null) {
  const j = await leased(user, jobId, agentId);
  const story = await findOne<Story>("stories", (q) => q.eq("project_id", j.projectId));
  const project = await getDoc<Project>("projects", j.projectId);
  if (!j.browserVoice || !story?.timeline || !project) throw new HttpError(409, "This video doesn't need narration recorded.");
  if (j.browserVoice.recorded) return { timeline: story.timeline };
  const task = voiceTask(j, story)!;

  let audio: SceneAudio[] = [];
  const stored: NonNullable<GenerationJob["audio"]> = [];
  if (!skipped) {
    const measured = await Promise.all(
      task.clips.map(async (c) => {
        const key = sceneAudioKey(jobId, c.scene, c.kind);
        const head = await inspectMedia(key, 64);
        if (!head || head.head.toString("ascii", 0, 4) !== "RIFF" || head.head.toString("ascii", 8, 12) !== "WAVE") throw new HttpError(400, "A narration clip is missing or isn't a WAV file.");
        if (head.size > 20_000_000) throw new HttpError(413, "A narration clip is too large.");
        const rate = head.head.readUInt32LE(24), channels = head.head.readUInt16LE(22), bits = head.head.readUInt16LE(34);
        const duration = rate && channels && bits ? (head.size - 44) / (rate * channels * (bits / 8)) : 0;
        if (!(duration > 0.2 && duration < 60)) throw new HttpError(400, "A narration clip has an unexpected length.");
        return { ...c, key, duration };
      }),
    );
    audio = story.plan.scenes.map(() => ({}));
    for (const m of measured) {
      const slot = stored.find((x) => x.scene === m.scene) ?? (stored.push({ scene: m.scene }), stored[stored.length - 1]);
      const clip = { mediaKey: m.key, duration: m.duration };
      if (m.kind === "n") {
        slot.narration = clip;
        audio[m.scene].narration = { url: mediaUrl(m.key), duration: m.duration };
      } else {
        slot.dialogue = clip;
        audio[m.scene].dialogue = { url: mediaUrl(m.key), duration: m.duration };
      }
    }
  }
  const tl = story.timeline;
  const timeline = skipped
    ? tl
    : compileTimeline({ plan: story.plan, style: project.style, cast: story.cast ?? [], refs: story.refs ?? {}, audio, width: tl.width, height: tl.height, watermark: j.watermark, targetDuration: project.durationPreset });
  await mutateDoc<Story>("stories", story.id, (s) => void (s.timeline = timeline));
  const speech = stored.reduce((x, s) => x + (s.narration?.duration ?? 0) + (s.dialogue?.duration ?? 0), 0);
  await mutateLeased(user, jobId, agentId, (job) => {
    job.browserVoice = { ...job.browserVoice!, recorded: true };
    job.audio = stored;
    const n = job.stages.find((s) => s.key === "narration")!;
    n.status = skipped ? "skipped" : "done";
    n.endedAt = now();
    n.detail = skipped
      ? `Couldn't record narration in this browser (${skipped.slice(0, 80)}) — captions and music only`
      : `Voice: ${kokoroLabel(job.browserVoice!.narrator)} (Kokoro) · ${stored.length} scenes · ${speech.toFixed(1)}s of speech`;
    if (!skipped) job.stages.find((s) => s.key === "editing")!.detail = `${timeline.duration.toFixed(1)}s cut · ${timeline.captions.length} caption cards · ${timeline.sfx.length} sound cues · ${timeline.musicMood} score`;
  });
  return { timeline };
}

async function leased(user: User, jobId: string, agentId: string) {
  const j = await getDoc<GenerationJob>("jobs", jobId);
  if (!j || !canRender(j, user.id)) throw new HttpError(404, "Job not found.");
  if (j.status !== "rendering" || j.renderLease?.agentId !== agentId) throw new HttpError(409, "This render was handed to another renderer.", "lease_lost");
  return j;
}

async function mutateLeased(user: User, jobId: string, agentId: string, fn: (j: GenerationJob) => void) {
  return mutateDoc<GenerationJob>("jobs", jobId, (j) => {
    if (!canRender(j, user.id)) throw new HttpError(404, "Job not found.");
    if (j.status !== "rendering" || j.renderLease?.agentId !== agentId) throw new HttpError(409, "This render was handed to another renderer.", "lease_lost");
    fn(j);
    j.renderLease = { agentId, expiresAt: new Date(Date.now() + LEASE_MS).toISOString() };
    j.updatedAt = now();
  });
}

export async function reportProgress(user: User, jobId: string, agentId: string, prog: { phase: string; framesDone: number; framesTotal: number }) {
  await mutateLeased(user, jobId, agentId, (j) => {
    j.renderProgress = { phase: String(prog.phase).slice(0, 20), framesDone: Math.max(0, Math.floor(prog.framesDone)), framesTotal: Math.max(1, Math.floor(prog.framesTotal)), updatedAt: now() };
    j.stages.find((s) => s.key === "render")!.detail =
      prog.phase === "voice" ? "Recording narration in this browser" : prog.phase === "audio" ? "Mixing audio" : prog.phase === "previews" ? "Rendering scene previews" : prog.phase === "finalizing" ? "Finalizing MP4" : prog.phase === "uploading" ? "Uploading MP4" : "Rendering frames";
  });
}

export async function savePreview(user: User, jobId: string, agentId: string, scene: number, jpeg: Buffer) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new HttpError(400, "Preview must be a JPEG.");
  if (jpeg.length > 2_000_000) throw new HttpError(413, "Preview too large.");
  await leased(user, jobId, agentId);
  const key = await writeMedia(`previews/${jobId}_${scene}.jpg`, jpeg);
  await mutateLeased(user, jobId, agentId, (j) => {
    j.previews = [...j.previews.filter((p) => p.scene !== scene), { scene, mediaKey: key }].sort((a, b) => a.scene - b.scene);
  });
}

/** Signed URLs the browser uploads the finished MP4 and thumbnail to (bypasses function size limits). */
export async function renderUploadUrls(user: User, jobId: string, agentId: string) {
  await leased(user, jobId, agentId);
  const videoId = newId("vid");
  const video = await signedUploadUrl(`videos/${videoId}.mp4`);
  const thumb = await signedUploadUrl(`thumbs/${videoId}.jpg`);
  await mutateLeased(user, jobId, agentId, (j) => void ((j as GenerationJob & { pendingVideoId?: string }).pendingVideoId = videoId));
  return { videoId, video, thumb };
}

export async function completeRender(
  user: User, jobId: string, agentId: string,
  meta: { videoId: string; width: number; height: number; durationSec: number; videoCodec: string; audioCodec: string },
) {
  const j = (await leased(user, jobId, agentId)) as GenerationJob & { pendingVideoId?: string };
  if (!j.pendingVideoId || j.pendingVideoId !== meta.videoId) throw new HttpError(400, "Unknown upload.", "bad_video");
  const story = await findOne<Story>("stories", (q) => q.eq("project_id", j.projectId));
  const tl = story?.timeline;
  if (!tl || meta.width !== tl.width || meta.height !== tl.height) throw new HttpError(400, "Video dimensions don't match the job.", "bad_video");
  if (Math.abs(meta.durationSec - tl.duration) > 1) throw new HttpError(400, "Video length doesn't match the job.", "bad_video");
  const mediaKey = `videos/${meta.videoId}.mp4`;
  const thumbKey = `thumbs/${meta.videoId}.jpg`;
  const [v, th] = await Promise.all([inspectMedia(mediaKey), inspectMedia(thumbKey)]);
  if (!v || v.size < 1024 || v.head.toString("ascii", 4, 8) !== "ftyp") throw new HttpError(400, "The uploaded file isn't a valid MP4.", "bad_video");
  if (!th || th.head[0] !== 0xff || th.head[1] !== 0xd8) throw new HttpError(400, "Thumbnail must be a JPEG.", "bad_video");

  const video: Video = {
    id: meta.videoId, projectId: j.projectId, mediaKey, thumbKey, width: meta.width, height: meta.height, durationSec: meta.durationSec,
    sizeBytes: v.size, videoCodec: String(meta.videoCodec).slice(0, 40), audioCodec: String(meta.audioCodec).slice(0, 40), engine: j.engine.render, createdAt: now(),
  };
  await upsertDoc("videos", video.id, video);
  await mutateLeased(user, jobId, agentId, (job) => {
    job.status = "completed";
    const st = job.stages.find((s) => s.key === "render")!;
    st.status = "done";
    st.endedAt = now();
    st.detail = `${meta.width}×${meta.height} · ${meta.durationSec.toFixed(1)}s · ${(v.size / 1e6).toFixed(1)} MB MP4`;
  });
  await mutateDoc<GenerationJob>("jobs", jobId, (job) => void (job.renderLease = undefined));
  await setProjectStatus(j.projectId, "completed", { videoId: video.id });
  return { videoId: video.id };
}

export async function reportRenderFailure(user: User, jobId: string, agentId: string, message: string, retryable: boolean) {
  await leased(user, jobId, agentId);
  await failOrRetry(jobId, "render", `Render failed: ${message.slice(0, 200)}`, retryable);
}

/* ---------------- Retry / delete ---------------- */

export async function retryFailed(user: User, projectId: string) {
  const p = await getDoc<Project>("projects", projectId);
  if (!p || p.userId !== user.id) throw new HttpError(404, "Project not found.");
  const j0 = await getDoc<GenerationJob>("jobs", p.jobId);
  if (!j0 || j0.status !== "failed") throw new HttpError(409, "Only failed videos can be retried.");
  await rollPeriods(user.id);
  try {
    await addCredits(user.id, -j0.creditCost, "debit_generation", "Retry of failed video", { jobId: j0.id });
  } catch (e) {
    if (e instanceof HttpError && e.code === "insufficient_credits") throw new HttpError(402, `Retrying costs ${j0.creditCost} credits and you have ${await creditBalance(user.id)}.`, "insufficient_credits");
    throw e;
  }
  let renderOnly = false;
  const j = await mutateDoc<GenerationJob>("jobs", j0.id, (job) => {
    const firstFailed = job.stages.findIndex((s) => s.status === "failed");
    job.stages = job.stages.map((s, i) => (i >= firstFailed ? { key: s.key, status: "pending" } : s));
    job.attempts = 1;
    job.error = undefined;
    job.refunded = false;
    job.previews = [];
    job.renderProgress = undefined;
    renderOnly = job.stages[firstFailed]?.key === "render";
    job.status = renderOnly ? "awaiting_render" : "queued";
  });
  await setProjectStatus(p.id, j!.status);
  return { jobId: j0.id, renderOnly };
}

export async function deleteProject(user: User, projectId: string) {
  const p = await getDoc<Project>("projects", projectId);
  if (!p || p.userId !== user.id) throw new HttpError(404, "Project not found.");
  const j = await getDoc<GenerationJob>("jobs", p.jobId);
  if (j && ["queued", "processing", "rendering"].includes(j.status)) throw new HttpError(409, "Wait for this video to finish before deleting it.");
  if (j && j.status === "awaiting_render" && !j.refunded) {
    await mutateDoc<GenerationJob>("jobs", j.id, (x) => void (x.refunded = true));
    await refund(j);
  }
  const vids = await findDocs<Video>("videos", (q) => q.eq("project_id", p.id));
  const keys = [
    ...vids.flatMap((v) => [v.mediaKey, v.thumbKey]),
    ...(j?.previews.map((x) => x.mediaKey) ?? []),
    ...((j?.audio?.flatMap((a) => [a.narration?.mediaKey, a.dialogue?.mediaKey]).filter(Boolean) as string[]) ?? []),
  ];
  await Promise.all([
    deleteDocs("videos", (q) => q.eq("project_id", p.id)),
    deleteDocs("stories", (q) => q.eq("project_id", p.id)),
    deleteDocs("jobs", (q) => q.eq("project_id", p.id)),
  ]);
  await deleteDocs("projects", (q) => q.eq("id", p.id));
  await deleteMedia(keys).catch(() => undefined);
}

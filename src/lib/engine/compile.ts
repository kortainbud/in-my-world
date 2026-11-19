/**
 * Timeline compiler: turns a story plan + measured audio into a frame-exact
 * edit the renderer plays back. Pure and deterministic.
 */
import { hashString } from "./rng";
import type {
  AudioClip,
  CaptionChunk,
  CharacterSpec,
  SfxCue,
  StoryPlan,
  Timeline,
  TimelineScene,
  VisualStyle,
} from "./types";

export const WORDS_PER_SECOND = 2.7;
const SCENE_PAD = 0.45;
const MIN_SCENE = 2.4;
const INTRO = 0.3;

export interface SceneAudio {
  narration?: { url: string; duration: number };
  dialogue?: { url: string; duration: number };
}

export function estimateSpeech(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, words / WORDS_PER_SECOND);
}

function captionChunks(text: string, start: number, duration: number): CaptionChunk[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  // Weight by characters (+ a little for punctuation pauses).
  const weights = words.map((w) => w.replace(/[^\w']/g, "").length + 2 + (/[.,!?…;:]$/.test(w) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = start;
  const timed = words.map((w, i) => {
    const d = (weights[i] / total) * duration;
    const word = { text: w, start: t, end: t + d };
    t += d;
    return word;
  });
  const chunks: CaptionChunk[] = [];
  let cur: typeof timed = [];
  for (const w of timed) {
    cur.push(w);
    const breakHere = cur.length >= 3 || /[.,!?…;:]$/.test(w.text);
    if (breakHere) {
      chunks.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
      cur = [];
    }
  }
  if (cur.length) chunks.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
  return chunks;
}

export function compileTimeline(opts: {
  plan: StoryPlan;
  style: VisualStyle;
  cast: CharacterSpec[];
  refs: Record<string, string>;
  audio: SceneAudio[];
  width: number;
  height: number;
  fps?: number;
  watermark: boolean;
  targetDuration: number;
}): Timeline {
  const fps = opts.fps ?? 30;
  let t = INTRO;
  const scenes: TimelineScene[] = [];
  const audio: AudioClip[] = [];
  const captions: CaptionChunk[] = [];
  const sfx: SfxCue[] = [];
  const narrated = opts.audio.some((a) => a.narration);

  opts.plan.scenes.forEach((plan, index) => {
    const a = opts.audio[index] ?? {};
    const narrDur = a.narration?.duration ?? estimateSpeech(plan.narration);
    const dlgDur = plan.dialogue ? (a.dialogue?.duration ?? estimateSpeech(plan.dialogue.line)) : 0;
    const gap = plan.dialogue ? 0.2 : 0;
    const duration = Math.max(MIN_SCENE, narrDur + gap + dlgDur + SCENE_PAD);
    const start = t;

    if (a.narration) audio.push({ url: a.narration.url, start: start + 0.1, duration: a.narration.duration, kind: "narration" });
    captions.push(...captionChunks(plan.narration, start + 0.1, narrDur));

    let dialogueWindow: TimelineScene["dialogueWindow"];
    if (plan.dialogue) {
      const ds = start + 0.1 + narrDur + gap;
      dialogueWindow = { start: ds, end: ds + dlgDur + 0.3 };
      if (a.dialogue) audio.push({ url: a.dialogue.url, start: ds, duration: a.dialogue.duration, kind: "dialogue" });
    }

    plan.sfx.forEach((kind, i) => sfx.push({ kind, at: start + 0.15 + i * 0.6 }));

    scenes.push({ index, start, duration, plan, seed: hashString(plan.narration + index), dialogueWindow });
    t += duration;
  });

  const duration = Math.ceil((t + 0.6) * fps) / fps;

  return {
    version: 1,
    style: opts.style,
    width: opts.width,
    height: opts.height,
    fps,
    duration,
    title: opts.plan.title,
    musicMood: opts.plan.musicMood,
    cast: opts.cast,
    refs: opts.refs,
    scenes,
    audio,
    captions,
    sfx,
    watermark: opts.watermark,
    narrated,
  };
}

export function sceneAt(tl: Timeline, time: number): TimelineScene {
  for (let i = tl.scenes.length - 1; i >= 0; i--) if (time >= tl.scenes[i].start) return tl.scenes[i];
  return tl.scenes[0];
}

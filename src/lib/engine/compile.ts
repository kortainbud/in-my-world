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
export const REVEAL_PAUSE = 0.8;
const RATE: Record<string, number> = { fast: 1.12, normal: 1, slow: 0.88 };
const SCENE_PAD = 0.45;
const MIN_SCENE = 2.4;
const INTRO = 0.3;

export interface SceneAudio {
  narration?: { url: string; duration: number };
  dialogue?: { url: string; duration: number };
}

export function estimateSpeech(text: string, delivery?: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, words / (WORDS_PER_SECOND * (RATE[delivery ?? "normal"] ?? 1)));
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

  // Caption-only videos have no measured speech, so their pacing is an
  // estimate. Tighten it to fit the chosen length, but never past ~30%
  // faster, so captions stay comfortable to read.
  let pace = 1;
  if (!narrated) {
    let fixed = INTRO + 0.6;
    let speech = 0;
    for (const plan of opts.plan.scenes) {
      const sp = estimateSpeech(plan.narration, plan.delivery) + (plan.dialogue ? estimateSpeech(plan.dialogue.line) + 0.2 : 0);
      fixed += (plan.pauseBefore ? REVEAL_PAUSE : 0) + SCENE_PAD;
      speech += sp;
    }
    if (fixed + speech > opts.targetDuration && speech > 0) pace = Math.max(0.7, (opts.targetDuration - fixed) / speech);
  }

  opts.plan.scenes.forEach((plan, index) => {
    const a = opts.audio[index] ?? {};
    const narrDur = a.narration?.duration ?? estimateSpeech(plan.narration, plan.delivery) * pace;
    const dlgDur = plan.dialogue ? (a.dialogue?.duration ?? estimateSpeech(plan.dialogue.line) * pace) : 0;
    const gap = plan.dialogue ? 0.2 : 0;
    // A beat of silence before major revelations.
    const pause = plan.pauseBefore ? REVEAL_PAUSE : 0;
    const duration = Math.max(MIN_SCENE, pause + narrDur + gap + dlgDur + SCENE_PAD);
    const start = t;
    const speak = start + 0.1 + pause;

    if (a.narration) audio.push({ url: a.narration.url, start: speak, duration: a.narration.duration, kind: "narration" });
    captions.push(...captionChunks(plan.narration, speak, narrDur));

    let dialogueWindow: TimelineScene["dialogueWindow"];
    if (plan.dialogue) {
      const ds = speak + narrDur + gap;
      dialogueWindow = { start: ds, end: ds + dlgDur + 0.3 };
      if (a.dialogue) audio.push({ url: a.dialogue.url, start: ds, duration: a.dialogue.duration, kind: "dialogue" });
    }

    // Impacts land with the revelation; other cues open the scene.
    plan.sfx.forEach((kind, i) => sfx.push({ kind, at: (kind === "impact" ? speak - 0.05 : start + 0.15) + i * 0.6 }));

    scenes.push({ index, start, duration, plan, seed: hashString(plan.narration + index), dialogueWindow, pause });
    t += duration;
  });

  // Open loops cut almost immediately after the last line.
  const abrupt = opts.plan.sheet?.endingType === "open_loop";
  const duration = Math.ceil((t + (abrupt ? 0.15 : 0.6)) * fps) / fps;

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
    // Open loops cut abruptly to black instead of fading out.
    abruptEnd: abrupt,
  };
}

export function sceneAt(tl: Timeline, time: number): TimelineScene {
  for (let i = tl.scenes.length - 1; i >= 0; i--) if (time >= tl.scenes[i].start) return tl.scenes[i];
  return tl.scenes[0];
}

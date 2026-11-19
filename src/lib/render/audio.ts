/**
 * Offline audio mix: narration + dialogue clips, a procedurally composed music
 * bed (original, generated per video) and synthesized sound effects.
 */
import type { Beat, EnvironmentKind, MusicMood, SfxKind, TimeOfDay, Timeline } from "@/lib/engine/types";
import { hashString, rng } from "@/lib/engine/rng";

export const SAMPLE_RATE = 48000;

const MOODS: Record<MusicMood, { bpm: number; root: number; prog: number[][]; wave: OscillatorType; scale: number[] }> = {
  playful: { bpm: 118, root: 60, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], wave: "square", scale: [0, 2, 4, 7, 9, 12] },
  mysterious: { bpm: 92, root: 57, prog: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], wave: "triangle", scale: [0, 3, 5, 7, 10, 12] },
  epic: { bpm: 104, root: 55, prog: [[0, 3, 7], [8, 12, 15], [10, 14, 17], [7, 11, 14]], wave: "sawtooth", scale: [0, 3, 5, 7, 10, 12] },
  chill: { bpm: 84, root: 62, prog: [[0, 4, 7, 11], [9, 12, 16], [5, 9, 12, 16], [7, 11, 14]], wave: "sine", scale: [0, 2, 4, 7, 9, 12] },
  tense: { bpm: 126, root: 52, prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [6, 10, 13]], wave: "sawtooth", scale: [0, 1, 3, 7, 8, 12] },
};

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  const r = rng(7);
  for (let i = 0; i < d.length; i++) d[i] = r.next() * 2 - 1;
  return b;
}

function envNote(ctx: BaseAudioContext, dest: AudioNode, freq: number, at: number, dur: number, type: OscillatorType, vol: number, attack = 0.01, release = 0.12) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + attack);
  g.gain.setValueAtTime(vol, Math.max(at + attack, at + dur - release));
  g.gain.linearRampToValueAtTime(0, at + dur);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function composeMusic(ctx: BaseAudioContext, dest: AudioNode, mood: MusicMood, duration: number, seed: number) {
  const m = MOODS[mood];
  const r = rng(seed);
  const beat = 60 / m.bpm;
  const bar = beat * 4;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = mood === "chill" ? 1800 : 2600;
  lp.connect(dest);
  const noise = noiseBuffer(ctx, 0.3);
  const melodyEvery = r.int(1, 2);
  for (let b = 0, t = 0; t < duration; b++, t += bar) {
    const chord = m.prog[b % m.prog.length];
    // pad
    for (const n of chord) envNote(ctx, lp, hz(m.root + n - 12), t, bar, "triangle", 0.05, 0.3, 0.4);
    // bass
    for (let i = 0; i < 4; i++) envNote(ctx, lp, hz(m.root + chord[0] - 24), t + i * beat, beat * 0.9, "sine", 0.16, 0.01, 0.1);
    // plucks / melody
    if (b % melodyEvery === 0)
      for (let i = 0; i < 8; i++) {
        if (r.next() < 0.35) continue;
        const n = m.scale[r.int(0, m.scale.length - 1)];
        envNote(ctx, lp, hz(m.root + chord[0] % 12 + n), t + i * beat * 0.5, beat * 0.4, m.wave, m.wave === "sine" ? 0.06 : 0.025, 0.005, 0.15);
      }
    // drums
    for (let i = 0; i < 4; i++) {
      const at = t + i * beat;
      if (mood !== "chill" || i % 2 === 0) {
        const k = ctx.createOscillator();
        const kg = ctx.createGain();
        k.frequency.setValueAtTime(140, at);
        k.frequency.exponentialRampToValueAtTime(40, at + 0.15);
        kg.gain.setValueAtTime(0.32, at);
        kg.gain.exponentialRampToValueAtTime(0.001, at + 0.2);
        k.connect(kg).connect(dest);
        k.start(at);
        k.stop(at + 0.22);
      }
      for (const off of [0, 0.5]) {
        const h = ctx.createBufferSource();
        h.buffer = noise;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 7000;
        const hg = ctx.createGain();
        const ht = at + off * beat;
        hg.gain.setValueAtTime(0.05, ht);
        hg.gain.exponentialRampToValueAtTime(0.001, ht + 0.05);
        h.connect(hp).connect(hg).connect(dest);
        h.start(ht);
        h.stop(ht + 0.06);
      }
      if (i % 2 === 1 && mood !== "chill") {
        const sn = ctx.createBufferSource();
        sn.buffer = noise;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1800;
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.18, at);
        sg.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
        sn.connect(bp).connect(sg).connect(dest);
        sn.start(at);
        sn.stop(at + 0.18);
      }
    }
  }
}

function sfx(ctx: BaseAudioContext, dest: AudioNode, kind: SfxKind, at: number) {
  const noise = noiseBuffer(ctx, 1.5);
  const sweep = (f0: number, f1: number, dur: number, type: OscillatorType, vol: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + dur + 0.02);
  };
  const burst = (dur: number, f: number, type: BiquadFilterType, vol: number, start = at) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    s.connect(flt).connect(g).connect(dest);
    s.start(start);
    s.stop(start + dur);
  };
  switch (kind) {
    case "pop": sweep(900, 200, 0.09, "sine", 0.5); break;
    case "whoosh": {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 2;
      f.frequency.setValueAtTime(300, at);
      f.frequency.exponentialRampToValueAtTime(3000, at + 0.45);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, at);
      g.gain.linearRampToValueAtTime(0.5, at + 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.5);
      s.connect(f).connect(g).connect(dest);
      s.start(at);
      s.stop(at + 0.55);
      break;
    }
    case "ding": envNote(ctx, dest, 1568, at, 0.8, "sine", 0.3, 0.005, 0.7); envNote(ctx, dest, 2350, at, 0.5, "sine", 0.12, 0.005, 0.45); break;
    case "boing": sweep(180, 620, 0.35, "triangle", 0.4); break;
    case "coins":
      for (let i = 0; i < 6; i++) envNote(ctx, dest, 2000 + (i % 3) * 400, at + i * 0.07, 0.14, "square", 0.06, 0.002, 0.1);
      break;
    case "magic":
      for (let i = 0; i < 8; i++) envNote(ctx, dest, hz(72 + [0, 4, 7, 11, 12, 16, 19, 24][i]), at + i * 0.06, 0.4, "sine", 0.1, 0.005, 0.35);
      break;
    case "thud": sweep(120, 35, 0.3, "sine", 0.7); burst(0.12, 400, "lowpass", 0.4); break;
    case "alarm": for (let i = 0; i < 4; i++) envNote(ctx, dest, i % 2 ? 660 : 880, at + i * 0.22, 0.2, "square", 0.08); break;
    case "cheer": burst(1.4, 1200, "bandpass", 0.35); break;
    case "heartbeat": sweep(70, 40, 0.15, "sine", 0.8); { const t2 = at + 0.25; const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.setValueAtTime(65, t2); o.frequency.exponentialRampToValueAtTime(38, t2 + 0.15); g.gain.setValueAtTime(0.6, t2); g.gain.exponentialRampToValueAtTime(0.001, t2 + 0.18); o.connect(g).connect(dest); o.start(t2); o.stop(t2 + 0.2); } break;
    case "record_scratch": sweep(1400, 160, 0.35, "sawtooth", 0.18); burst(0.3, 2000, "bandpass", 0.25); break;
    case "drumroll": for (let i = 0; i < 18; i++) burst(0.05, 1600, "bandpass", 0.08 + i * 0.006, at + i * 0.05); break;
    case "impact":
      sweep(90, 28, 1.1, "sine", 0.95);
      burst(0.5, 300, "lowpass", 0.6);
      burst(0.12, 2500, "bandpass", 0.25);
      break;
    case "knock":
      for (const off of [0, 0.22, 0.44]) {
        burst(0.07, 520, "bandpass", 0.7, at + off);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 140;
        g.gain.setValueAtTime(0.4, at + off);
        g.gain.exponentialRampToValueAtTime(0.001, at + off + 0.09);
        o.connect(g).connect(dest);
        o.start(at + off);
        o.stop(at + off + 0.1);
      }
      break;
    case "footsteps":
      for (let i = 0; i < 6; i++) burst(0.06, 380, "lowpass", 0.5, at + i * 0.34);
      break;
    case "door_creak": {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(70, at);
      for (let i = 1; i <= 12; i++) o.frequency.linearRampToValueAtTime(70 + (i % 2 ? 40 : 10) + i * 4, at + i * 0.09);
      f.type = "bandpass";
      f.frequency.value = 900;
      f.Q.value = 4;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.16, at + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, at + 1.1);
      o.connect(f).connect(g).connect(dest);
      o.start(at);
      o.stop(at + 1.15);
      break;
    }
    case "glitch": {
      const r = rng(Math.floor(at * 1000));
      for (let i = 0; i < 9; i++) envNote(ctx, dest, 200 + r.next() * 1800, at + i * 0.045 + r.next() * 0.02, 0.035, "square", 0.08, 0.001, 0.02);
      break;
    }
  }
}

export async function decodeClips(urls: string[]): Promise<Map<string, AudioBuffer>> {
  const ctx = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const out = new Map<string, AudioBuffer>();
  await Promise.all(
    urls.map(async (u) => {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`Could not load audio clip (${res.status})`);
      out.set(u, await ctx.decodeAudioData(await res.arrayBuffer()));
    }),
  );
  return out;
}

/* ---------------- Sound identity ---------------- */

/** The signature sting that opens every video — the same in all of them. */
function signatureSting(ctx: BaseAudioContext, dest: AudioNode) {
  const notes = [69, 72, 76, 81];
  notes.forEach((n, i) => envNote(ctx, dest, hz(n), 0.02 + i * 0.09, 0.9 - i * 0.12, "triangle", 0.12, 0.005, 0.5));
  envNote(ctx, dest, hz(45), 0.02, 1.2, "sine", 0.4, 0.01, 0.9);
}

/** How loud the music bed sits during each story beat. */
const BEAT_LEVEL: Record<Beat, number> = {
  hook: 0.7, rule: 0.38, character: 0.42, escalation_1: 0.48, escalation_2: 0.58, escalation_3: 0.68,
  discovery: 0.16, twist: 0.6, cliffhanger: 0.45, continuation: 0.3,
};
/** Low drone that carries rising tension. */
const TENSION: Partial<Record<Beat, number>> = { escalation_2: 0.25, escalation_3: 0.45, discovery: 0.2, cliffhanger: 0.6, continuation: 0.7 };

type Amb = { kind: "wind" | "birds" | "crickets" | "murmur" | "waves" | "room" | "crowd"; level: number };
function ambienceFor(env: EnvironmentKind, time: TimeOfDay): Amb {
  if (env === "beach") return { kind: "waves", level: 0.5 };
  if (env === "stage") return { kind: "crowd", level: 0.25 };
  if (env === "school_hall" || env === "office" || env === "store") return { kind: "murmur", level: 0.22 };
  if (env === "bedroom") return { kind: time === "night" ? "crickets" : "room", level: 0.2 };
  if (time === "night") return { kind: "crickets", level: 0.3 };
  if (env === "park" || env === "forest") return { kind: "birds", level: 0.3 };
  return { kind: "wind", level: 0.3 };
}

function ambience(ctx: BaseAudioContext, dest: AudioNode, amb: Amb, from: number, to: number, seed: number) {
  const len = to - from;
  if (len <= 0.05) return;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, from);
  g.gain.linearRampToValueAtTime(amb.level, from + Math.min(0.4, len / 3));
  g.gain.setValueAtTime(amb.level, Math.max(from, to - 0.25));
  g.gain.linearRampToValueAtTime(0.0001, to);
  g.connect(dest);
  const noise = () => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 2);
    src.loop = true;
    src.start(from);
    src.stop(to);
    return src;
  };
  const r = rng(seed);
  if (amb.kind === "wind" || amb.kind === "waves" || amb.kind === "room" || amb.kind === "murmur" || amb.kind === "crowd") {
    const f = ctx.createBiquadFilter();
    f.type = amb.kind === "murmur" || amb.kind === "crowd" ? "bandpass" : "lowpass";
    f.frequency.value = amb.kind === "wind" ? 500 : amb.kind === "waves" ? 700 : amb.kind === "room" ? 220 : 650;
    f.Q.value = amb.kind === "murmur" || amb.kind === "crowd" ? 0.8 : 0.5;
    const lfo = ctx.createGain();
    const swell = amb.kind === "waves" ? 0.12 : 0.6;
    for (let t = from; t < to; t += 0.25) lfo.gain.linearRampToValueAtTime(0.55 + 0.45 * Math.sin((t - from) * Math.PI * 2 * swell + seed), t);
    noise().connect(f).connect(lfo).connect(g);
  } else if (amb.kind === "birds") {
    for (let t = from + r.next(); t < to; t += 0.6 + r.next() * 1.4) {
      const base = 2400 + r.next() * 1800;
      for (let k = 0; k < 2 + r.int(0, 2); k++) envNote(ctx, g, base + r.next() * 400, t + k * 0.08, 0.06, "sine", 0.12, 0.004, 0.04);
    }
  } else if (amb.kind === "crickets") {
    for (let t = from + r.next() * 0.3; t < to; t += 0.5 + r.next() * 0.4)
      for (let k = 0; k < 3; k++) envNote(ctx, g, 4200 + r.next() * 300, t + k * 0.05, 0.03, "square", 0.025, 0.002, 0.02);
  }
}

export async function mixTimelineAudio(tl: Timeline, clips: Map<string, AudioBuffer>): Promise<AudioBuffer> {
  const length = Math.ceil(tl.duration * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(2, length, SAMPLE_RATE);
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -14;
  master.ratio.value = 3;
  master.connect(ctx.destination);

  // Music bed follows the story beat, ducks under the voice, and drops to
  // silence right before a revelation.
  const musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(master);
  const ambGain = ctx.createGain();
  ambGain.connect(master);
  const voiceAt = (t: number) => tl.audio.some((c) => t >= c.start - 0.08 && t <= c.start + c.duration + 0.1);
  const sceneAt = (t: number) => {
    for (let i = tl.scenes.length - 1; i >= 0; i--) if (t >= tl.scenes[i].start) return tl.scenes[i];
    return tl.scenes[0];
  };
  const silentAt = (t: number) => {
    const s = sceneAt(t);
    return !!s.pause && t >= s.start && t < s.start + 0.1 + s.pause - 0.02;
  };
  const drone = ctx.createOscillator();
  const droneGain = ctx.createGain();
  const droneFilter = ctx.createBiquadFilter();
  drone.type = "sawtooth";
  drone.frequency.value = 55;
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 240;
  droneGain.gain.value = 0;
  drone.connect(droneFilter).connect(droneGain).connect(master);
  drone.start(0);
  drone.stop(tl.duration);

  for (let t = 0; t <= tl.duration; t += 0.05) {
    const s = sceneAt(t);
    const beat = s.plan.beat;
    const silent = silentAt(t);
    const level = beat ? BEAT_LEVEL[beat] : 0.55;
    const music = silent ? 0 : level * (voiceAt(t) ? 0.45 : 1);
    musicGain.gain.linearRampToValueAtTime(music, t);
    const u = (t - s.start) / s.duration;
    const tension = beat ? (TENSION[beat] ?? 0) : 0;
    droneGain.gain.linearRampToValueAtTime(silent ? 0 : tension * 0.09 * (beat === "cliffhanger" || beat === "continuation" ? 0.5 + u : 1), t);
    if (beat === "cliffhanger" || beat === "continuation") drone.frequency.linearRampToValueAtTime(55 + u * 30, t);
    ambGain.gain.linearRampToValueAtTime(silent ? 0 : 1, t);
  }
  composeMusic(ctx, musicGain, tl.musicMood, tl.duration, hashString(tl.title));
  signatureSting(ctx, master);
  tl.scenes.forEach((s, i) => ambience(ctx, ambGain, ambienceFor(s.plan.environment, s.plan.timeOfDay), s.start, s.start + s.duration, s.seed + i));

  const fx = ctx.createGain();
  fx.gain.value = 0.75;
  fx.connect(master);
  for (const cue of tl.sfx) sfx(ctx, fx, cue.kind, cue.at);

  const voice = ctx.createGain();
  voice.gain.value = 1.35;
  voice.connect(master);
  for (const c of tl.audio) {
    const buf = clips.get(c.url);
    if (!buf) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(voice);
    src.start(c.start);
  }

  const out = await ctx.startRendering();
  // Click-free edges. Open loops end on a hard cut, everything else fades.
  const fadeIn = Math.floor(0.02 * SAMPLE_RATE);
  const fadeOut = Math.floor((tl.abruptEnd ? 0.02 : 0.4) * SAMPLE_RATE);
  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const d = out.getChannelData(ch);
    for (let i = 0; i < fadeIn && i < d.length; i++) d[i] *= i / fadeIn;
    for (let i = 0; i < fadeOut && i < d.length; i++) d[d.length - 1 - i] *= i / fadeOut;
  }
  return out;
}

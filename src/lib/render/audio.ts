/**
 * Offline audio mix: narration + dialogue clips, a procedurally composed music
 * bed (original, generated per video) and synthesized sound effects.
 */
import type { MusicMood, SfxKind, Timeline } from "@/lib/engine/types";
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

export async function mixTimelineAudio(tl: Timeline, clips: Map<string, AudioBuffer>): Promise<AudioBuffer> {
  const length = Math.ceil(tl.duration * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(2, length, SAMPLE_RATE);
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -14;
  master.ratio.value = 3;
  master.connect(ctx.destination);

  const musicGain = ctx.createGain();
  musicGain.gain.value = 0.55;
  musicGain.connect(master);
  // Duck music under voice.
  for (const c of tl.audio) {
    musicGain.gain.setTargetAtTime(0.22, Math.max(0, c.start - 0.1), 0.08);
    musicGain.gain.setTargetAtTime(0.55, c.start + c.duration + 0.1, 0.25);
  }
  composeMusic(ctx, musicGain, tl.musicMood, tl.duration, hashString(tl.title));

  const fx = ctx.createGain();
  fx.gain.value = 0.7;
  fx.connect(master);
  for (const cue of tl.sfx) sfx(ctx, fx, cue.kind, cue.at);

  const voice = ctx.createGain();
  voice.gain.value = 1.35;
  voice.connect(master);
  for (const c of tl.audio) {
    const buf = clips.get(c.url);
    if (!buf) continue;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(voice);
    s.start(c.start);
  }

  // Master fade in/out.
  const out = await ctx.startRendering();
  const fade = Math.floor(0.4 * SAMPLE_RATE);
  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const d = out.getChannelData(ch);
    for (let i = 0; i < fade && i < d.length; i++) {
      d[i] *= i / fade;
      d[d.length - 1 - i] *= i / fade;
    }
  }
  return out;
}

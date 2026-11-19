"use client";
/**
 * Kokoro text-to-speech in the browser (Apache-2.0 model, ~90 MB q8 ONNX,
 * downloaded from Hugging Face once and then cached by the browser).
 * The library's self-contained web build is served from /vendor so it stays
 * out of the app bundle and only loads when narration is needed.
 */
type RawAudio = { audio: Float32Array; sampling_rate: number };
type TTS = { generate(text: string, opts: { voice: string; speed?: number }): Promise<RawAudio> };

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
let ttsP: Promise<TTS> | null = null;

export function loadKokoro(onProgress?: (fraction: number) => void): Promise<TTS> {
  ttsP ??= (async () => {
    const url = "/vendor/kokoro-1.2.1.web.js";
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as {
      KokoroTTS: { from_pretrained(id: string, o: Record<string, unknown>): Promise<TTS> };
    };
    const files = new Map<string, { loaded: number; total: number }>();
    return mod.KokoroTTS.from_pretrained(MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== "progress" || !p.file || !p.total) return;
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
        const all = [...files.values()];
        onProgress?.(all.reduce((a, f) => a + f.loaded, 0) / Math.max(1, all.reduce((a, f) => a + f.total, 0)));
      },
    });
  })().catch((e) => {
    ttsP = null; // allow a later retry
    throw e;
  });
  return ttsP;
}

/** 16-bit PCM mono WAV with a standard 44-byte header (the server reads durations from it). */
export function toWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([buf], { type: "audio/wav" });
}

/** Trims near-silence from both ends so scene timing follows the words. */
export function trimSilence(samples: Float32Array, rate: number, threshold = 0.004): Float32Array {
  const pad = Math.round(rate * 0.06);
  let a = 0, b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < threshold) a++;
  while (b > a && Math.abs(samples[b]) < threshold) b--;
  return samples.subarray(Math.max(0, a - pad), Math.min(samples.length, b + pad));
}

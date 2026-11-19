/**
 * In-browser MP4 export using WebCodecs (H.264 + AAC/Opus) and mp4-muxer.
 * Produces a real, standards-compliant MP4 file.
 */
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { Timeline } from "@/lib/engine/types";
import { TimelineRenderer, loadCaptionFont } from "./renderer";
import { decodeClips, mixTimelineAudio, SAMPLE_RATE } from "./audio";

export interface EncodeProgress {
  phase: "audio" | "previews" | "frames" | "finalizing";
  framesDone: number;
  framesTotal: number;
}

export interface EncodeResult {
  mp4: Blob;
  thumbnail: Blob;
  durationSec: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string;
}

/** True when this browser can encode the formats we export (H.264 + AAC/Opus in MP4). */
export async function canEncodeMp4() {
  if (!webCodecsAvailable()) return false;
  try {
    for (const [w, h] of [[720, 1280], [1080, 1920]]) await pickVideoCodec(w, h, 30);
    await pickAudioCodec();
    return true;
  } catch {
    return false;
  }
}

export function webCodecsAvailable() {
  return typeof window !== "undefined" && "VideoEncoder" in window && "AudioEncoder" in window && "VideoFrame" in window;
}

async function pickVideoCodec(width: number, height: number, fps: number) {
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42003e", "avc1.640033"]) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate: height >= 1920 ? 5_000_000 : 2_500_000, framerate: fps, avc: { format: "avc" } };
    const s = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (s?.supported) return config;
  }
  throw new Error("This browser can't encode H.264 video. Use a recent Chrome, Edge or Safari.");
}

async function pickAudioCodec(): Promise<{ config: AudioEncoderConfig; muxCodec: "aac" | "opus" }> {
  const aac: AudioEncoderConfig = { codec: "mp4a.40.2", sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 160_000 };
  if ((await AudioEncoder.isConfigSupported(aac).catch(() => null))?.supported) return { config: aac, muxCodec: "aac" };
  const opus: AudioEncoderConfig = { codec: "opus", sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 128_000 };
  if ((await AudioEncoder.isConfigSupported(opus).catch(() => null))?.supported) return { config: opus, muxCodec: "opus" };
  throw new Error("This browser can't encode audio for MP4.");
}

const frame = () => new Promise((r) => setTimeout(r, 0));

export async function renderTimelineToMp4(
  tl: Timeline,
  opts: {
    onProgress?: (p: EncodeProgress) => void;
    /** Called with a JPEG still of each scene as soon as it's rendered. */
    onScenePreview?: (sceneIndex: number, jpeg: Blob) => void | Promise<void>;
    signal?: AbortSignal;
  } = {},
): Promise<EncodeResult> {
  if (!webCodecsAvailable()) throw new Error("This browser doesn't support WebCodecs video encoding.");
  await loadCaptionFont();
  const { width, height, fps } = tl;
  const totalFrames = Math.round(tl.duration * fps);

  opts.onProgress?.({ phase: "audio", framesDone: 0, framesTotal: totalFrames });
  const clips = await decodeClips([...new Set(tl.audio.map((a) => a.url))]);
  const mix = await mixTimelineAudio(tl, clips);

  const vconf = await pickVideoCodec(width, height, fps);
  const aconf = await pickAudioCodec();

  const canvas = document.createElement("canvas");
  const renderer = new TimelineRenderer(tl, canvas);

  try {
    // Scene previews first, so the progress screen can show real stills early.
    if (opts.onScenePreview) {
      opts.onProgress?.({ phase: "previews", framesDone: 0, framesTotal: totalFrames });
      for (const s of tl.scenes) {
        if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        renderer.renderAt(s.start + Math.min(s.duration * 0.55, s.duration - 0.2));
        const jpeg = await canvasJpeg(canvas, 0.72, 360);
        await opts.onScenePreview(s.index, jpeg);
        await frame();
      }
    }

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: "avc", width, height, frameRate: fps },
      audio: { codec: aconf.muxCodec, sampleRate: SAMPLE_RATE, numberOfChannels: 2 },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });

    let encodeError: unknown = null;
    const ve = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (encodeError = e) });
    ve.configure(vconf);
    const ae = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => (encodeError = e) });
    ae.configure(aconf.config);

    // Audio
    const block = 1024;
    const L = mix.getChannelData(0), R = mix.getChannelData(1);
    for (let i = 0; i < mix.length; i += block) {
      const n = Math.min(block, mix.length - i);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(i, i + n), 0);
      data.set(R.subarray(i, i + n), n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: SAMPLE_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / SAMPLE_RATE) * 1e6), data });
      ae.encode(ad);
      ad.close();
    }

    // Video
    let thumbnail: Blob | null = null;
    const thumbAt = Math.min(tl.duration - 0.1, (tl.scenes[0]?.duration ?? 2) * 0.6 + (tl.scenes[0]?.start ?? 0));
    let lastReport = 0;
    for (let i = 0; i < totalFrames; i++) {
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (encodeError) throw encodeError;
      const t = i / fps;
      renderer.renderAt(t);
      const vf = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / fps) });
      ve.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      if (!thumbnail && t >= thumbAt) thumbnail = await canvasJpeg(canvas, 0.82, 540);
      while (ve.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
      const now = performance.now();
      if (now - lastReport > 250 || i === totalFrames - 1) {
        lastReport = now;
        opts.onProgress?.({ phase: "frames", framesDone: i + 1, framesTotal: totalFrames });
        await frame();
      }
    }
    opts.onProgress?.({ phase: "finalizing", framesDone: totalFrames, framesTotal: totalFrames });
    await ve.flush();
    await ae.flush();
    if (encodeError) throw encodeError;
    ve.close();
    ae.close();
    muxer.finalize();
    const mp4 = new Blob([target.buffer], { type: "video/mp4" });
    return {
      mp4,
      thumbnail: thumbnail ?? (await canvasJpeg(canvas, 0.82, 540)),
      durationSec: totalFrames / fps,
      width,
      height,
      videoCodec: vconf.codec,
      audioCodec: aconf.config.codec,
    };
  } finally {
    renderer.dispose();
  }
}

async function canvasJpeg(src: HTMLCanvasElement, quality: number, targetWidth: number): Promise<Blob> {
  const scale = Math.min(1, targetWidth / src.width);
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not create image"))), "image/jpeg", quality));
}

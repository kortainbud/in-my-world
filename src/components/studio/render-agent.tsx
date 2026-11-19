"use client";
/**
 * Browser render agent. While the studio is open, it asks the server for jobs
 * that are ready to render, renders them with the in-browser engine, uploads
 * real scene previews and the finished MP4, and reports real frame progress.
 * The server owns job state; this agent only holds a short lease.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Timeline } from "@/lib/engine/types";
import { api, ApiError } from "@/lib/client/api";
import { KOKORO_SPEED } from "@/lib/engine/voices";

interface Job {
  jobId: string;
  projectId: string;
  title: string;
  timeline: Timeline;
  /** Narration to record in this browser before rendering. */
  voice: { clips: { scene: number; kind: "n" | "d"; text: string; voice: string; delivery: string }[] } | null;
}

interface AgentState {
  supported: boolean | null;
  jobId: string | null;
  projectId: string | null;
  phase: string | null;
  framesDone: number;
  framesTotal: number;
  error: string | null;
}

const Ctx = createContext<AgentState>({ supported: null, jobId: null, projectId: null, phase: null, framesDone: 0, framesTotal: 0, error: null });
export const useRenderAgent = () => useContext(Ctx);

export function RenderAgentProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [state, setState] = useState<AgentState>({ supported: null, jobId: null, projectId: null, phase: null, framesDone: 0, framesTotal: 0, error: null });
  const agentId = useRef<string>("");
  const busy = useRef(false);

  useEffect(() => {
    agentId.current = crypto.randomUUID();
    import("@/lib/render/encode")
      .then((m) => m.canEncodeMp4())
      .then((supported) => setState((s) => ({ ...s, supported: supported && "OfflineAudioContext" in window })))
      .catch(() => setState((s) => ({ ...s, supported: false })));
  }, []);

  useEffect(() => {
    if (!enabled || !state.supported) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const loop = async () => {
      if (stopped) return;
      if (!busy.current) {
        try {
          const { job } = await api<{ job: Job | null }>("/api/render/claim", { method: "POST", json: { agentId: agentId.current } });
          if (job) await render(job);
        } catch {
          /* network blip — try again next tick */
        }
      }
      timer = setTimeout(loop, 3000);
    };

    /**
     * Records the narration with Kokoro in this browser, uploads the clips,
     * and gets back a timeline re-timed to the real speech. If recording
     * fails, the video continues with captions and music only.
     */
    const narrate = async (job: Job, ctrl: AbortController): Promise<Timeline> => {
      const signal = ctrl.signal;
      const id = agentId.current;
      const clips = job.voice!.clips;
      const report = (done: number) =>
        api(`/api/render/${job.jobId}/progress`, { method: "POST", json: { agentId: id, phase: "voice", framesDone: done, framesTotal: clips.length } }).catch((e) => {
          if (e instanceof ApiError && e.status === 409) ctrl.abort();
        });
      setState((s) => ({ ...s, phase: "voice", framesDone: 0, framesTotal: clips.length }));
      let done = 0;
      // Keeps the render lease alive while the voice model downloads.
      const keepAlive = setInterval(() => void report(done), 10_000);
      try {
        const { uploads } = await api<{ uploads: { scene: number; kind: "n" | "d"; signedUrl: string }[] }>(`/api/render/${job.jobId}/narration`, { method: "PUT", json: { agentId: id } });
        const { loadKokoro, toWav, trimSilence } = await import("@/lib/client/kokoro");
        void report(0);
        const tts = await loadKokoro((f) => setState((s) => ({ ...s, phase: f < 1 ? "voice-download" : "voice", framesDone: Math.round(f * 100), framesTotal: 100 })));
        for (const c of clips) {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          const out = await tts.generate(c.text, { voice: c.voice, speed: KOKORO_SPEED[c.delivery] ?? 1 });
          const wav = toWav(trimSilence(out.audio, out.sampling_rate), out.sampling_rate);
          const target = uploads.find((u) => u.scene === c.scene && u.kind === c.kind);
          if (!target) throw new Error("No upload slot for a narration clip.");
          const r = await fetch(target.signedUrl, { method: "PUT", headers: { "content-type": "audio/wav", "x-upsert": "true" }, body: wav, signal });
          if (!r.ok) throw new Error(`Narration upload failed (${r.status})`);
          done++;
          setState((s) => ({ ...s, phase: "voice", framesDone: done, framesTotal: clips.length }));
          void report(done);
        }
        const { timeline } = await api<{ timeline: Timeline }>(`/api/render/${job.jobId}/narration`, { method: "POST", json: { agentId: id } });
        return timeline;
      } catch (e) {
        clearInterval(keepAlive);
        if ((e instanceof DOMException && e.name === "AbortError") || (e instanceof ApiError && e.status === 409)) throw e;
        const reason = e instanceof Error ? e.message : "unknown error";
        console.warn("[render-agent] narration failed, continuing with captions only:", reason);
        const { timeline } = await api<{ timeline: Timeline }>(`/api/render/${job.jobId}/narration`, { method: "POST", json: { agentId: id, skipped: reason || "unknown error" } });
        return timeline;
      } finally {
        clearInterval(keepAlive);
      }
    };
    const render = async (job: Job) => {
      busy.current = true;
      const ctrl = new AbortController();
      setState((s) => ({ ...s, jobId: job.jobId, projectId: job.projectId, phase: "audio", framesDone: 0, framesTotal: 0, error: null }));
      let lastSent = 0;
      const id = agentId.current;
      const { renderTimelineToMp4 } = await import("@/lib/render/encode");
      try {
        const timeline = job.voice ? await narrate(job, ctrl) : job.timeline;
        const res = await renderTimelineToMp4(timeline, {
          signal: ctrl.signal,
          onProgress: (p) => {
            setState((s) => ({ ...s, phase: p.phase, framesDone: p.framesDone, framesTotal: p.framesTotal }));
            const now = performance.now();
            if (now - lastSent > 900 || p.phase === "finalizing") {
              lastSent = now;
              api(`/api/render/${job.jobId}/progress`, { method: "POST", json: { agentId: id, ...p } }).catch((e) => {
                if (e instanceof ApiError && e.status === 409) ctrl.abort();
              });
            }
          },
          onScenePreview: async (scene, jpeg) => {
            await fetch(`/api/render/${job.jobId}/preview?scene=${scene}`, { method: "POST", headers: { "x-render-agent": id, "content-type": "image/jpeg" }, body: jpeg });
          },
        });
        setState((s) => ({ ...s, phase: "uploading" }));
        // Upload straight to storage (large files skip the server), then ask the server to verify.
        const up = await api<{ videoId: string; video: { signedUrl: string }; thumb: { signedUrl: string } }>(`/api/render/${job.jobId}/upload-urls`, { method: "POST", json: { agentId: id } });
        const put = async (url: string, blob: Blob, type: string) => {
          const r = await fetch(url, { method: "PUT", headers: { "content-type": type, "x-upsert": "true" }, body: blob, signal: ctrl.signal });
          if (!r.ok) throw new Error(`Upload failed (${r.status})`);
        };
        await put(up.video.signedUrl, res.mp4, "video/mp4");
        await put(up.thumb.signedUrl, res.thumbnail, "image/jpeg");
        await api(`/api/render/${job.jobId}/complete`, {
          method: "POST",
          json: { agentId: id, videoId: up.videoId, width: res.width, height: res.height, durationSec: res.durationSec, videoCodec: res.videoCodec, audioCodec: res.audioCodec },
        });
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        const message = e instanceof Error ? e.message : "Unknown error";
        if (!aborted) {
          setState((s) => ({ ...s, error: message }));
          await api(`/api/render/${job.jobId}/fail`, { method: "POST", json: { agentId: id, message, retryable: true } }).catch(() => undefined);
        }
      } finally {
        busy.current = false;
        setState((s) => ({ ...s, jobId: null, projectId: null, phase: null }));
      }
    };

    void loop();
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (busy.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [enabled, state.supported]);

  return <Ctx value={state}>{children}</Ctx>;
}

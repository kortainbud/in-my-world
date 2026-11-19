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
          const { job } = await api<{ job: { jobId: string; projectId: string; title: string; timeline: Timeline } | null }>("/api/render/claim", { method: "POST", json: { agentId: agentId.current } });
          if (job) await render(job);
        } catch {
          /* network blip — try again next tick */
        }
      }
      timer = setTimeout(loop, 3000);
    };

    const render = async (job: { jobId: string; projectId: string; timeline: Timeline }) => {
      busy.current = true;
      const ctrl = new AbortController();
      setState((s) => ({ ...s, jobId: job.jobId, projectId: job.projectId, phase: "audio", framesDone: 0, framesTotal: 0, error: null }));
      let lastSent = 0;
      const id = agentId.current;
      const { renderTimelineToMp4 } = await import("@/lib/render/encode");
      try {
        const res = await renderTimelineToMp4(job.timeline, {
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

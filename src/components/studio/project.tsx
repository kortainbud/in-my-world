"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { STYLE_LABELS } from "@/config/site";
import { api, ApiError, fmtDuration, timeAgo } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import type { ProjectView } from "@/lib/server/views";
import { btn, Button, LinkButton, Modal, Notice, Spinner, StyleTag, Tag } from "@/components/ui";
import { useRenderAgent } from "./render-agent";
import { FORMAT_INFO } from "./create";
import { ChecklistPanel, MetricsPanel, SeriesStrip, StorySheetPanel } from "./story-panels";
import { trackShare } from "@/lib/client/track";

const ACTIVE = ["queued", "processing", "awaiting_render", "rendering"];
const PHASE_LABEL: Record<string, string> = { audio: "Mixing audio", previews: "Rendering scene previews", frames: "Rendering frames", finalizing: "Finalizing MP4", uploading: "Uploading MP4" };

export function ProjectScreen({ id }: { id: string }) {
  const [p, setP] = useState<ProjectView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { refresh } = useMe();
  const wasActive = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{ project: ProjectView }>(`/api/projects/${id}`);
      setP(d.project);
      setError(null);
      if (ACTIVE.includes(d.project.status)) wasActive.current = true;
      else if (wasActive.current) {
        wasActive.current = false;
        void refresh();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this project.");
    }
  }, [id, refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = p ? ACTIVE.includes(p.status) : false;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 1200);
    return () => clearInterval(t);
  }, [active, load]);

  // The server prepares the story, cast and timeline while this page asks it to
  // (no background worker, so it runs on serverless hosts). A server lease stops
  // two tabs from running the same job.
  const preparing = !!p?.job && (p.status === "queued" || p.status === "processing");
  const advancing = useRef(false);
  const jobId = p?.job?.id;
  useEffect(() => {
    if (!preparing || !jobId || advancing.current) return;
    advancing.current = true;
    api(`/api/jobs/${jobId}/advance`, { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        advancing.current = false;
        void load();
      });
  }, [preparing, jobId, load]);

  if (error && !p)
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="text-body">{error}</p>
        <LinkButton href="/studio/projects" className="mt-6">
          Back to My Studio
        </LinkButton>
      </div>
    );
  if (!p) return <div className="flex min-h-[50vh] items-center justify-center text-small text-fg-3">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-24 pt-8 sm:px-8 lg:pt-12">
      <Link href="/studio/projects" className="text-small text-fg-2 hover:text-fg">
        ← My Studio
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <StyleTag style={p.style} />
            <StatusTag status={p.status} />
            <Tag>{p.durationPreset}s preset</Tag>
            <Tag>{FORMAT_INFO[p.format].label}{p.episode > 1 || p.series ? ` · Part ${p.episode}` : ""}</Tag>
            {p.visibility === "public" && <Tag tone="accent">Public</Tag>}
          </div>
          <h1 className="text-page font-semibold">{p.status === "queued" || (p.status === "processing" && p.title === "Untitled world") ? "Writing your story…" : p.title}</h1>
          <p className="mt-1 max-w-2xl text-body text-fg-2">“{p.prompt}”</p>
          {p.series && (
            <div className="mt-3">
              <SeriesStrip episodes={p.series.episodes} current={p.id} />
            </div>
          )}
        </div>
        <p className="text-caption text-fg-3">Started {timeAgo(p.createdAt)}</p>
      </div>

      {p.status === "completed" && p.video ? (
        <Finished p={p} onChange={load} onRegenerate={(nid) => router.push(`/studio/projects/${nid}`)} />
      ) : (
        <InProgress p={p} onRetry={load} />
      )}
    </div>
  );
}

function StatusTag({ status }: { status: ProjectView["status"] }) {
  if (status === "completed") return <Tag tone="accent">Completed</Tag>;
  if (status === "failed") return <Tag tone="danger">Failed</Tag>;
  return (
    <Tag tone="warn">
      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-warn" />
      {status === "awaiting_render" ? "Waiting to render" : status === "rendering" ? "Rendering" : "Processing"}
    </Tag>
  );
}

function StageIcon({ status }: { status: string }) {
  if (status === "done")
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-ink">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>
      </span>
    );
  if (status === "running") return <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-accent"><span className="pulse-dot h-2 w-2 rounded-full bg-accent" /></span>;
  if (status === "failed") return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-danger text-caption font-bold text-bg">!</span>;
  if (status === "skipped") return <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-fg-3">–</span>;
  return <span className="h-6 w-6 rounded-full border border-line" />;
}

function InProgress({ p, onRetry }: { p: ProjectView; onRetry: () => void }) {
  const agent = useRenderAgent();
  const { refresh } = useMe();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const job = p.job!;
  const rp = job.renderProgress;
  const renderingHere = agent.projectId === p.id;
  const framesDone = renderingHere ? agent.framesDone : (rp?.framesDone ?? 0);
  const framesTotal = renderingHere ? agent.framesTotal : (rp?.framesTotal ?? 0);
  const renderPhase = renderingHere ? agent.phase : rp?.phase;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-label="Generation progress">
        <ol className="relative">
          {job.stages.map((s, i) => (
            <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
              {i < job.stages.length - 1 && <span aria-hidden className={`absolute left-[11px] top-7 h-[calc(100%-28px)] w-px ${s.status === "done" || s.status === "skipped" ? "bg-[var(--accent-line)]" : "bg-line"}`} />}
              <StageIcon status={s.status} />
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={`text-body font-medium ${s.status === "pending" ? "text-fg-3" : "text-fg"}`}>
                  {s.label}
                  {s.status === "skipped" && <span className="ml-2 text-caption font-normal text-fg-3">skipped</span>}
                </p>
                {s.detail && (
                  <p className={`mt-0.5 text-small ${s.status === "failed" ? "text-[var(--danger-fg)]" : "text-fg-2"}`}>
                    {s.key === "render" && s.status === "running" && renderingHere && agent.phase ? PHASE_LABEL[agent.phase] ?? s.detail : s.detail}
                  </p>
                )}
                {s.key === "render" && s.status === "running" && framesTotal > 0 && renderPhase === "frames" && (
                  <div className="mt-2.5 max-w-md">
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg-3">
                      <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(framesDone / framesTotal) * 100}%` }} />
                    </div>
                    <p className="mt-1.5 font-mono text-micro text-fg-3">
                      frame {framesDone} of {framesTotal}
                    </p>
                  </div>
                )}
                {s.key === "render" && p.status === "awaiting_render" && (
                  <div className="mt-2 max-w-md">
                    {agent.supported === false ? (
                      <Notice tone="warn">This browser can’t encode video (WebCodecs missing). Open In My World in a recent Chrome, Edge or Safari to render it.</Notice>
                    ) : (
                      <p className="text-caption text-fg-3">The renderer in this tab will pick it up in a moment.</p>
                    )}
                  </div>
                )}
                {s.key === "render" && s.status === "running" && (
                  <p className="mt-1.5 text-caption text-fg-3">{renderingHere ? "Rendering in this tab — keep it open." : "Rendering in another tab or window."}</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {p.status === "failed" && (
          <div className="mt-8 space-y-3">
            <Notice tone="danger">
              {job.error ?? "Generation failed."} {job.refunded && <strong className="font-medium">Your {job.creditCost} credits were refunded.</strong>}
            </Notice>
            {retryError && <Notice tone="danger">{retryError}</Notice>}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  setRetryError(null);
                  try {
                    await api(`/api/projects/${p.id}/retry`, { method: "POST" });
                    void refresh();
                    onRetry();
                  } catch (e) {
                    setRetryError(e instanceof ApiError ? e.message : "Couldn't retry.");
                  } finally {
                    setRetrying(false);
                  }
                }}
              >
                {retrying ? <Spinner /> : null} Try again ({job.creditCost} credits)
              </Button>
              <LinkButton href={`/studio?prompt=${encodeURIComponent(p.prompt)}&style=${p.style}`}>Edit the idea</LinkButton>
            </div>
          </div>
        )}

        <p className="mt-8 text-caption text-fg-3">
          Engine: {job.engine.story} · {job.engine.voice} · {job.engine.render} · {job.exportHeight}p{job.watermark ? " with watermark" : ""} · {job.creditCost} credits
          {job.attempts > 1 && ` · attempt ${job.attempts} of ${job.maxAttempts}`}
        </p>
      </section>

      <aside className="space-y-6">
        <div>
          <p className="eyebrow mb-3">Scene previews</p>
          {job.previews.length ? (
            <div className="grid grid-cols-3 gap-2">
              {job.previews.map((pv) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={pv.scene} src={pv.url} alt={`Scene ${pv.scene + 1}`} className="rise aspect-[9/16] w-full rounded-[12px] border border-line-soft object-cover" />
              ))}
            </div>
          ) : (
            <p className="rounded-[12px] border border-line px-4 py-8 text-center text-caption text-fg-3">Stills of each scene appear here as the renderer reaches them.</p>
          )}
        </div>
        {p.story && (
          <div>
            <p className="eyebrow mb-3">Script</p>
            <ol className="space-y-2.5">
              {p.story.scenes.map((s, i) => (
                <li key={i} className="rise flex gap-3 text-small" style={{ animationDelay: `${i * 40}ms` }}>
                  <span className="w-5 shrink-0 font-mono text-micro leading-5 text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                  <span className="leading-snug text-fg-2">{s.narration}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {p.story?.checklist && <ChecklistPanel items={p.story.checklist} source={p.story.checklistSource} revised={p.story.revised} />}
      </aside>
    </div>
  );
}

function Finished({ p, onChange, onRegenerate }: { p: ProjectView; onChange: () => void; onRegenerate: (id: string) => void }) {
  const v = p.video!;
  const { refresh } = useMe();
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "danger" | "accent"; text: string } | null>(null);
  const [del, setDel] = useState(false);
  const router = useRouter();
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/v/${p.id}` : `/v/${p.id}`;
  const generated = p.story?.cast.filter((c) => c.generated) ?? [];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      trackShare(p.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ tone: "danger", text: `Copy failed — here’s the link: ${shareUrl}` });
    }
  };

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
      <div className="mx-auto w-full max-w-[420px] lg:sticky lg:top-8">
        <video src={v.url} poster={v.thumb} controls playsInline className="aspect-[9/16] w-full rounded-[16px] border border-line bg-black" />
        <p className="mt-2 text-center font-mono text-micro text-fg-2">
          {v.width}×{v.height} · {fmtDuration(v.durationSec)} · {(v.sizeBytes / 1e6).toFixed(1)} MB · H.264 MP4
        </p>
      </div>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <a href={`${v.url}?download=${encodeURIComponent(p.title)}`} className={btn("primary", "lg")}>
            Download MP4
          </a>
          <Button size="lg" onClick={() => (p.visibility === "public" ? void copyLink() : setShareOpen(true))}>
            {copied ? "Link copied" : "Copy share link"}
          </Button>
          <Button
            size="lg"
            disabled={busy === "next"}
            onClick={async () => {
              setBusy("next");
              setMsg(null);
              try {
                const r = await api<{ projectId: string }>(`/api/projects/${p.id}/next-episode`, { method: "POST", json: { idempotencyKey: crypto.randomUUID() } });
                void refresh();
                onRegenerate(r.projectId);
              } catch (e) {
                setMsg({ tone: "danger", text: e instanceof ApiError ? e.message : "Couldn't start the next episode." });
                setBusy(null);
              }
            }}
          >
            {busy === "next" ? "Starting…" : `Make Part ${p.episode + 1}`}
          </Button>
          <LinkButton size="lg" href="/studio">
            Generate another
          </LinkButton>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-small">
          <span className="inline-flex items-center gap-1.5 text-fg-2">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2.5 7.2l2.7 2.6 6.3-6.3" stroke="#B9F36A" strokeWidth="1.8" fill="none" /></svg>
            Saved to <Link href="/studio/projects" className="text-fg underline decoration-line underline-offset-4">My Studio</Link>
          </span>
          <span className="text-fg-3">·</span>
          <button
            className="text-fg-2 underline decoration-line underline-offset-4 hover:text-fg disabled:opacity-50"
            disabled={busy === "regen"}
            onClick={async () => {
              setBusy("regen");
              setMsg(null);
              try {
                const r = await api<{ projectId: string }>(`/api/projects/${p.id}/regenerate`, { method: "POST", json: { idempotencyKey: crypto.randomUUID() } });
                void refresh();
                onRegenerate(r.projectId);
              } catch (e) {
                setMsg({ tone: "danger", text: e instanceof ApiError ? e.message : "Couldn't start a new version." });
                setBusy(null);
              }
            }}
          >
            {busy === "regen" ? "Starting…" : "Generate a new version"}
          </button>
          {p.visibility === "public" && (
            <>
              <span className="text-fg-3">·</span>
              <button
                className="text-fg-2 underline decoration-line underline-offset-4 hover:text-fg"
                onClick={async () => {
                  await api(`/api/projects/${p.id}`, { method: "PATCH", json: { visibility: "private" } });
                  onChange();
                }}
              >
                Make private
              </button>
            </>
          )}
          <span className="text-fg-3">·</span>
          <button className="text-[var(--danger-fg)] underline decoration-[var(--danger-line)] underline-offset-4 hover:text-danger" onClick={() => setDel(true)}>
            Delete
          </button>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

        {generated.length > 0 && (
          <div className="rounded-[16px] border border-line bg-[var(--card)] p-4">
            <p className="text-body font-medium">New characters in this story</p>
            <p className="mt-1 text-small text-fg-2">{generated.map((c) => c.name).join(", ")} were designed for this video. Save them to reuse in future stories.</p>
            <Button
              size="sm"
              className="mt-3"
              disabled={busy === "chars"}
              onClick={async () => {
                setBusy("chars");
                try {
                  await api(`/api/projects/${p.id}/save-characters`, { method: "POST" });
                  setMsg({ tone: "accent", text: "Saved to your characters." });
                  onChange();
                } catch (e) {
                  setMsg({ tone: "danger", text: e instanceof ApiError ? e.message : "Couldn't save characters." });
                } finally {
                  setBusy(null);
                }
              }}
            >
              Save to my characters
            </Button>
          </div>
        )}

        {p.story && (
          <div>
            <p className="eyebrow mb-3">
              Script · {p.story.source === "anthropic" ? `written by ${p.story.model}` : "template engine (not AI)"}
            </p>
            <ol className="space-y-2.5">
              {p.story.scenes.map((s, i) => (
                <li key={i} className="flex gap-3 text-small">
                  <span className="w-5 shrink-0 font-mono text-micro leading-5 text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                  <span className="leading-snug text-fg-2">{s.narration}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-caption text-fg-3">
              Cast: {p.story.cast.map((c) => c.name).join(", ")} · {STYLE_LABELS[p.style].label} style
            </p>
          </div>
        )}
        {p.metrics && <MetricsPanel m={p.metrics} isPublic={p.visibility === "public"} />}
        {p.story?.checklist && <ChecklistPanel items={p.story.checklist} source={p.story.checklistSource} revised={p.story.revised} />}
        {p.story?.sheet && <StorySheetPanel sheet={p.story.sheet} />}
      </div>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} label="Share this video">
        <div className="w-[min(440px,92vw)] rounded-[16px] border border-line bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Make this video public?</h2>
          <p className="mt-2 text-small text-fg-2">Anyone with the link will be able to watch and download it, and it can appear in Explore. You can make it private again at any time.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await api(`/api/projects/${p.id}`, { method: "PATCH", json: { visibility: "public" } });
                  setShareOpen(false);
                  onChange();
                  await copyLink();
                } catch (e) {
                  setMsg({ tone: "danger", text: e instanceof ApiError ? e.message : "Couldn't share." });
                  setShareOpen(false);
                }
              }}
            >
              Make public & copy link
            </Button>
          </div>
        </div>
      </Modal>
      <Modal open={del} onClose={() => setDel(false)} label="Delete video">
        <div className="w-[min(420px,92vw)] rounded-[16px] border border-line bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Delete “{p.title}”?</h2>
          <p className="mt-2 text-small text-fg-2">The video, its script and its previews are removed permanently. Share links stop working.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setDel(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api(`/api/projects/${p.id}`, { method: "DELETE" });
                router.replace("/studio/projects");
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

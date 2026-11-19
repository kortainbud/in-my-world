"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, fmtDuration, timeAgo } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import type { ProjectView } from "@/lib/server/views";
import { btn, Button, Empty, LinkButton, Modal, Notice, StyleTag, Tag } from "@/components/ui";
import { VideoModal } from "@/components/video";
import { PageHeader } from "./shell";

const TABS = [
  { id: "all", label: "All" },
  { id: "processing", label: "Processing" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
] as const;

export function ProjectsScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "all") as (typeof TABS)[number]["id"];
  const [data, setData] = useState<{ projects: ProjectView[]; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<ProjectView | null>(null);
  const [confirm, setConfirm] = useState<ProjectView | null>(null);
  const [notice, setNotice] = useState<{ tone: "danger" | "accent"; text: string } | null>(null);
  const { refresh } = useMe();

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/projects?status=${tab}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your studio.");
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const anyActive = data?.projects.some((p) => ["queued", "processing", "awaiting_render", "rendering"].includes(p.status));
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [anyActive, load]);

  const setTab = (id: string) => {
    const q = new URLSearchParams(params);
    if (id === "all") q.delete("tab");
    else q.set("tab", id);
    router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const newVersion = async (p: ProjectView) => {
    try {
      const r = await api<{ projectId: string }>(`/api/projects/${p.id}/regenerate`, { method: "POST", json: { idempotencyKey: crypto.randomUUID() } });
      void refresh();
      router.push(`/studio/projects/${r.projectId}`);
    } catch (e) {
      setNotice({ tone: "danger", text: e instanceof ApiError ? e.message : "Couldn't start a new version." });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-24 pt-8 sm:px-8 lg:pt-12">
      <PageHeader title="My Studio" sub="Every video you make is saved here." actions={<LinkButton href="/studio" variant="primary">New video</LinkButton>} />

      <div role="tablist" aria-label="Filter projects" className="mb-6 flex gap-1 overflow-x-auto border-b border-line-soft scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-body transition-colors ${tab === t.id ? "border-accent text-fg" : "border-transparent text-fg-2 hover:text-fg"}`}
          >
            {t.label}
            {data && <span className="font-mono text-micro text-fg-3">{data.counts[t.id] ?? 0}</span>}
          </button>
        ))}
      </div>

      {notice && <Notice tone={notice.tone} className="mb-4">{notice.text}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      {!data && !error && <Grid>{Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[9/16] animate-pulse rounded-[16px] bg-bg-2" />)}</Grid>}
      {data && data.projects.length === 0 && (
        <Empty
          title={tab === "all" ? "Nothing here yet" : `No ${tab} videos`}
          body={tab === "all" ? "Type one sentence and we’ll turn it into a whole world." : undefined}
          action={tab === "all" ? <LinkButton href="/studio" variant="primary">Create your first video</LinkButton> : undefined}
        />
      )}
      {data && data.projects.length > 0 && (
        <Grid>
          {data.projects.map((p) => (
            <article key={p.id} className="group min-w-0">
              <Link href={`/studio/projects/${p.id}`} className="relative block aspect-[9/16] overflow-hidden rounded-[16px] border border-line-soft bg-[var(--card)]">
                {p.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumb} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover ${p.status !== "completed" ? "opacity-50" : ""}`} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-caption leading-snug text-fg-3">“{p.prompt}”</div>
                )}
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
                  <StyleTag style={p.style} />
                  {p.video && <span className="rounded-[5px] bg-black/60 px-1.5 py-0.5 font-mono text-micro">{fmtDuration(p.video.durationSec)}</span>}
                </div>
                {p.status !== "completed" && (
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <Status p={p} />
                  </div>
                )}
              </Link>
              <div className="mt-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/studio/projects/${p.id}`} className="block truncate text-body font-medium hover:underline">
                    {p.title}
                  </Link>
                  <p className="mt-0.5 text-caption text-fg-3">
                    {timeAgo(p.createdAt)} · {p.durationPreset}s{p.visibility === "public" ? " · public" : ""}
                  </p>
                </div>
                <Menu
                  items={[
                    { label: "Open", href: `/studio/projects/${p.id}` },
                    ...(p.video ? [{ label: "Watch", onClick: () => setPlaying(p) }, { label: "Download", href: `${p.video.url}?download=${encodeURIComponent(p.title)}`, download: true }] : []),
                    ...(p.status === "completed" || p.status === "failed" ? [{ label: "Generate new version", onClick: () => void newVersion(p) }] : []),
                    ...(["completed", "failed", "awaiting_render"].includes(p.status) ? [{ label: "Delete", onClick: () => setConfirm(p), danger: true }] : []),
                  ]}
                />
              </div>
            </article>
          ))}
        </Grid>
      )}

      <VideoModal
        item={playing?.video ? { id: playing.id, title: playing.title, prompt: playing.prompt, style: playing.style, durationSec: playing.video.durationSec, video: playing.video.url, thumb: playing.video.thumb } : null}
        onClose={() => setPlaying(null)}
        actions={playing && <LinkButton href={`/studio/projects/${playing.id}`}>Open project</LinkButton>}
      />
      <Modal open={!!confirm} onClose={() => setConfirm(null)} label="Delete video">
        {confirm && (
          <div className="w-[min(420px,92vw)] rounded-[16px] border border-line bg-[var(--card)] p-5">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Delete “{confirm.title}”?</h2>
            <p className="mt-2 text-small text-fg-2">
              {confirm.status === "awaiting_render" ? "It hasn’t rendered yet, so its credits will be refunded. " : ""}This can’t be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await api(`/api/projects/${confirm.id}`, { method: "DELETE" });
                    setNotice({ tone: "accent", text: `Deleted “${confirm.title}”.` });
                    void refresh();
                    void load();
                  } catch (e) {
                    setNotice({ tone: "danger", text: e instanceof ApiError ? e.message : "Couldn't delete." });
                  }
                  setConfirm(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">{children}</div>;
}

function Status({ p }: { p: ProjectView }) {
  if (p.status === "failed") return <Tag tone="danger">Failed · credits refunded</Tag>;
  const label = p.status === "awaiting_render" ? "Waiting to render" : p.status === "rendering" ? "Rendering" : "Processing";
  return (
    <Tag tone="warn" className="bg-[var(--warn-bg)]">
      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-warn" />
      {label}
    </Tag>
  );
}

function Menu({ items }: { items: { label: string; href?: string; download?: boolean; onClick?: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  return (
    <div className="relative shrink-0">
      <button
        className={btn("ghost", "sm", "!h-7 !px-1.5")}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><circle cx="3.5" cy="8" r="1.3" fill="currentColor" /><circle cx="8" cy="8" r="1.3" fill="currentColor" /><circle cx="12.5" cy="8" r="1.3" fill="currentColor" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-8 z-20 w-48 rounded-[12px] border border-line bg-[var(--card)] p-1 shadow-2xl shadow-black/60">
          {items.map((it) =>
            it.href ? (
              <a key={it.label} role="menuitem" href={it.href} download={it.download || undefined} className="block rounded-[10px] px-2.5 py-1.5 text-small text-fg-2 hover:bg-bg-3 hover:text-fg">
                {it.label}
              </a>
            ) : (
              <button key={it.label} role="menuitem" onClick={it.onClick} className={`block w-full rounded-[10px] px-2.5 py-1.5 text-left text-small hover:bg-bg-3 ${it.danger ? "text-[var(--danger-fg)]" : "text-fg-2 hover:text-fg"}`}>
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

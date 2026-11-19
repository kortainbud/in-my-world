"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, fmtDuration } from "@/lib/client/api";
import type { ProjectView } from "@/lib/server/views";
import { btn, StyleTag } from "@/components/ui";

export function SharedVideo({ id }: { id: string }) {
  const [p, setP] = useState<ProjectView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [counted, setCounted] = useState(false);
  useEffect(() => {
    api<{ project: ProjectView }>(`/api/projects/${id}`)
      .then((d) => setP(d.project))
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Couldn't load this video."));
  }, [id]);
  if (err)
    return (
      <div className="mx-auto max-w-md px-6 py-28 text-center">
        <h1 className="text-[22px] font-semibold">This video isn’t available</h1>
        <p className="mt-2 text-[14px] text-fg-2">{err}</p>
        <Link href="/explore" className={btn("secondary", "md", "mt-6")}>
          Explore other stories
        </Link>
      </div>
    );
  if (!p?.video) return <div className="flex min-h-[60vh] items-center justify-center text-[13px] text-fg-3">Loading…</div>;
  return (
    <div className="mx-auto grid max-w-[1000px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,400px)_1fr]">
      <video
        src={p.video.url}
        poster={p.video.thumb}
        controls
        playsInline
        className="mx-auto aspect-[9/16] w-full max-w-[400px] rounded-[16px] border border-line bg-black"
        onPlay={() => {
          if (counted) return;
          setCounted(true);
          void fetch(`/api/explore/${p.id}/view`, { method: "POST" });
        }}
      />
      <div className="md:pt-6">
        <StyleTag style={p.style} />
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.03em]">{p.title}</h1>
        <p className="mt-2 text-[14px] text-fg-2">
          by {p.owner.displayName} · {fmtDuration(p.video.durationSec)}
        </p>
        <div className="mt-6 rounded-[12px] border border-line-soft bg-bg-2 p-4">
          <p className="eyebrow mb-1.5">The idea</p>
          <p className="text-[16px] leading-snug">{p.prompt}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/sign-up?next=${encodeURIComponent(`/studio?prompt=${encodeURIComponent(p.prompt)}&style=${p.style}`)}`} className={btn("primary", "lg")}>
            Make my own version
          </Link>
          <a href={`${p.video.url}?download=${encodeURIComponent(p.title)}`} className={btn("secondary", "lg")}>
            Download
          </a>
        </div>
        <p className="mt-8 text-[13px] text-fg-3">Made with In My World — turn any idea into a whole world.</p>
      </div>
    </div>
  );
}

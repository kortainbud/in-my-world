"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIES, STYLE_LABELS } from "@/config/site";
import type { CharacterRecord } from "@/lib/engine/characters";
import { SOURCE_LABELS } from "@/lib/engine/characters";
import { api } from "@/lib/client/api";
import type { ExploreItem } from "@/lib/server/explore";
import { Portrait } from "./portrait";
import { inputCls, LinkButton, Notice, Tag } from "./ui";
import { VideoCard, VideoModal, type VideoItem } from "./video";

interface ExploreData {
  items: ExploreItem[];
  creators: { handle: string; displayName: string; videos: number; views: number; isSample: boolean }[];
  characters: CharacterRecord[];
  prompts: { id: string; title: string; prompt: string; category: string }[];
  total: number;
}

const SORTS = [
  { id: "trending", label: "Trending" },
  { id: "recent", label: "Recent" },
  { id: "popular", label: "Most played" },
];

export function Explore({ context }: { context: "public" | "studio" }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const style = params.get("style") ?? "all";
  const category = params.get("category") ?? "all";
  const sort = params.get("sort") ?? "trending";
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);
  const [data, setData] = useState<ExploreData | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<VideoItem | null>(null);

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (!v || v === "all" || (k === "sort" && v === "trending")) n.delete(k);
    else n.set(k, v);
    router.replace(`${pathname}${n.size ? `?${n}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    let live = true;
    setError(false);
    api<ExploreData>(`/api/explore?${new URLSearchParams({ style, category, sort, q })}`)
      .then((d) => live && setData(d))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [style, category, sort, q]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== q) set("q", search);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const createHref = (prompt: string) => (context === "public" ? `/sign-up?next=${encodeURIComponent(`/studio?prompt=${encodeURIComponent(prompt)}`)}` : `/studio?prompt=${encodeURIComponent(prompt)}`);
  const charHref = context === "public" ? "/characters" : "/studio/characters";
  const filtered = style !== "all" || category !== "all" || !!q;

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Visual style" className="flex gap-1 overflow-x-auto scrollbar-none">
          {[{ id: "all", label: "All stories" }, { id: "roblox", label: `${STYLE_LABELS.roblox.label} stories` }, { id: "minecraft", label: `${STYLE_LABELS.minecraft.label} stories` }].map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={style === s.id}
              onClick={() => set("style", s.id)}
              className={`h-9 whitespace-nowrap rounded-[12px] px-3.5 text-small font-medium transition-colors ${style === s.id ? "bg-fg text-bg" : "text-fg-2 hover:bg-bg-3 hover:text-fg"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="explore-search">
            Search stories
          </label>
          <input id="explore-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stories" className={`${inputCls} !h-9 sm:w-56`} />
          <label className="sr-only" htmlFor="explore-sort">
            Sort
          </label>
          <select id="explore-sort" value={sort} onChange={(e) => set("sort", e.target.value)} className={`${inputCls} !h-9 !w-auto pr-8`}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Categories">
        {["all", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => set("category", c)}
            aria-pressed={category === c}
            className={`h-7 rounded-[10px] border px-2.5 text-caption transition-colors ${category === c ? "border-accent bg-[var(--accent-soft)] text-fg" : "border-line-soft text-fg-2 hover:border-line hover:text-fg"}`}
          >
            {c === "all" ? "All categories" : c}
          </button>
        ))}
      </div>

      {error && <Notice tone="danger" className="mt-6">Couldn’t load stories. Refresh to try again.</Notice>}

      <section className="mt-8" aria-label="Stories">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lead font-semibold tracking-[-0.02em]">{filtered ? "Results" : SORTS.find((s) => s.id === sort)?.label}</h2>
          {data && <span className="text-caption text-fg-3">{data.items.length} {data.items.length === 1 ? "video" : "videos"}</span>}
        </div>
        {!data && !error && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="aspect-[9/16] animate-pulse rounded-[16px] bg-bg-2" />)}
          </div>
        )}
        {data && data.items.length === 0 && (
          <div className="rounded-[16px] border border-line px-6 py-14 text-center">
            <p className="text-body font-medium">{data.total === 0 ? "No public stories yet" : "No stories match these filters"}</p>
            <p className="mt-1.5 text-small text-fg-2">{data.total === 0 ? "Finished videos that creators share will show up here." : "Try another style or category."}</p>
          </div>
        )}
        {data && data.items.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.items.map((i) => (
              <VideoCard
                key={i.id}
                item={i}
                onOpen={() => setOpen(i)}
                footer={
                  <p className="mt-0.5 truncate text-caption text-fg-3">
                    {i.isSample ? "Sample" : `@${i.owner.handle}`} · {i.views} {i.views === 1 ? "play" : "plays"} · {i.category}
                  </p>
                }
              />
            ))}
          </div>
        )}
      </section>

      {data && !filtered && (
        <div className="mt-16 grid gap-12 lg:grid-cols-3">
          <section aria-label="Popular prompts">
            <h2 className="mb-4 text-lead font-semibold tracking-[-0.02em]">Popular prompts</h2>
            <ul className="divide-y divide-line-soft rounded-[16px] border border-line-soft">
              {data.prompts.map((p) => (
                <li key={p.id}>
                  <Link href={createHref(p.prompt)} className="flex items-center justify-between gap-3 px-4 py-3 text-small hover:bg-bg-2">
                    <span className="text-fg-2">{p.prompt}</span>
                    <span className="shrink-0 text-caption text-fg-3">Use →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Popular characters">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lead font-semibold tracking-[-0.02em]">Popular characters</h2>
              <Link href={charHref} className="text-caption text-fg-2 hover:text-fg">
                All characters →
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {data.characters.map((c) => (
                <Link key={c.id} href={charHref} className="rounded-[12px] border border-line-soft bg-[var(--card)] p-1.5 text-center hover:border-line">
                  <Portrait appearance={c.appearance} className="mx-auto h-16 w-14" />
                  <span className="mt-1 block truncate text-caption">{c.name}</span>
                </Link>
              ))}
            </div>
          </section>
          <section aria-label="Featured creators">
            <h2 className="mb-4 text-lead font-semibold tracking-[-0.02em]">Featured creators</h2>
            {data.creators.length === 0 ? (
              <p className="text-small text-fg-3">Creators appear here once they share videos.</p>
            ) : (
              <ul className="space-y-2">
                {data.creators.map((c) => (
                  <li key={c.handle} className="flex items-center justify-between rounded-[12px] border border-line-soft px-3.5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-small font-medium">{c.displayName}</span>
                      <span className="text-caption text-fg-3">{c.isSample ? "Sample content" : `@${c.handle}`}</span>
                    </span>
                    <span className="text-right text-caption text-fg-2">
                      {c.videos} videos
                      <br />
                      {c.views} plays
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <VideoModal
        item={open}
        onClose={() => setOpen(null)}
        actions={open && <LinkButton href={createHref(open.prompt)} variant="primary">Make my own version</LinkButton>}
      />
    </div>
  );
}

export function CharacterSourceTag({ source }: { source: CharacterRecord["source"] }) {
  return <Tag tone={source === "featured_personality" ? "accent" : "default"}>{SOURCE_LABELS[source]}</Tag>;
}
